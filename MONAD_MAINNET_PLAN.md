# ChogXBet: Monad mainnet deployment plan

Updated: 2026-10-20. Status: implementation plan; nothing deployed.

## Recommended first release

Build one-to-one, equal-stake $CHOG duels on Monad. Each duel predicts whether an allowlisted asset's USD price is above or below a target at a specified UTC deadline. Use Pyth for authenticated price evidence, an escrow contract for custody and payout, a settlement worker for timely transactions, and public duel URLs for X/Twitter sharing.

Start with one verified feed, then enable BTC/USD, ETH/USD, SOL/USD and MON/USD individually after integration tests. $CHOG is the stake currency; it does not need a CHOG/USD oracle unless the product also offers CHOG price predictions or USD-denominated stakes.

## What exists in this repository

| Area | Current state | Required work |
| --- | --- | --- |
| `/` landing page | Promotional copy and sample duels | Replace sample activity and inaccurate settlement claims |
| `/app` | `src/features/betting/betting-app.jsx` uses local React state | Connect wallet, contracts, persistent duel reads and transaction receipts |
| Wallet and balances | Simulated connection, address and balance | Real provider discovery, chain switching, token/NFT balances |
| Create/accept | Buttons toggle flags | Approval, escrow transactions, rejection/revert handling |
| Settlement | Copy only | Contracts, authenticated oracle evidence, worker and claims |
| Sharing | Promotional preview | Stable public routes, metadata, copy link and share composer |
| Dependencies | Next.js/React/UI packages | No wallet, oracle or contract tooling currently installed |

There are no Solidity contracts, deployment scripts or backend settlement services in the inspected source. The README's “homepage is blank” description is outdated. Existing UI tests do not establish financial correctness.

## Rules to freeze before implementing contracts

These are proposed v1 defaults, not existing behavior:

- A duel stores creator, optional designated opponent, token, stake, feed ID, direction, integer target, acceptance cutoff, settlement deadline, oracle policy and status. Terms cannot change after creation.
- Both wallets must hold the verified Chog NFT collection when creating/accepting. Later NFT transfers must not block payout or refunds. Verify whether the collection is ERC-721 or ERC-1155 before choosing the check.
- The first eligible wallet to match the stake wins the open seat. Reject self-acceptance, expired calls and duplicate acceptance. Restricted duels check the opponent wallet on-chain; an X handle alone cannot identify the wallet.
- Use exact UTC timestamps, including year. Require an acceptance cutoff before settlement (proposed minimum gap: five minutes) so a user cannot accept after seeing the outcome. Show the remaining economic advantage of accepting near the cutoff; creators must choose appropriate terms.
- Support **price at deadline** only. Replace “touches,” “dips before,” and ambiguous “by” claims in current samples. A path-dependent bet needs authenticated interval evidence and a separate settlement design.
- Creator wins if their strict comparison is true. Opponent wins if the inverse strict comparison is true. Exact equality refunds both stakes with no burn. Display this tie rule before either deposit.
- For a winning outcome, compute burn as `floor(totalPot * 500 / 10000)` in token base units; winner receives the remainder. A 50,000 CHOG pot yields 47,500 CHOG to the winner and 2,500 CHOG to the dead address. The winner's net profit on a 25,000 stake is 22,500, not 47,500.
- Sending tokens to the dead address is the currently advertised behavior. It does not necessarily reduce ERC-20 `totalSupply`; verify token behavior and describe it accurately.
- Creator may cancel an unaccepted duel. Once the acceptance cutoff passes, anyone may trigger its refund to the creator. Accepted duels cannot be cancelled by a participant.
- Accepted duels have a fixed evidence-submission expiry (proposed: deadline plus 24 hours). Settlement is allowed before expiry; after expiry an unresolved duel refunds both stakes. Mutually exclusive time checks prevent a settlement/refund race from selecting different outcomes. This is a liveness tradeoff: outages can void an otherwise decidable bet, so disclose it.

## Oracle choice and dependencies

Monad lists Pyth, Chainlink, RedStone and other providers. Provider presence does not prove that a particular feed or historical settlement method is suitable. [Monad oracle directory](https://docs.monad.xyz/tooling-and-infra/oracles).

| Option | Fit for this app | Decision |
| --- | --- | --- |
| Pyth Core pull integration | Submit signed evidence for a fixed publication time | Recommended, subject to a Monad integration proof |
| Chainlink Price Feeds | Push feeds; a latest round does not establish the deadline price | Alternative only after defining round selection and verifying coverage |
| Chainlink Data Streams / RedStone | Other authenticated price delivery options | Evaluate if Pyth cannot meet feed or historical-data requirements |
| DEX spot price / ordinary price API | Useful for display; unsuitable as an unauthenticated settlement input | Do not use for v1 settlement |
| VRF | Randomness | Unnecessary for deterministic price challenges |

Pyth's current integration documentation requires a Hermes API key following its August 2026 upgrade. Use current addresses and endpoints, not older tutorials. Keep the key server-side. [Pyth upgrade guide](https://docs.pyth.network/price-feeds/core/upgrade/preparing).

### Deadline settlement proof

1. Pin a feed ID and oracle address per market/deployment. Freeze the applicable policy for each duel.
2. Proposed policy: use the first published update at or after deadline `T`, within `[T, T + 60 seconds]`. This is a bounded oracle publication window, not a promise of a tick at the exact second.
3. Fetch signed historical evidence through the supported Pyth service. Verify the deployed Monad implementation supports `parsePriceFeedUpdatesUnique`; it enforces the first update across the boundary. Plain `parsePriceFeedUpdates` permits selection within a window. Calculate the native fee with `getUpdateFee`. [Pyth unique-update reference](https://api-reference.pyth.network/price-feeds/evm/parsePriceFeedUpdatesUnique).
4. On-chain, verify the stored feed ID, publication bounds, positive price, permitted exponent range and confidence limit. Normalize target/price with checked integer arithmetic, never browser floating point. Proposed confidence bound: 100 basis points, to validate per feed before launch.
5. If the unique update fails the confidence policy, do not let a caller choose a later favorable tick. Leave unresolved until the fixed refund expiry, unless a separately audited deterministic invalid-outcome rule is implemented.
6. Store the resolved price and publication timestamp and emit them with the outcome. Calls made hours later must resolve using deadline evidence, not a fresh price at transaction time.

The contract verifies evidence; the worker does not choose the winner. Prove historical evidence availability, retention, authentication, fees and unique-boundary behavior on the actual Monad contract before committing to this design. Archive the signed bytes around each deadline so retries survive upstream retention limits. A stored JSON price is not a proof. See [Pyth API reference](https://docs.pyth.network/price-feeds/core/api-reference) and [fetching updates](https://docs.pyth.network/price-feeds/core/fetch-price-updates).

Monad documents MON/USD on Pyth's primary contract, with feed ID `0x31491744e2dbf6df7fcf4ac0820d18a609b49076d45066d3568424e62f686cd1`; the old beta integration must not be reused. Reconfirm this and all other feed IDs during deployment. [MON/USD support notes](https://docs.monad.xyz/tooling-and-infra/oracles).

### Minimal additions

| Dependency/service | Purpose |
| --- | --- |
| `viem`, `wagmi`, `@tanstack/react-query` | Typed contract access, wallet lifecycle and query state; verify compatible versions before installation |
| WalletConnect connector/project ID | Optional QR/mobile connection beyond injected wallets |
| Foundry, OpenZeppelin Contracts | Solidity build, deployment, tests, safe token transfers and reentrancy protection |
| `@pythnetwork/pyth-sdk-solidity` | Contract interface for Pyth; pin a compatible release |
| Server-side Hermes HTTP access | Signed update retrieval; add an SDK only if useful |
| Dedicated Monad RPC plus fallback | Reads, event indexing, transaction broadcast and receipts |
| Postgres and one worker process | Durable event cursor, duel queries, retries and evidence archive |
| Next.js hosting and HTTPS domain | UI, public duel pages, metadata and bounded API endpoints |
| Funded settlement wallet | MON for gas and oracle fees; no authority over escrow outcomes |

Pyth documents its Solidity package and Foundry integration in the [EVM guide](https://docs.pyth.network/price-feeds/core/use-real-time-data/pull-integration/evm). No X API package is needed for the proposed manual share flow.

## Contract and backend implementation

Use one non-upgradeable escrow deployment for v1. Suggested operations: `createDuel`, `acceptDuel`, `cancelOpenDuel`, `refundExpiredOpenDuel`, `settleDuel`, `refundUnresolvedDuel`, and `claim`. Emit events for every lifecycle transition and withdrawal.

Use SafeERC20, checks-effects-interactions and reentrancy protection. Verify the actual CHOG contract has compatible transfer behavior; reject fee-on-transfer/rebasing assumptions by checking received balance deltas. Parse all amounts as base-unit integers. Validate stake/target bounds and timestamps in the contract, not just the form.

Credit payouts/refunds for independent withdrawal so a failed recipient transfer cannot block other duels. Track burn obligations separately and process them exactly once. Maintain the invariant that token balance covers active escrows plus unclaimed payouts/refunds and pending burn. Admins must not withdraw liabilities or rewrite accepted terms. Limit pausing to new deposits/acceptance; preserve settlement and recovery paths.

Run a worker that indexes finalized events from the deployment block, checkpoints progress, deduplicates logs by chain/transaction/log index and can rebuild its database. Handle provider limits, missed logs and reorg recovery. The database is a read model; contract state is authoritative.

The same worker schedules deadlines, archives evidence, submits settlement, retries failures and alerts on overdue duels or low MON balance. Make settlement permissionless and expose a user-triggered fallback. Timers in an open browser are insufficient. A cron endpoint is acceptable only if its cadence, execution duration and retry guarantees meet the chosen deadlines.

## X/Twitter sharing and challenge links

1. After a successful creation receipt, extract the on-chain duel ID and generate a canonical URL such as `/duels/143/<escrow-address>/<duel-id>`. Including chain and contract avoids collisions across deployments.
2. Public pages render without wallet login. Read canonical terms, show exact UTC deadline, cutoff, tie/refund rule, stake and settlement policy. Re-read state before enabling acceptance. Display accepted, settled, refunded and invalid-link states.
3. Add Copy link and a user-opened X composer using `https://twitter.com/intent/tweet` with URL-encoded text and canonical URL. The user reviews and publishes. Smoke-test desktop and mobile behavior before release; the legacy X intent documentation currently redirects to the general docs.
4. Generate server-rendered Open Graph/Twitter metadata and a share image with claim, stake and Chog artwork. Use the installed Next.js conventions for `opengraph-image` / `twitter-image` and `summary_large_image`. Keep immutable terms on cached cards; the destination page shows live availability.
5. Test direct navigation, crawler access, image URLs and real X/Discord previews on the deployed HTTPS domain. A client-side modal alone cannot provide a reliable share preview.

Do not label a duel “posted” merely because the composer opened. Posting automatically, linking X identity to a wallet, verifying a post, or rewarding engagement would be a separate feature requiring applicable X API access, user authorization, durable identity binding and anti-abuse rules. No price oracle verifies Twitter shares. Check current access and pricing if adding that scope: [X developer platform](https://docs.x.com/overview).

Next.js reference inspected locally: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md`. Read the installed routing/metadata guides before implementation, as required by AGENTS.md.

## Deployment configuration

Monad mainnet uses chain ID **143**, gas token **MON**, and public RPC `https://rpc.monad.xyz`. Users need MON separately from their CHOG stake. Verify the RPC's `eth_chainId` before any deployment. Use separate testnet configuration, never a reused address file. [Monad developer organization](https://github.com/monad-developers/), [network documentation](https://docs.monad.xyz/developer-essentials/network-information).

Record a versioned deployment manifest containing chain ID, contract addresses, deployment block, transaction hash, ABI, compiler settings, source commit, feed IDs and frozen risk parameters. Resolve oracle addresses from provider documentation and the [Monad protocol registry](https://github.com/monad-crypto/protocols), then verify bytecode and interfaces on-chain. CHOG token and Chog NFT mainnet addresses remain unverified blockers.

| Configuration | Location |
| --- | --- |
| Public origin, chain ID, escrow/token/NFT addresses, WalletConnect project ID | Public application configuration |
| RPC credentials, Hermes URL/API key, database URL | Server/worker secrets |
| Settlement signer credential | Worker secret store, with limited funded balance |
| Deployer/admin signing material | Deployment signing environment; never Next.js or source control |
| Feed allowlist, acceptance gap, publication window, expiry, confidence cap, stake cap | Contract parameters and deployment manifest |

The 5% burn is not operating revenue. Budget separately for hosting, database, RPC, oracle access, worker gas/update fees, monitoring and contract review. Obtain current provider quotes after measuring testnet usage; do not assume public endpoints or oracle access are unlimited/free.

## Ordered rollout and completion gates

### 1. Resolve deployment blockers

- [ ] Verify CHOG and Chog NFT addresses, interfaces, decimals and transfer behavior.
- [ ] Approve the proposed duel rules and timing/confidence limits.
- [ ] Prove one historical Pyth settlement on Monad; confirm remaining feed IDs before enabling them.
- [ ] Choose domain, RPC, worker/database host and operating budget.

### 2. Build and test escrow

- [ ] Implement lifecycle, custody, burn accounting, claims and refunds.
- [ ] Test duplicate acceptance/settlement/claims, self-acceptance, NFT eligibility and restricted opponents.
- [ ] Test cutoff/deadline/expiry boundaries, equality, malformed proofs, wrong feeds, invalid confidence, exponents and rounding.
- [ ] Fuzz accounting invariants; test malicious token callbacks and failed transfers.
- [ ] Verify no administrator path can drain deposits or change accepted outcomes.

### 3. Complete a testnet vertical slice

- [ ] Deploy verified contracts; run create → share → accept → settle → claim with two real wallets.
- [ ] Replace simulated data/actions in `betting-app.jsx`; handle pending, rejected, replaced and reverted transactions.
- [ ] Separate ERC-20 approval and deposit steps; use bounded allowances and show gas requirements.
- [ ] Implement public duel pages, share cards, event indexing and durable settlement retries.
- [ ] Exercise unmatched refunds, tied outcomes, oracle outages, worker restarts and user-triggered settlement.
- [ ] Update landing copy, sample statistics and README to reflect actual behavior.
- [ ] Run Solidity tests, existing UI tests, lint/build and end-to-end wallet flows. Read local Next.js guides before changing framework code.

### 4. Mainnet release

- [ ] Review contracts independently; resolve findings affecting custody and outcomes.
- [ ] Deploy and verify source; record the manifest and confirm chain/address/config consistency.
- [ ] Fund worker with MON; configure secret storage, alerts, backup RPC and database recovery.
- [ ] Deploy the web app and worker independently; verify HTTPS and public previews.
- [ ] Run a small-value mainnet duel and refund scenario before opening access.
- [ ] Launch with an on-chain stake cap and limited enabled markets; expand after observing complete settlement cycles.

### 5. Operating procedure

Monitor overdue duels, proof-fetch errors, indexer lag, failed claims and worker balance. On incidents, pause new deposits, preserve settlement/refunds and publish status. Frontend rollback does not roll back contracts: a replacement deployment needs a new manifest and must retain access to old claims/refunds. Never switch an existing duel to a different price source to resolve an outage.

The first implementation milestone is one real testnet duel with a verified feed and complete refund path. X sharing follows once its public link points to persistent on-chain state.
