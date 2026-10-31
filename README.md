# CircuitsAI

CircuitsAI gives agents a NEAR account, restricted runtime authority, USDC job escrow, cross-chain payment routing, and verified private inference. Humans retain the full-access keys. Runtime keys have finite gas allowances, and the contracts enforce payment limits before funds or signing authority are used.

Primary tracks: **Agent Economy** (`agents`) and **AI Security & Defense** (`security`). Prize payout account: **hackcat.near**.

[Open the live demo](https://hackcat29.github.io/CircuitsAI/) · [Watch the 30-second browser walkthrough](https://github.com/hackcat29/CircuitsAI/blob/main/docs/near/demo.mp4)

## What is new

Circuits existed on other chains before this integration. Its prior marketplace, web UI, runtimes, contracts, and SDKs are baseline work, not new NEAR work. This repository was exported into a new Git history without the private repository's history, environment files, seed wallets, local databases, or embedded demo signing keys.

The [`pre-hackathon-baseline`](https://github.com/hackcat29/CircuitsAI/tree/pre-hackathon-baseline) tag records the cleaned baseline. Review the [NEAR integration diff](https://github.com/hackcat29/CircuitsAI/compare/pre-hackathon-baseline...main). New NEAR work lives in `packages/contracts-near`, `packages/near`, `scripts/near`, and the NEAR integrations in the web, custody, and hosted-runtime packages.

| Upgrade | Implementation |
| --- | --- |
| NEAR agent accounts | Owner-controlled sub-accounts, separate full-access and scoped runtime keys, finite gas allowance, owner pause and runtime-key deletion. |
| Chain Signatures | Each agent's own wallet contract reconstructs an EIP-1559 ERC-20 transfer, checks token/recipient/amount/nonce/fees, then calls NEAR MPC. Foreign private keys are not held by the server for these wallets. |
| Agent commerce | Configured NEP-141 token deposits; per-job/daily caps; approved providers; escrow, delivery, release, disputes, refunds, earnings withdrawal and completion counts. |
| NEAR Intents | Supported-mainnet-token discovery; dry quotes by default; exact-output USDC service invoices; confirmed destination receipts and one-use service payments. The old runtime swap action now routes through Intents. |
| NEAR AI Cloud | An opt-in foundation-model provider; encrypted inference through the official SDK; model TEE response-signature verification; existing credit billing; attestation/signature evidence on agent pages. |

Function-call allowance is a **gas** budget. It does not limit USDC spending. Commerce and signing contracts enforce the monetary limits separately.

## Reproduce the demo

Prerequisites: Node **24.22.1+**, pnpm **9**, Rust **1.94.1+**, and the `wasm32-unknown-unknown` Rust target. macOS ARM64 or Linux x86-64 is required by the sandbox binary. The first run downloads pinned dependencies and NEAR Sandbox **2.13.4**.

The public Pages app in `apps/near-demo` reads testnet state directly and uses wallet-approved transactions. It does not host owner keys or consume inference credits. The existing full Circuits app includes the service invoice and agent-credit integrations.

```sh
pnpm install --filter @clawdhq/near... --frozen-lockfile
rustup target add wasm32-unknown-unknown
pnpm near:demo
```

The demo starts a real isolated NEAR blockchain and deploys the compiled WASM contracts. Its USDC is explicitly a local mock token. It needs no wallet, secret, API key, external database, or real funds. It creates fresh ephemeral keys every run and tears the chain down afterward.

| Do this | See this |
| --- | --- |
| Run `pnpm near:demo` | Nine `PASS` lines and `near-demo-state/report.json`. |
| Create two agent accounts | Full-access owner keys and finite function-call runtime keys are installed. |
| Try an administrative method or another receiver with a runtime key | The NEAR protocol rejects the transactions. |
| Deposit 1 mock USDC through `ft_transfer_call` | The buyer's escrow balance becomes 1 USDC. |
| Try an excessive job budget or unapproved provider | The commerce contract rejects it. |
| Fund work, deliver it, release once | Provider earns 0.1 USDC and one completion; early/duplicate release fail. |
| Withdraw provider earnings | The token balance reaches the provider's own account. |
| Dispute a second job and resolve for the buyer | Escrow is refunded; disputed work cannot be released. |
| Check the foreign-transfer hash and an unapproved destination | WASM matches the viem EIP-1559 reference hash and rejects the destination. |
| Delete the buyer runtime key | The old runtime stops transacting; the owner's full-access key remains. |

Public MPC signatures, Intents settlement, and paid NEAR AI inference are separate live checks. The local demo reports them as skipped; it does not substitute fake signatures or attestations for live integrations.

Additional checks:

```sh
pnpm --filter @clawdhq/near typecheck
pnpm near:unit
pnpm near:test
```

The SDK has 16 tests, including private-inference failure handling. The Rust contracts have 15 tests.

## Live testnet demo

Owner and commerce contract: [`circuitsai-hackcat.testnet`](https://testnet.nearblocks.io/address/circuitsai-hackcat.testnet).

Agent wallet: [`alpha.circuitsai-hackcat.testnet`](https://testnet.nearblocks.io/address/alpha.circuitsai-hackcat.testnet).

Test-only USDC: [`usdc.circuitsai-hackcat.testnet`](https://testnet.nearblocks.io/address/usdc.circuitsai-hackcat.testnet). This is not Circle-issued USDC and has no monetary value.

The [public deployment receipts](https://github.com/hackcat29/CircuitsAI/blob/main/docs/near/evidence/testnet-deployment.json) document exactly what succeeded. A live testnet MPC signature was verified for the agent-derived Base Sepolia address; its synthetic transfer was not broadcast. A [live mainnet dry quote](https://github.com/hackcat29/CircuitsAI/blob/main/docs/near/evidence/intents-dry-quote.json) returned no deposit address. One [private inference](https://github.com/hackcat29/CircuitsAI/blob/main/docs/near/evidence/inference-verification.json) returned `ok` with a verified `provider_tee` signature and `UpToDate` attestation, using 19 input and 37 output tokens. For this faucet-funded deployment, the owner/commerce account also serves as the provider, using a separate function-call key restricted to provider methods. The reproducible sandbox demonstrates two separate agent wallet sub-accounts.

Hosted demo: [hackcat29.github.io/CircuitsAI](https://hackcat29.github.io/CircuitsAI/). The Pages deployment reads live testnet account state, links the commerce and MPC receipts, previews live Intents dry quotes, and displays the verified inference evidence. Run the existing Next.js web app locally and open `/app/near` for the integrated application. Public contract settings are in `docs/near/env.example`. No production deployment is implied by the testnet receipts.

## Intents payment checks

NEAR Intents has no testnet. A dry quote makes a live mainnet API request but does not create a deposit address or transfer tokens:

```sh
pnpm --filter @clawdhq/near demo tokens
pnpm --filter @clawdhq/near demo quote --origin ASSET_ID --destination USDC_ASSET_ID --recipient PROVIDER_ADDRESS --refund-to SOURCE_REFUND_ADDRESS --amount-micros 1000000
```

Select asset IDs from the returned token list. A service provider's receive asset, chain, USDC contract, recipient, and price are pinned on the server. Sign in, open a supported mainnet service, and use **Pay from another token or chain · NEAR Intents**. Preview a dry quote, create an invoice, fund it from the source chain, then verify settlement and call the service. Both the solver's result and the confirmed destination-chain USDC receipt must match. A source deposit or quote alone never unlocks a service.

The swap action requires `NEAR_INTENTS_ENABLE_EXECUTION=true`. A NEAR-backed agent's owner must separately approve a quote's deposit address in the on-chain signing policy. The runtime cannot add recipients automatically. A real tiny mainnet trade still requires funding and authorization; none is claimed by the local demo.

## Private inference checks

Choose **NEAR AI · Verified private inference** in the foundation-model selector, or set `HOSTED_RUNTIME_PLATFORM_PROVIDER=NEAR_AI`. Set `NEAR_AI_API_KEY` privately. Responses use the existing prepaid inference-credit ledger. Missing credentials, stale/invalid attestation, signature mismatch, or gateway-only signatures fail closed; this path does not send the prompt to an alternate provider.

```sh
pnpm --filter @clawdhq/near demo infer --prompt "Reply with the word ok." --use-credits yes
```

After a hosted agent response, its Overview page shows the model, completion ID, verification time, and expandable attestation/signature evidence. Private prompts and completion text are not stored in the evidence table. When direct Intel collateral endpoints are unreachable, `NEAR_AI_PCCS_URL=https://cloud.near.ai/api/proxy/pccs` uses NEAR's official collateral mirror with the same cryptographic checks.

The SDK verifies hardware evidence and response binding; deployment-code provenance is shown as reported by the SDK and is not claimed as an independent code audit.

## Owner keys and deployment

Full-access owner credentials stay in the human's terminal wallet, outside the repository and server environment. `scripts/near/create-owner.mjs` creates a testnet owner through the official faucet and stores its credential with mode `0600` under `~/.near-credentials/testnet`. Provisioning accepts an owner's public key; the runtime uses a different function-call key.

`scripts/near/deploy-testnet.mjs` is an owner-side, faucet-funded demo deployment. It is not part of the hosted runtime. Runtime credentials are saved separately outside the repositories. It does not use the mainnet prize-payout key.

For existing Circuits registrations, NEAR custody is an explicit provisioning mode. Existing LOCAL/CIRCLE wallets are retained; their balances and immutable on-chain wallet bindings are not silently migrated. The foreign signing adapter supports policy-approved ERC-20 transfers. Arbitrary contract calls, approvals, typed-message signatures, Solana and Sui signing are not implemented by this adapter.

The commerce contract uses a designated arbiter, and its deployment keys remain owner-controlled. These are prototype contracts, not audited contracts. Test with small amounts.

## Product scope and data

Launchpad routes/APIs, token navigation, buyback scheduling and token-swap indexing are retired. Degen pages and new trading APIs are hidden (owner withdrawal and emergency-stop safety actions are retained), and hosted trading actions are disabled. Database rows are retained. Arc removal was part of the existing source snapshot. The original private repository is not made public, and production is not redeployed by this submission export.

## Libraries, templates and AI assistance

The baseline uses Next.js/React, Tailwind, Prisma/PostgreSQL, viem, Vercel AI SDK and the existing Circuits packages. NEAR work uses `near-sdk` 5.28.0, `near-api-js` 7.4.0, `near-sandbox` 0.3.4 / node 2.13.4, `@nearai/inference-sdk` 0.2.1, `@hot-labs/near-connect` 0.12.0, viem, bs58, Zod, Vitest and tsup. Dependency versions and Rust transitive dependencies are locked. No external application template was added for the NEAR integration.

Existing Circuits components were built with Claude Code. The new NEAR implementation, integration, tests and documentation were developed with Codex. Baseline code is disclosed rather than claimed as new hackathon work. Source license: MIT; dependencies retain their own licenses.

## Submission

One project, tracks `agents` and `security`, payout account `hackcat.near`. The X demo post and final submission are not sent automatically. Read the live [HACKATHON.md](https://nearhackathon.com/HACKATHON.md) before submitting. Draft post text and a recording sequence are in `docs/near/SUBMISSION.md`.
