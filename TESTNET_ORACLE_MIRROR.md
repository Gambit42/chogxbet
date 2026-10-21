# Testnet oracle: mirroring mainnet Chainlink

Updated: 2026-10-21. Status: deployed to testnet 2026-10-21 (ChogDuel 0x917C532E8288ac1f6c557b6dF6Cb1B75318891A4); end-to-end test pending.

## Problem

Duels settle on Chainlink price feeds. On Monad testnet Chainlink only has BTC/USD and ETH/USD (plus LINK, USDT, USDC), and those update on a 0.5% move or every 24 hours, so a 5 minute duel can wait up to a day to settle. MON and SOL can't be offered on testnet at all.

Monad mainnet has all four feeds (MON, BTC, SOL, ETH), and they post a new round every 40 to 130 seconds (measured 2026-10-21 over the last 100 rounds).

## Alternatives checked (October 2026)

| Option | Why not |
|---|---|
| Chainlink testnet feeds | No MON or SOL; slow updates |
| Pyth (pull) | Hermes needs an API key since 2026-08-26; free trial, then paid |
| RedStone (pull) | Public gateways shut off 2026-10-29; API key required |
| Pyth on-chain prices on testnet (free to read) | Stale: MON last updated 21 days ago, BTC/SOL 36 hours ago |
| Price API (e.g. Coinbase) pushed on-chain | Not an oracle; fine for display, not for settling |
| Read mainnet from a testnet contract | Impossible; chains can't read each other |

## Solution

The settle cron copies the mainnet Chainlink rounds each testnet duel needs into a testnet contract that looks like a Chainlink feed.

```
Monad mainnet                         Monad testnet
Chainlink MON/BTC/SOL/ETH  ──cron──▶  FeedMirror (one per asset) ──▶ ChogDuel.settle
        │                                                              ▲
        └──── browser reads live price for the create form ────────────┘ (display only)
```

1. **`contracts/src/testnet/FeedMirror.sol`**, one per asset. Exposes Chainlink's `getRoundData`, so `ChogDuel` doesn't change. Only the settler wallet can `push`, and a round can't be changed once set. Stores mainnet's exact round ID, answer and timestamp, so anyone can check it against mainnet.
2. **`contracts/script/DeployDuel.s.sol`** deploys the 4 mirrors (updater = `SETTLER_ADDRESS`) and a `ChogDuel` that allowlists them.
3. **`scripts/settle.mts`**, on testnet only, for each accepted duel past its deadline:
   - find the first mainnet round at or after the deadline (`findRound` on the mainnet feed),
   - copy that round and the one before it into the mirror (2 transactions, skipped if already copied),
   - settle as today.
4. **Create form**: the live price reads mainnet Chainlink from the browser on both networks. Free, no transactions.
5. **`src/features/betting/networks.ts`**: testnet `feeds` become the 4 mirror addresses after deploy.
6. **Mainnet**: unchanged; `ChogDuel` reads Chainlink directly.

### Why only 2 rounds per duel

`settle(id, roundId)` checks the named round (at or after the deadline) and the round before it (before the deadline). Nothing else is read. Copying every mainnet round instead would be about 17 transactions per 5 minute cron run, roughly 37 testnet MON a day at 102 gwei; the settler holds 20.

### Settlement speed

Up to ~2 minutes for mainnet to post a round after the deadline, plus up to 5 minutes for the next cron run.

### Trust

On testnet the settler wallet is trusted to copy honestly. It can't edit a copied round, and every copy can be checked against mainnet's `getRoundData(roundId)`. Mainnet doesn't trust it at all.

## Env

| Variable | Where | Purpose |
|---|---|---|
| `SETTLER_ADDRESS` | local `.env` (deploy only) | Public address of `SETTLER_PRIVATE_KEY`; the only wallet allowed to push to the mirrors |
| `MAINNET_RPC_URL` | Railway, optional | Mainnet RPC the cron reads Chainlink from; defaults to the public one |

## Rollout

- [x] `FeedMirror.sol`
- [x] Deploy script deploys mirrors + escrow
- [x] `SETTLER_ADDRESS` in `.env` / `.env.example`
- [x] Rewrite `settle.mts` relay to 2 rounds per duel
- [x] Update `test_feedMirror` for the final contract
- [x] Form price reads mainnet Chainlink
- [ ] `npm run deploy:duel`, then put the mirror addresses in `networks.ts` and the escrow address in `.env` (`NEXT_PUBLIC_DUEL_ADDRESS`) and Railway (`DUEL_CONTRACT_ADDRESS`)
- [ ] End-to-end: create a 5 min duel, accept, wait for the cron, claim
