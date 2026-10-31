use near_sdk::{
    collections::LookupMap,
    env,
    json_types::{U128, U64},
    near, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseOrValue,
};
use serde_json::json;

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Agent {
    pub owner: AccountId,
    pub balance: U128,
    pub max_per_job: U128,
    pub daily_limit: U128,
    pub providers: Vec<AccountId>,
    pub spent_day: u64,
    pub spent: U128,
    pub completed: u64,
    pub disputed: u64,
    pub paused: bool,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub enum Status {
    Funded,
    Delivered,
    Disputed,
    Completed,
    Refunded,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Job {
    pub id: U64,
    pub buyer: AccountId,
    pub provider: AccountId,
    pub amount: U128,
    pub task_hash: String,
    pub deliverable_hash: Option<String>,
    pub deadline: U64,
    pub status: Status,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Commerce {
    admin: AccountId,
    token: AccountId,
    arbiter: AccountId,
    agents: LookupMap<AccountId, Agent>,
    jobs: LookupMap<u64, Job>,
    next_job: u64,
}

#[near]
impl Commerce {
    #[init]
    pub fn new(admin: AccountId, token: AccountId, arbiter: AccountId) -> Self {
        Self {
            admin,
            token,
            arbiter,
            agents: LookupMap::new(b"a"),
            jobs: LookupMap::new(b"j"),
            next_job: 0,
        }
    }

    /// Registration is owner/admin funded; runtime keys cannot create unlimited storage.
    pub fn register_agent(&mut self, agent_id: AccountId, owner: AccountId) {
        assert_eq!(env::predecessor_account_id(), self.admin, "admin only");
        assert!(self.agents.get(&agent_id).is_none(), "already registered");
        self.agents.insert(
            &agent_id,
            &Agent {
                owner,
                balance: U128(0),
                max_per_job: U128(0),
                daily_limit: U128(0),
                providers: vec![],
                spent_day: 0,
                spent: U128(0),
                completed: 0,
                disputed: 0,
                paused: false,
            },
        );
    }

    pub fn set_policy(
        &mut self,
        agent_id: AccountId,
        max_per_job: U128,
        daily_limit: U128,
        providers: Vec<AccountId>,
        paused: bool,
    ) {
        let mut agent = self.agent(&agent_id);
        assert_eq!(env::predecessor_account_id(), agent.owner, "owner only");
        assert!(providers.len() <= 32, "too many providers");
        assert!(max_per_job.0 <= daily_limit.0, "invalid limits");
        agent.max_per_job = max_per_job;
        agent.daily_limit = daily_limit;
        agent.providers = providers;
        agent.paused = paused;
        self.agents.insert(&agent_id, &agent);
    }

    /// NEP-141: deposits enter only through the configured token's ft_transfer_call.
    /// sender_id is informational; it never authorizes another account's spend.
    pub fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128> {
        assert_eq!(env::predecessor_account_id(), self.token, "wrong token");
        assert!(amount.0 > 0, "empty deposit");
        let parsed: serde_json::Value =
            serde_json::from_str(&msg).expect("invalid deposit message");
        let account: AccountId = parsed["deposit_for"]
            .as_str()
            .expect("deposit_for required")
            .parse()
            .expect("invalid account");
        let mut agent = self.agent(&account);
        agent.balance.0 = agent
            .balance
            .0
            .checked_add(amount.0)
            .expect("balance overflow");
        self.agents.insert(&account, &agent);
        env::log_str(
            &json!({"event":"deposit","agent_id":account,"sender_id":sender_id,"amount":amount})
                .to_string(),
        );
        PromiseOrValue::Value(U128(0))
    }

    pub fn post_job(
        &mut self,
        provider: AccountId,
        amount: U128,
        task_hash: String,
        deadline: U64,
    ) -> U64 {
        let buyer = env::predecessor_account_id();
        let mut agent = self.agent(&buyer);
        self.agent(&provider);
        assert_ne!(buyer, provider, "self hiring disabled");
        assert!(!agent.paused, "agent paused");
        assert!(agent.providers.contains(&provider), "provider not allowed");
        assert!(
            amount.0 > 0 && amount.0 <= agent.max_per_job.0,
            "per job limit"
        );
        Self::hash(&task_hash);
        assert!(deadline.0 > env::block_timestamp(), "deadline passed");
        assert!(
            deadline.0 <= env::block_timestamp().saturating_add(30 * 86_400_000_000_000),
            "deadline too far"
        );
        let day = env::block_timestamp() / 86_400_000_000_000;
        if agent.spent_day != day {
            agent.spent_day = day;
            agent.spent = U128(0);
        }
        let spent = agent.spent.0.checked_add(amount.0).expect("spend overflow");
        assert!(spent <= agent.daily_limit.0, "daily limit");
        assert!(agent.balance.0 >= amount.0, "insufficient balance");
        agent.balance.0 -= amount.0;
        agent.spent = U128(spent);
        self.next_job = self.next_job.checked_add(1).expect("job overflow");
        let id = self.next_job;
        self.jobs.insert(
            &id,
            &Job {
                id: U64(id),
                buyer: buyer.clone(),
                provider,
                amount,
                task_hash,
                deliverable_hash: None,
                deadline,
                status: Status::Funded,
            },
        );
        self.agents.insert(&buyer, &agent);
        env::log_str(&json!({"event":"job_funded","job_id":id,"amount":amount}).to_string());
        U64(id)
    }

    pub fn deliver(&mut self, job_id: U64, deliverable_hash: String) {
        let mut job = self.job(job_id.0);
        assert_eq!(env::predecessor_account_id(), job.provider, "provider only");
        assert_eq!(job.status, Status::Funded, "not funded");
        assert!(env::block_timestamp() <= job.deadline.0, "deadline passed");
        Self::hash(&deliverable_hash);
        job.deliverable_hash = Some(deliverable_hash);
        job.status = Status::Delivered;
        self.jobs.insert(&job_id.0, &job);
    }

    pub fn release(&mut self, job_id: U64) {
        let mut job = self.job(job_id.0);
        assert_eq!(env::predecessor_account_id(), job.buyer, "buyer only");
        assert_eq!(job.status, Status::Delivered, "not delivered");
        self.settle(&mut job, true);
    }

    pub fn open_dispute(&mut self, job_id: U64) {
        let mut job = self.job(job_id.0);
        let caller = env::predecessor_account_id();
        assert!(caller == job.buyer || caller == job.provider, "party only");
        assert!(
            job.status == Status::Funded || job.status == Status::Delivered,
            "not disputable"
        );
        job.status = Status::Disputed;
        let mut provider = self.agent(&job.provider);
        provider.disputed += 1;
        self.agents.insert(&job.provider, &provider);
        self.jobs.insert(&job_id.0, &job);
    }

    pub fn resolve_dispute(&mut self, job_id: U64, provider_wins: bool) {
        assert_eq!(env::predecessor_account_id(), self.arbiter, "arbiter only");
        let mut job = self.job(job_id.0);
        assert_eq!(job.status, Status::Disputed, "not disputed");
        self.settle(&mut job, provider_wins);
    }

    pub fn cancel_expired(&mut self, job_id: U64) {
        let mut job = self.job(job_id.0);
        assert_eq!(env::predecessor_account_id(), job.buyer, "buyer only");
        assert_eq!(job.status, Status::Funded, "not funded");
        assert!(env::block_timestamp() > job.deadline.0, "not expired");
        self.settle(&mut job, false);
    }

    /// Transfers the provider's earnings to its own account, never a runtime-supplied address.
    pub fn withdraw(&mut self, agent_id: AccountId, amount: U128) -> Promise {
        let mut agent = self.agent(&agent_id);
        let caller = env::predecessor_account_id();
        assert!(
            caller == agent_id || caller == agent.owner,
            "owner or agent only"
        );
        assert!(
            amount.0 > 0 && agent.balance.0 >= amount.0,
            "insufficient balance"
        );
        agent.balance.0 -= amount.0;
        self.agents.insert(&agent_id, &agent);
        Promise::new(self.token.clone())
            .function_call(
                "ft_transfer",
                json!({"receiver_id":agent_id,"amount":amount})
                    .to_string()
                    .into_bytes(),
                NearToken::from_yoctonear(1),
                Gas::from_tgas(20),
            )
            .then(
                Promise::new(env::current_account_id()).function_call(
                    "on_withdraw",
                    json!({"agent_id":agent_id,"amount":amount})
                        .to_string()
                        .into_bytes(),
                    NearToken::from_yoctonear(0),
                    Gas::from_tgas(10),
                ),
            )
    }

    #[private]
    pub fn on_withdraw(&mut self, agent_id: AccountId, amount: U128) -> bool {
        let success = env::promise_result_checked(0, 1024).is_ok();
        if !success {
            let mut agent = self.agent(&agent_id);
            agent.balance.0 = agent.balance.0.checked_add(amount.0).expect("overflow");
            self.agents.insert(&agent_id, &agent);
        }
        success
    }

    pub fn get_agent(&self, agent_id: AccountId) -> Option<Agent> {
        self.agents.get(&agent_id)
    }
    pub fn get_job(&self, job_id: U64) -> Option<Job> {
        self.jobs.get(&job_id.0)
    }
    pub fn get_config(&self) -> serde_json::Value {
        json!({"admin":self.admin,"token":self.token,"arbiter":self.arbiter,"total_jobs":self.next_job})
    }
}

impl Commerce {
    fn agent(&self, id: &AccountId) -> Agent {
        self.agents.get(id).expect("agent not registered")
    }
    fn job(&self, id: u64) -> Job {
        self.jobs.get(&id).expect("job not found")
    }
    fn hash(hash: &str) {
        assert!(
            hash.len() == 64 && hash.bytes().all(|b| b.is_ascii_hexdigit()),
            "expected SHA-256 hex"
        );
    }
    fn settle(&mut self, job: &mut Job, provider_wins: bool) {
        let account = if provider_wins {
            &job.provider
        } else {
            &job.buyer
        };
        let mut agent = self.agent(account);
        agent.balance.0 = agent
            .balance
            .0
            .checked_add(job.amount.0)
            .expect("balance overflow");
        if provider_wins {
            agent.completed += 1;
        }
        job.status = if provider_wins {
            Status::Completed
        } else {
            Status::Refunded
        };
        self.agents.insert(account, &agent);
        self.jobs.insert(&job.id.0, job);
        env::log_str(
            &json!({"event":"job_settled","job_id":job.id,"status":job.status}).to_string(),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::{test_utils::VMContextBuilder, testing_env};
    fn ctx(who: &str) {
        let mut b = VMContextBuilder::new();
        b.current_account_id("market.testnet".parse().unwrap())
            .predecessor_account_id(who.parse().unwrap())
            .block_timestamp(100);
        testing_env!(b.build());
    }
    fn setup() -> Commerce {
        ctx("admin.testnet");
        let mut c = Commerce::new(
            "admin.testnet".parse().unwrap(),
            "usdc.testnet".parse().unwrap(),
            "arbiter.testnet".parse().unwrap(),
        );
        for id in ["buyer.testnet", "provider.testnet"] {
            c.register_agent(id.parse().unwrap(), "owner.testnet".parse().unwrap());
        }
        ctx("owner.testnet");
        c.set_policy(
            "buyer.testnet".parse().unwrap(),
            U128(10),
            U128(15),
            vec!["provider.testnet".parse().unwrap()],
            false,
        );
        ctx("usdc.testnet");
        c.ft_on_transfer(
            "owner.testnet".parse().unwrap(),
            U128(30),
            json!({"deposit_for":"buyer.testnet"}).to_string(),
        );
        c
    }
    fn post(c: &mut Commerce) -> U64 {
        ctx("buyer.testnet");
        c.post_job(
            "provider.testnet".parse().unwrap(),
            U128(10),
            "a".repeat(64),
            U64(1000),
        )
    }
    #[test]
    fn full_job_loop() {
        let mut c = setup();
        let id = post(&mut c);
        ctx("provider.testnet");
        c.deliver(id, "b".repeat(64));
        ctx("buyer.testnet");
        c.release(id);
        assert_eq!(c.get_job(id).unwrap().status, Status::Completed);
        let p = c.agent(&"provider.testnet".parse().unwrap());
        assert_eq!(p.balance.0, 10);
        assert_eq!(p.completed, 1);
        assert_eq!(c.agent(&"buyer.testnet".parse().unwrap()).balance.0, 20);
    }
    #[test]
    #[should_panic(expected = "daily limit")]
    fn cumulative_limit() {
        let mut c = setup();
        post(&mut c);
        post(&mut c);
    }
    #[test]
    #[should_panic(expected = "per job limit")]
    fn per_job_limit() {
        let mut c = setup();
        ctx("buyer.testnet");
        c.post_job(
            "provider.testnet".parse().unwrap(),
            U128(11),
            "a".repeat(64),
            U64(1000),
        );
    }
    #[test]
    #[should_panic(expected = "wrong token")]
    fn forged_deposit() {
        let mut c = setup();
        ctx("attacker.testnet");
        c.ft_on_transfer(
            "owner.testnet".parse().unwrap(),
            U128(100),
            json!({"deposit_for":"buyer.testnet"}).to_string(),
        );
    }
    #[test]
    #[should_panic(expected = "buyer only")]
    fn unauthorized_release() {
        let mut c = setup();
        let id = post(&mut c);
        ctx("provider.testnet");
        c.deliver(id, "b".repeat(64));
        c.release(id);
    }
    #[test]
    #[should_panic(expected = "not delivered")]
    fn duplicate_release() {
        let mut c = setup();
        let id = post(&mut c);
        ctx("provider.testnet");
        c.deliver(id, "b".repeat(64));
        ctx("buyer.testnet");
        c.release(id);
        c.release(id);
    }
    #[test]
    fn dispute_refunds() {
        let mut c = setup();
        let id = post(&mut c);
        ctx("buyer.testnet");
        c.open_dispute(id);
        ctx("arbiter.testnet");
        c.resolve_dispute(id, false);
        assert_eq!(c.agent(&"buyer.testnet".parse().unwrap()).balance.0, 30);
        assert_eq!(c.agent(&"provider.testnet".parse().unwrap()).completed, 0);
    }
    #[test]
    #[should_panic(expected = "owner only")]
    fn runtime_cannot_change_policy() {
        let mut c = setup();
        ctx("buyer.testnet");
        c.set_policy(
            "buyer.testnet".parse().unwrap(),
            U128(100),
            U128(100),
            vec![],
            false,
        );
    }
}
