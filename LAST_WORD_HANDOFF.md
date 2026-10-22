# Handoff: Chog entry, Last Word mode, app subdomain

## Deployment update

LastWord (v2) deployed on Monad testnet 2026-10-23 at `0x6bF4AFE60BF2077E54f0D5AeeaA9E785BCE2ae96`, block **73310416**, transaction `0x5c76a6e68601f4f6ef3910f0d01d331142724563d81d244efa68a8e4c4641cbe`. Each duel's fee is paid in the token the creator picks: 10 $CHOG per side (burned to 0x…dEaD) or 1 MON per side (to the treasury); the token is the last field of the `duels` getter. `LastWordChanged` now carries the dare text, so a settle transaction's logs show what the loser wears. It replaced v1 (`0x25c29511cd58b118B686397CF9513e8243157376`, MON only), whose 2 duels the app no longer shows. Local `.env`, README and `.github/workflows/settle.yml` point at v2. Checks before deploy: 19 Forge tests, TypeScript and ESLint. Hosted environment variables and two-wallet end-to-end verification remain outstanding.

## UI update (2026-10-23)

- **One card for both modes:** `DuelCard` (`src/features/betting/arena.tsx`) takes a `Duel` or an `LwDuel` (`"dare" in d`). A mode label sits on top (Real stakes / Last Word). Last Word cards show the dare under "Loser says" (one line, full text on hover) and "Seat closes" while open.
- **Arena:** the Open calls tabs are All / Real stakes / Last Word (the per-asset tabs are gone). Open dares now sit in that list; `src/features/lastword/open-dares.tsx` was deleted.
- **My duels** (`src/features/betting/my-duels.tsx`): **Active** (challenges to your Chogs, then your open, live and settling duels, as cards) and **History** (settled, expired, cancelled and refunded, as a table: result pill Won/Lost/Tie/..., your side, mode, date, outcome, View more). The page sends no transactions: "Claim", "Reclaim" and "Refund stakes" are labels that link to the duel page. Claim is per-token (`owed` is one total across duels), so it can also show on rows already claimed.
- **Skeletons:** the Arena and My duels load with card-shaped placeholders (`CardsSkeleton`).
- **Dare bubbles** cap at 3 lines (`line-clamp-3`, full text on hover). On the Wall cards the bubble hugs the top and the "Called ..." footer is pinned to the bottom.

Verified in a browser, logged out: the Arena card and tabs, and the Wall with temporary mock receipts (since removed), including a 60-character dare. My duels was only seen through the user's screenshot.

Written 2026-10-22 for the next agent. Hackathon build, **Monad testnet only**. Nothing here is committed yet. Read `AGENTS.md` first: this is Next.js 16 (Middleware is called **Proxy**, `src/proxy.ts`), so check `node_modules/next/dist/docs/` before changing routing.

## What the product is now

Two game modes behind one **Create** form:

- **Real stakes** (live): the `ChogDuel` escrow. Each side stakes MON or $CHOG and the winner takes the pot minus 5%. Each side enters with a Chog it holds, and the winning Chog is recorded on-chain (`winnerChog`).
- **Last Word** (deployed, see above): the separate `LastWord` contract. Each side pays a flat 10 $CHOG (burned) or 1 MON (to the treasury) on accept, in the token the creator picked, and there's no pot. The creator writes a dare of up to 60 bytes. The loser's Chog "wears" it until its next Last Word settlement: a win or a draw clears it, another loss replaces it. Settlement uses the same Chainlink feeds and FeedMirrors as `ChogDuel`.

## State of each piece

| Piece | State |
|---|---|
| `contracts/src/ChogDuel.sol` | Matches the **deployed** escrow `0xaeBbCAC97d50488bc63172295e99C78b8F4743c0` byte-for-byte (immutables masked; legacy pipeline, no optimizer = the committed `foundry.toml`). Do not change it; `foundry.toml` must stay as committed or bytecode verification breaks. |
| `contracts/src/LastWord.sol` + `contracts/test/LastWord.t.sol` | Done. `forge test`: 18/18 pass (13 ChogDuel + 5 LastWord). Deployed. |
| `contracts/script/DeployLastWord.s.sol` / `npm run deploy:lastword` | Ready. Reads `NEXT_PUBLIC_CHOG_NFT_ADDRESS`, `TREASURY_ADDRESS` and `FEED_MIRRORS` (comma-separated, the existing mirrors in `src/features/betting/networks.ts`) from `.env`. Fee hard-coded to 1 MON, which must match `LW_FEE` in `src/features/lastword/lastword.ts`. Signs with `--browser`, so the **user** runs it. |
| `scripts/settle.mts` | Settles ChogDuel as before. Also settles LastWord when `LASTWORD_CONTRACT_ADDRESS` is set. Checked once with no Last Word address, against the public RPC: "checked 1 duel duels, settled 0". That label now reads "stakes". Railway cron: add the env var to the existing service; no second service needed. |
| Frontend: Chog entry + Chog record | Done and typechecked (Create picker, accept picker, profile W/L/T + win rate). |
| Frontend: Last Word | Create mode bar (`?mode=stake` / `?mode=lastword`), duel page `/last-word/[id]` (accept / cancel / reclaim / result), the Last Word tab of the Arena's Open calls, Wall of Shame `/wall`, bubbles on public profiles. **No sample data remains**: with `NEXT_PUBLIC_LASTWORD_ADDRESS` unset, the Wall says "Last Word isn't live", bubbles render nothing, and the Create lock button is disabled. |
| Public profiles `/u/[address]` | Done. Opens anyone's Chogs; `?chog=7` opens that Chog's sheet. The Challenge button was removed: challenges spread by share link, and "Specific Chog" on Create still targets one Chog. Own profile `/profile` still exists with balances + profile-Chog pick. |
| App subdomain split | Done in code (`src/proxy.ts`), **not live**. Routes moved from `src/app/app/*` to the route group `src/app/(app)/*` (URLs lost the `/app` prefix). Landing moved to `src/app/landing/page.tsx`. |
| Header | Testnet badge under the name; `scrollbar-gutter: stable` in `globals.css`; landing and app headers are both 64.8px with the logo at x=184 (measured). The Arena tab was removed: the logo is home. |

Verified in a browser (logged out only; nobody could sign in from the agent side): Wall layout, Create mode bar + `?mode=` URL sync, public profile + sheet, header heights. **Not verified:** any wallet-connected flow, any Last Word transaction, the `/last-word/[id]` page (typecheck + lint pass).

## Routing (`src/proxy.ts`)

| Request | Result |
|---|---|
| `chogxbet.xyz/` (also `www.`) | Landing page (rewrite to `/landing`) |
| `chogxbet.xyz/<anything else>` | 307 to `app.chogxbet.xyz/<same path>`, dropping a leading `/app` (old share links keep working) |
| `app.*`, `localhost`, `127.0.0.1`, `*.vercel.app` | The app at root paths; `/app/...` gets a 307 that drops the prefix |

Local dev: `localhost:3000` is the app, and `localhost:3000/landing` is the landing page. Don't use `app.localhost`: Privy's embedded wallet refuses plain-http subdomains. Redirects are 307 on purpose; a few minutes of an earlier 308 version may be cached in the user's browser (clear the cache if `localhost:3000` jumps to `app.localhost`).

**Before pushing the split to production** (otherwise `chogxbet.xyz/app` redirects to a host that doesn't resolve):
1. Vercel: add the domain `app.chogxbet.xyz` to the project; DNS `CNAME app → cname.vercel-dns.com`.
2. Privy dashboard: add `https://app.chogxbet.xyz` to the allowed origins.

## Next steps, in order

1. ~~Deploy LastWord~~ done.
2. Set `NEXT_PUBLIC_LASTWORD_ADDRESS` and `LASTWORD_CONTRACT_ADDRESS` in the hosting env and in Railway (local `.env` and README are done).
3. Run the checks: `forge test`, `npx tsc --noEmit -p .`, `npx eslint src scripts`, `node --test scripts/settlement.test.mjs`. If routes moved, run `npx next typegen` first (stale `.next/types` cause false TS errors).
4. **Two-wallet end-to-end on testnet** (needs two wallets with test MON and a Chog each from `/faucet`):
   - Wallet A: `/create?mode=lastword`, a 5-minute deadline, write a dare, lock (1 MON). It should land on `/last-word/<id>`.
   - Wallet B: find it under the Last Word tab of Open calls on `/`, accept with a Chog (1 MON). The treasury should get 2 MON.
   - After the deadline: `npm run settle:local` (or wait for the cron). Check `lastWord(loserChog)` on-chain, the bubble on the loser's public profile, and the receipt on `/wall` ("Wearing it now" + "All receipts").
   - Second duel between the same Chogs, the other way round: the first loser's bubble clears, the receipt shows "Cleared", and the new loser wears the new line.
   - Also: cancel an open dare (1 MON back); an expired dare shows "Reclaim".
5. Commit in two parts so the domain split can be rolled back alone: (a) Chog entry + record (ChogDuel/ABI/profile, already staged), (b) Last Word + domain split + header fixes.

## Known gaps (not built)

- Last Word duels are not in the per-Chog **Record** on profiles (reads ChogDuel only). **My duels** lists both modes.
- Accepting a Last Word duel requires a connected wallet; the "Connect a wallet" onboarding overlay also covers the Create form, mode bar included.
- `useLastWordDuels` and `useDuels` read every duel each load (fine at hackathon volume).
- `LW_FEE` (frontend) and the 1 MON in the deploy script must be kept in sync by hand (the contract exposes `fee()` if you'd rather read it).

## Stashes (nothing lost)

- `stash@{0}`: unrelated extras (a "You won / You lost" badge on My duels, superseded by the History table; a faucet loading fix, a form reset after create). It's a full-tree snapshot, so apply selectively.
- `stash@{1}`: the original Last Word WIP. The contract, tests, deploy script and bot are already restored from it; it also holds `DARE_WALL_PLAN.md` and `ONCHAIN_LAST_WORD_PLAN.md`.
- `stash@{2}`: an earlier attempt that put the dare inside ChogDuel. Superseded; don't use it.
