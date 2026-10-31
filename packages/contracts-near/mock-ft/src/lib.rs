//! Sandbox-only NEP-141 test token. Never represents real USDC.
use near_sdk::{
    collections::LookupMap, env, json_types::U128, near, AccountId, Gas, NearToken, PanicOnDefault,
    Promise,
};
use serde_json::json;
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Token {
    owner: AccountId,
    balances: LookupMap<AccountId, u128>,
}
#[near]
impl Token {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            owner,
            balances: LookupMap::new(b"b"),
        }
    }
    pub fn mint(&mut self, account_id: AccountId, amount: U128) {
        assert_eq!(env::predecessor_account_id(), self.owner, "owner only");
        self.credit(&account_id, amount.0);
    }
    #[payable]
    pub fn storage_deposit(&mut self, account_id: Option<AccountId>) -> serde_json::Value {
        let _ = account_id;
        json!({"total":"0","available":"0"})
    }
    pub fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        U128(self.balances.get(&account_id).unwrap_or(0))
    }
    #[payable]
    pub fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128) {
        assert_eq!(
            env::attached_deposit(),
            NearToken::from_yoctonear(1),
            "one yocto required"
        );
        self.move_tokens(&env::predecessor_account_id(), &receiver_id, amount.0);
    }
    #[payable]
    pub fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        msg: String,
    ) -> Promise {
        assert_eq!(
            env::attached_deposit(),
            NearToken::from_yoctonear(1),
            "one yocto required"
        );
        let sender_id = env::predecessor_account_id();
        self.move_tokens(&sender_id, &receiver_id, amount.0);
        Promise::new(receiver_id.clone())
            .function_call(
                "ft_on_transfer",
                json!({"sender_id":sender_id,"amount":amount,"msg":msg})
                    .to_string()
                    .into_bytes(),
                NearToken::from_yoctonear(0),
                Gas::from_tgas(60),
            )
            .then(
                Promise::new(env::current_account_id()).function_call(
                    "resolve",
                    json!({"sender_id":sender_id,"receiver_id":receiver_id,"amount":amount})
                        .to_string()
                        .into_bytes(),
                    NearToken::from_yoctonear(0),
                    Gas::from_tgas(20),
                ),
            )
    }
    #[private]
    pub fn resolve(&mut self, sender_id: AccountId, receiver_id: AccountId, amount: U128) -> U128 {
        let unused = match env::promise_result_checked(0, 128) {
            Ok(bytes) => serde_json::from_slice::<U128>(&bytes)
                .map(|v| v.0.min(amount.0))
                .unwrap_or(amount.0),
            _ => amount.0,
        };
        let refund = unused.min(self.balances.get(&receiver_id).unwrap_or(0));
        if refund > 0 {
            self.move_tokens(&receiver_id, &sender_id, refund);
        }
        U128(amount.0 - refund)
    }
}
impl Token {
    fn credit(&mut self, id: &AccountId, amount: u128) {
        let b = self
            .balances
            .get(id)
            .unwrap_or(0)
            .checked_add(amount)
            .expect("overflow");
        self.balances.insert(id, &b);
    }
    fn move_tokens(&mut self, from: &AccountId, to: &AccountId, amount: u128) {
        assert!(amount > 0, "zero amount");
        let b = self.balances.get(from).unwrap_or(0);
        assert!(b >= amount, "insufficient balance");
        self.balances.insert(from, &(b - amount));
        self.credit(to, amount);
    }
}
