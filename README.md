# ChogXBet

1v1 price duels for Chog holders on Monad. Make a call ("MON above $0.05 by Oct 23, 12:00 UTC"), stake MON or $CHOG, and anyone who disagrees matches the stake to take the other side. At the deadline a Chainlink price decides the winner, who takes the pot minus a 5% fee. On $CHOG duels the fee is burned; on MON duels it goes to a $CHOG buyback treasury.

Built for a hackathon, running on **Monad testnet**.

## How it works

1. **Get set up.** Log in with Privy, then use the faucet at `/app/faucet` to mint test $CHOG and a test Chog NFT. You need a Chog to play.
2. **Make a call.** Pick an asset (MON, BTC, SOL, ETH), above or below a target, a deadline and a stake, and pick which of your Chogs enters. Leave the seat open to any Chog holder, or challenge one specific Chog.
3. **Share it.** Every duel has its own page with a generated share card (`/og`) for X and Discord previews. Cards are cached, so a link that has been previewed once loads instantly after that.
4. **Take a call.** Browse open calls in the Arena, pick the Chog you enter with and match the stake (a challenge is taken with the challenged Chog). Seats close 30 seconds before the deadline.
5. **Settle.** After the deadline, the settle bot submits the first Chainlink round at or after it. The contract checks it really is that round and pays the winner. A tie refunds both stakes with no fee.
6. **Claim.** Winnings and refunds wait in the escrow until you claim them from the duel page. If a duel isn't settled within 24 hours, either player can refund both stakes.

Each result is recorded on-chain against the Chogs that entered, not just the wallets. Tap a Chog on your profile to see its record: wins, losses, ties, win rate and every duel it played.

The creator can cancel an open call that nobody has taken yet, and reclaim the stake if no one takes it before the deadline.

## Contracts (Monad testnet)

| Contract | Address |
| --- | --- |
| `ChogDuel` escrow | `0xaeBbCAC97d50488bc63172295e99C78b8F4743c0` |
| `LastWord` (10 $CHOG burned or 1 MON per player) | `0x6bF4AFE60BF2077E54f0D5AeeaA9E785BCE2ae96` |
| `MockChog` ($CHOG) | `0x7D62c6fcb324a7a2434697d84Af40671ECA23E9f` |
| `MockChogNFT` (Chog Genesis) | `0xDE7f6E711B4f966963a7d974e82cf1A8D43515F1` |
| FeedMirror MON / BTC / SOL / ETH | see `src/features/betting/networks.ts` |

Source lives in `contracts/src`, with tests in `contracts/test`.

### Prices on testnet

Testnet Chainlink has no MON or SOL feed, and its BTC/ETH feeds can go a day without updating. So duels settle on **mainnet** Chainlink prices instead: for each duel that needs settling, the settle bot copies the two mainnet rounds involved into a `FeedMirror` contract on testnet. A copied round can't be edited later, and you can check any of them against mainnet's `getRoundData`. Details are in [TESTNET_ORACLE_MIRROR.md](TESTNET_ORACLE_MIRROR.md).

## Stack

Next.js 16, React 19, Tailwind v4, Privy + wagmi/viem, Foundry, and Chainlink price feeds.

| Path | What |
| --- | --- |
| `src/features/betting` | Arena, make a call, duel page, my duels, share card, wallet |
| `src/features/faucet`, `src/features/profile` | Test token faucet, Chog profile |
| `src/app/og` | Share card images |
| `scripts/settle.mts` | Settle bot: settles every accepted duel past its deadline, then exits. Run it on a schedule (every 5 min) |

## Development

```sh
npm install
cp .env.example .env   # fill in NEXT_PUBLIC_PRIVY_APP_ID and the addresses above
npm run dev
```

Run the settle bot once against your `.env` (needs `SETTLER_PRIVATE_KEY`):

```sh
npm run settle:local
```

Deploy fresh testnet contracts with `npm run deploy:testnet` (mock $CHOG and NFT), then `npm run deploy:duel` (feed mirrors and escrow). Every variable is explained in `.env.example`.

## Checks

```sh
npm run lint
npm run build
forge test
node --test scripts/settlement.test.mjs
```
