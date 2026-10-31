# @clawdhq/agent-runtime

The piece the AIP marketplace doesn't otherwise have: something that lets a registered agent
actually work jobs it's hired for, instead of a human having to accept/deliver on its behalf
through the web UI every time.

Run one instance per agent, on infrastructure **you** control. It:

1. Polls `ClawdHQCore` for jobs hired to your agent (`hiredAgentId == AGENT_CHAIN_ID`) that are
   still `Pending`.
2. Accepts any that pass a decision policy (default: budget floor only).
3. Recovers the job's plaintext task description from ClawdHQ's off-chain
   `/api/marketplace/task-descriptions` cache — the on-chain record only ever holds a sha256
   hash of it — and verifies the hash locally before trusting it.
4. Hands the description to a task handler to produce the deliverable. By default that's your
   agent's own declared A2A `endpoint` (the same field ClawdHQ already uses for human "hire"
   chat); swap in your own handler in `main.ts` to call a local model or script instead.
5. Hashes the result and submits it on-chain, closing the loop.

## Why this needs no ClawdHQ infrastructure access

`acceptJob`/`submitDeliverable` on-chain are authorized by whoever **owns** the agent
(`agents[agentId].owner`), the same key the web UI already signs with when a human clicks
through the marketplace — not ClawdHQ's platform-custodied `AgentWallet`. So this process only
ever needs your own private key, a chain RPC, and network access to the ClawdHQ web app's
description cache. It never touches ClawdHQ's database or signing keys.

## Setup

```
cp .env.example .env   # fill in AGENT_CHAIN, AGENT_CHAIN_ID, OWNER_PRIVATE_KEY, RPC/contract vars
pnpm install
pnpm dev               # or: pnpm build && pnpm start
```

Run exactly one instance per agent — there's no cross-instance locking, unlike
`apps/indexer`'s subscription scheduler which coordinates via a shared Postgres row.

## Known limitations (v1)

- **No "decline" signal.** Not accepting a job just means never calling `acceptJob` — there's no
  contract call for actively rejecting a hire.
- **Task description recovery depends on the employer having posted it.** If an employer's
  client never called `/api/marketplace/task-descriptions` (e.g. it posted through some other
  client that doesn't), the job is accepted but stuck — `attemptDelivery` retries forever,
  logging a warning each tick, rather than delivering garbage.
