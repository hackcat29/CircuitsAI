use near_sdk::{
    collections::LookupMap,
    env,
    json_types::{U128, U64},
    near, AccountId, Gas, NearToken, PanicOnDefault, Promise, PublicKey,
};
use serde_json::json;

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct EvmPolicy {
    pub chain_id: u64,
    pub token: String,
    pub recipients: Vec<String>,
    pub max_per_transfer: U128,
    pub daily_limit: U128,
    pub max_gas: U64,
    pub max_fee_per_gas: U128,
    pub next_nonce: U64,
    pub day: u64,
    pub spent: U128,
}

#[near(serializers = [json])]
pub struct TransferRequest {
    pub chain_id: u64,
    pub nonce: U64,
    pub recipient: String,
    pub amount: U128,
    pub gas_limit: U64,
    pub max_fee_per_gas: U128,
    pub max_priority_fee_per_gas: U128,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct AgentWallet {
    owner: AccountId,
    commerce: AccountId,
    mpc: AccountId,
    signature_deposit: U128,
    runtime_public_key: PublicKey,
    paused: bool,
    evm: LookupMap<u64, EvmPolicy>,
}

#[near]
impl AgentWallet {
    #[init]
    pub fn new(
        owner: AccountId,
        commerce: AccountId,
        mpc: AccountId,
        signature_deposit: U128,
        runtime_public_key: PublicKey,
    ) -> Self {
        assert!(
            signature_deposit.0 <= 10u128.pow(23),
            "signature deposit too high"
        );
        Self {
            owner,
            commerce,
            mpc,
            signature_deposit,
            runtime_public_key,
            paused: false,
            evm: LookupMap::new(b"e"),
        }
    }

    pub fn revoke_runtime_key(&mut self) -> Promise {
        self.assert_owner();
        self.paused = true;
        Promise::new(env::current_account_id()).delete_key(self.runtime_public_key.clone())
    }

    pub fn set_paused(&mut self, paused: bool) {
        self.assert_owner();
        self.paused = paused;
    }

    pub fn set_evm_policy(&mut self, policy: EvmPolicy) {
        self.assert_owner();
        assert!(
            policy.chain_id > 0 && policy.recipients.len() <= 32,
            "invalid policy"
        );
        address(&policy.token);
        for recipient in &policy.recipients {
            address(recipient);
        }
        assert!(
            policy.max_per_transfer.0 <= policy.daily_limit.0,
            "invalid limits"
        );
        assert!(
            policy.max_gas.0 <= 300_000 && policy.max_fee_per_gas.0 <= 1_000_000_000_000,
            "invalid gas caps"
        );
        // A policy update cannot erase today's usage or roll back nonces.
        let mut p = policy;
        if let Some(old) = self.evm.get(&p.chain_id) {
            assert!(p.next_nonce.0 >= old.next_nonce.0, "nonce rollback");
            p.day = old.day;
            p.spent = old.spent;
        } else {
            p.day = 0;
            p.spent = U128(0);
        }
        self.evm.insert(&p.chain_id, &p);
    }

    /// Only narrowly typed commerce methods are forwarded. No arbitrary target, method, or deposit.
    pub fn post_job(
        &self,
        provider: AccountId,
        amount: U128,
        task_hash: String,
        deadline: U64,
    ) -> Promise {
        self.assert_runtime();
        self.call_commerce(
            "post_job",
            json!({"provider":provider,"amount":amount,"task_hash":task_hash,"deadline":deadline}),
        )
    }
    pub fn deliver(&self, job_id: U64, deliverable_hash: String) -> Promise {
        self.assert_runtime();
        self.call_commerce(
            "deliver",
            json!({"job_id":job_id,"deliverable_hash":deliverable_hash}),
        )
    }
    pub fn release(&self, job_id: U64) -> Promise {
        self.assert_runtime();
        self.call_commerce("release", json!({"job_id":job_id}))
    }
    pub fn open_dispute(&self, job_id: U64) -> Promise {
        self.assert_runtime();
        self.call_commerce("open_dispute", json!({"job_id":job_id}))
    }
    pub fn cancel_expired(&self, job_id: U64) -> Promise {
        self.assert_runtime();
        self.call_commerce("cancel_expired", json!({"job_id":job_id}))
    }
    pub fn withdraw(&self, amount: U128) -> Promise {
        self.assert_runtime();
        self.call_commerce(
            "withdraw",
            json!({"agent_id":env::current_account_id(),"amount":amount}),
        )
    }

    /// Builds the EIP-1559 ERC-20 transfer hash ON CHAIN. Runtime cannot submit arbitrary hashes.
    /// MPC budget is charged before requesting a signature and not restored on failure: a signature
    /// might already exist. The owner reconciles interrupted requests against the foreign chain.
    pub fn sign_transfer(&mut self, request: TransferRequest) -> Promise {
        self.assert_runtime();
        let mut p = self.evm.get(&request.chain_id).expect("chain not allowed");
        let recipient = address(&request.recipient);
        assert!(
            p.recipients.iter().any(|a| address(a) == recipient),
            "recipient not allowed"
        );
        assert_eq!(p.next_nonce.0, request.nonce.0, "unexpected nonce");
        assert!(
            request.amount.0 > 0 && request.amount.0 <= p.max_per_transfer.0,
            "per transfer limit"
        );
        assert!(
            request.gas_limit.0 > 0 && request.gas_limit.0 <= p.max_gas.0,
            "gas limit"
        );
        assert!(
            request.max_fee_per_gas.0 <= p.max_fee_per_gas.0,
            "fee limit"
        );
        assert!(
            request.max_priority_fee_per_gas.0 <= request.max_fee_per_gas.0,
            "priority fee limit"
        );
        let day = env::block_timestamp() / 86_400_000_000_000;
        if p.day != day {
            p.day = day;
            p.spent = U128(0);
        }
        p.spent.0 = p.spent.0.checked_add(request.amount.0).expect("overflow");
        assert!(p.spent.0 <= p.daily_limit.0, "daily limit");
        p.next_nonce.0 = p.next_nonce.0.checked_add(1).expect("nonce overflow");
        let hash = transfer_hash(&p.token, &request);
        self.evm.insert(&request.chain_id, &p);
        Promise::new(self.mpc.clone()).function_call("sign", json!({"request":{"payload":hash,"path":format!("circuits/evm/{}",request.chain_id),"key_version":0}}).to_string().into_bytes(), NearToken::from_yoctonear(self.signature_deposit.0), Gas::from_tgas(250))
    }

    #[payable]
    pub fn fund_gas(&mut self) {}

    pub fn get_config(&self) -> serde_json::Value {
        json!({"owner":self.owner,"commerce":self.commerce,"mpc":self.mpc,"paused":self.paused,"signature_deposit":self.signature_deposit,"runtime_public_key":self.runtime_public_key})
    }
    pub fn get_evm_policy(&self, chain_id: u64) -> Option<EvmPolicy> {
        self.evm.get(&chain_id)
    }
    pub fn get_transfer_hash(&self, request: TransferRequest) -> Vec<u8> {
        let p = self.evm.get(&request.chain_id).expect("chain not allowed");
        transfer_hash(&p.token, &request)
    }
}

impl AgentWallet {
    fn assert_owner(&self) {
        // Owner's external account OR a full-access key retained on this sub-account.
        // Function-call runtime keys do not include either administrative method.
        let caller = env::predecessor_account_id();
        assert!(
            caller == self.owner
                || (caller == env::current_account_id() && env::signer_account_id() == caller),
            "owner only"
        );
    }
    fn assert_runtime(&self) {
        assert!(!self.paused, "agent paused");
        if env::predecessor_account_id() == self.owner {
            return;
        }
        assert_eq!(
            env::predecessor_account_id(),
            env::current_account_id(),
            "agent only"
        );
        assert_eq!(
            env::signer_account_id(),
            env::current_account_id(),
            "direct agent transaction only"
        );
    }
    fn call_commerce(&self, method: &str, args: serde_json::Value) -> Promise {
        Promise::new(self.commerce.clone()).function_call(
            method,
            args.to_string().into_bytes(),
            NearToken::from_yoctonear(0),
            Gas::from_tgas(70),
        )
    }
}

fn address(value: &str) -> Vec<u8> {
    assert!(
        value.len() == 42 && value.starts_with("0x"),
        "invalid EVM address"
    );
    (2..42)
        .step_by(2)
        .map(|i| u8::from_str_radix(&value[i..i + 2], 16).expect("invalid EVM address"))
        .collect()
}
fn integer(value: u128) -> Vec<u8> {
    let bytes = value.to_be_bytes();
    let first = bytes.iter().position(|b| *b != 0).unwrap_or(bytes.len());
    rlp(&bytes[first..])
}
fn rlp(data: &[u8]) -> Vec<u8> {
    if data.len() == 1 && data[0] < 0x80 {
        return data.to_vec();
    }
    let mut out = length(data.len(), 0x80);
    out.extend(data);
    out
}
fn length(size: usize, offset: u8) -> Vec<u8> {
    if size < 56 {
        vec![offset + size as u8]
    } else {
        let n = (size as u64).to_be_bytes();
        let first = n.iter().position(|b| *b != 0).unwrap();
        let mut out = vec![offset + 55 + (8 - first) as u8];
        out.extend(&n[first..]);
        out
    }
}
fn transfer_hash(token: &str, r: &TransferRequest) -> Vec<u8> {
    let mut calldata = vec![0xa9, 0x05, 0x9c, 0xbb];
    calldata.extend([0u8; 12]);
    calldata.extend(address(&r.recipient));
    calldata.extend([0u8; 16]);
    calldata.extend(r.amount.0.to_be_bytes());
    let mut body = Vec::new();
    for n in [
        r.chain_id as u128,
        r.nonce.0 as u128,
        r.max_priority_fee_per_gas.0,
        r.max_fee_per_gas.0,
        r.gas_limit.0 as u128,
    ] {
        body.extend(integer(n));
    }
    body.extend(rlp(&address(token)));
    body.extend(integer(0));
    body.extend(rlp(&calldata));
    body.push(0xc0); // empty access list
    let mut tx = vec![0x02];
    tx.extend(length(body.len(), 0xc0));
    tx.extend(body);
    env::keccak256(&tx)
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::{
        test_utils::{get_created_receipts, VMContextBuilder},
        testing_env,
    };
    fn ctx(who: &str) {
        let mut b = VMContextBuilder::new();
        b.current_account_id("alpha.circuits.testnet".parse().unwrap())
            .signer_account_id(who.parse().unwrap())
            .predecessor_account_id(who.parse().unwrap())
            .prepaid_gas(Gas::from_tgas(300))
            .account_balance(NearToken::from_near(10));
        testing_env!(b.build());
    }
    fn setup() -> AgentWallet {
        ctx("owner.testnet");
        let mut w = AgentWallet::new(
            "owner.testnet".parse().unwrap(),
            "market.testnet".parse().unwrap(),
            "v1.signer-prod.testnet".parse().unwrap(),
            U128(1),
            "ed25519:11111111111111111111111111111111".parse().unwrap(),
        );
        w.set_evm_policy(EvmPolicy {
            chain_id: 8453,
            token: "0x1111111111111111111111111111111111111111".into(),
            recipients: vec!["0x2222222222222222222222222222222222222222".into()],
            max_per_transfer: U128(10),
            daily_limit: U128(15),
            max_gas: U64(100000),
            max_fee_per_gas: U128(100),
            next_nonce: U64(0),
            day: 0,
            spent: U128(0),
        });
        w
    }
    fn request() -> TransferRequest {
        TransferRequest {
            chain_id: 8453,
            nonce: U64(0),
            recipient: "0x2222222222222222222222222222222222222222".into(),
            amount: U128(10),
            gas_limit: U64(65000),
            max_fee_per_gas: U128(10),
            max_priority_fee_per_gas: U128(1),
        }
    }
    #[test]
    fn signature_is_policy_gated() {
        let mut w = setup();
        ctx("alpha.circuits.testnet");
        w.sign_transfer(request());
        assert_eq!(w.get_evm_policy(8453).unwrap().spent.0, 10);
        assert_eq!(w.get_evm_policy(8453).unwrap().next_nonce.0, 1);
        assert_eq!(get_created_receipts().len(), 1);
    }
    #[test]
    #[should_panic(expected = "recipient not allowed")]
    fn rejects_destination() {
        let mut w = setup();
        ctx("alpha.circuits.testnet");
        let mut r = request();
        r.recipient = "0x3333333333333333333333333333333333333333".into();
        w.sign_transfer(r);
    }
    #[test]
    #[should_panic(expected = "unexpected nonce")]
    fn rejects_nonce_replay() {
        let mut w = setup();
        ctx("alpha.circuits.testnet");
        w.sign_transfer(request());
        w.sign_transfer(request());
    }
    #[test]
    #[should_panic(expected = "daily limit")]
    fn rejects_daily_overspend() {
        let mut w = setup();
        ctx("alpha.circuits.testnet");
        w.sign_transfer(request());
        let mut r = request();
        r.nonce = U64(1);
        w.sign_transfer(r);
    }
    #[test]
    #[should_panic(expected = "agent only")]
    fn rejects_foreign_caller() {
        let mut w = setup();
        ctx("attacker.testnet");
        w.sign_transfer(request());
    }
    #[test]
    #[should_panic(expected = "agent paused")]
    fn emergency_pause() {
        let mut w = setup();
        w.set_paused(true);
        ctx("alpha.circuits.testnet");
        w.sign_transfer(request());
    }
    #[test]
    fn rlp_matches_reference() {
        ctx("owner.testnet");
        let hash = transfer_hash("0x1111111111111111111111111111111111111111", &request());
        let hex = hash.iter().map(|b| format!("{b:02x}")).collect::<String>();
        println!("transfer hash: {hex}");
        assert_eq!(
            hex,
            "951be9ab4f146521c97d7b6d52397a079f1a21efafe277d88c935f6c04915d6b"
        );
    }
}
