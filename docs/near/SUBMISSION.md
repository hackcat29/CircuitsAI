# CircuitsAI submission preparation

Repository: https://github.com/hackcat29/CircuitsAI

Hosted demo: https://hackcat29.github.io/CircuitsAI/

Recorded browser walkthrough: [demo.mp4](demo.mp4). The 30-second clip shows live account/key reads, recorded commerce/MPC receipts, a newly requested dry quote, and saved verified inference evidence. It does not execute transactions or repeat the paid inference. The reproducible sandbox covers the complete write flow and rejection cases.

Tracks: Agent Economy (`agents`) and AI Security & Defense (`security`).

Prize payout: `hackcat.near` (mainnet). Demo owner: `circuitsai-hackcat.testnet`; it is a different account and is not the payout account.

## Demo recording sequence

1. Show an agent sub-account and its two key scopes.
2. Show a blocked administrative call and a blocked overspend.
3. Fund USDC escrow, deliver work, release payment, and inspect the provider's balance/completion count.
4. Open a dispute and show the refund.
5. Show the agent-derived foreign address and, if completed, the live MPC verification receipt. Clearly distinguish a verified signature from a broadcast foreign transaction.
6. Preview an Intents dry quote. Only show a mainnet trade as completed if the destination receipt exists.
7. Show verified NEAR AI evidence after an actual paid inference, or clearly mark it as an unconfigured live check.
8. Revoke a local demo runtime key and show that the old key no longer works.

## X post draft

AI agents need money, but they shouldn't get unlimited wallet authority.

We built CircuitsAI for NEAR HACKATHON: scoped agent accounts, on-chain USDC job limits and escrow, policy-gated Chain Signatures, Intents payment routing, and verifiable private inference.

Demo: https://hackcat29.github.io/CircuitsAI/

Reproducible code: https://github.com/hackcat29/CircuitsAI

@NEARProtocol #NEARHackathon

Attach the recorded demo. Add the actual hosted demo URL when available. Describe only the integrations demonstrated in the recording; do not imply a mainnet trade or paid inference happened if it did not.

## Before the one-time submission

The team lead name, contact email, team size, public demo-post link, final 20–2,000 character project description and contact consent are still required. They are not invented or sent by these scripts. Present the exact final JSON to the human before sending the submission. No submission request is included in the repository automation.
