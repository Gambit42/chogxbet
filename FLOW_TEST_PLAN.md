# Two-player flow test plan and run log

Run: 2026-10-23 (Asia/Manila), local development server http://localhost:3000, Monad testnet.

Player A: Chrome Work, wallet 0x5bB6066c1c9cf4513AD653F7A2D55a2B5A8A3fe3, default Chog #7.
Player B: Chrome Prins, wallet 0x4A1DB41709bF673c69fAfc371F29Abf4Ad6FcE64, default Chog #10.
Chrome profile names do not establish the Google email mapping.

Statuses: PASS = observed in browser; ISSUE = observed mismatch; PARTIAL = some steps checked; PENDING = not executed. Code-review risks are listed separately from browser findings.

## Journey and execution record

| ID | Player / steps | Expected | Result |
| --- | --- | --- | --- |
| 01 | A and B open My duels from existing sessions | Correct wallet, balances and personal records | PASS after wallet restoration. A: 890 CHOG / 21.45 MON; B: 890 CHOG / 18.03 MON. Initial loading shows a misleading No duels yet state. |
| 02 | New visitor: landing -> enter app -> sign in -> correct network -> faucet -> select Chog | Every prerequisite has a clear next action | PENDING fresh sign-in, network switching and faucet transactions. Existing sessions retained. |
| 03 | A Create: blank target, MON above $1, 5-minute deadline -> Continue | Blank target blocked; valid call reaches Stake | PASS. Preview follows call and deadline. |
| 04 | A Stake: 50 MON with 21.45 MON balance | Block continuation and explain how to obtain tokens | PASS: Not enough MON, balance and faucet link shown. |
| 05 | A reduce stake to 1 MON -> Review | Correct selected Chog, pot, fee and payout | PASS: Chog #7, pot 2 MON, fee 0.1 MON, winner 1.9 MON. |
| 06 | A lock call -> share dialog -> copy link -> B opens it | One transaction, success route, correct open duel | PENDING new transaction and fresh open-call sharing. No lock submitted. |
| 07 | B accepts A's open call with Chog #10; A stays open | Matching token/stake; both browsers update without reload | PENDING browser transaction. Shared reads lack periodic refresh; see code-review risks. |
| 08 | A and B My duels -> existing live duel #2 | Opposite player sides, same terms and status | PASS: A Above, B Below; same 1 MON stake and deadline; both seats locked. |
| 09 | B opens A's wallet link on duel #2 | Public profile opens the exact entered Chog | PASS: profile has 5 Chogs; Chog #7 sheet opens, showing 0W / 1L / 0T and duel #5. |
| 10 | A and B history for existing settled duel #5 | Winner and loser agree; payout and fee consistent | PASS: A lost 1 MON; B won net 0.9 MON. B detail: 1.9 MON paid, 0.1 MON buybacks, settlement tx link. |
| 11 | B Share your win -> light/dark preview | Image renders and theme updates | PASS light preview natural size 1200 x 630; dark image URL changes to theme=dark. Dark image completion not separately verified. |
| 12 | B Copy link -> inspect clipboard -> open in A | Clipboard contains complete duel URL | PARTIAL: click executed, browser clipboard tool returned empty and no confirmation toast was observed. Could be browser/tool focus or clipboard permission; not yet a confirmed app bug. |
| 13 | A switches Real stakes -> Last Word | Clear mode, dare field, correct fee explanation | PASS. Switching resets to Your call while retaining target/deadline. |
| 14 | A enter blank dare, then paste 16 emoji | Blank blocked; 60-byte limit keeps complete Unicode characters | PASS: blank shows Write the dare; paste clips to 15 emoji, counter 60/60. |
| 15 | A choose starter dare, 1 MON fee -> Review | Correct dare, Chog and currency | PASS: Charts are just vibes.; Chog #7; entry each side 1 MON. |
| 16 | A reload Review -> Continue saved draft | Same mode, call, dare, Chog and fee currency | BLOCKED in browser: wallet restoration remained loading during repeated checks. Code review confirms fee currency is absent from saved draft. |
| 17 | B Arena -> Last Word tab -> empty-state CTA | Opens Last Word creation | ISSUE: Drop a hot take links to /create and opens Real stakes. Existing draft prompt also appears. |
| 18 | B Arena All / Real stakes / Last Word filters | Counts and content match selected mode | PASS filter behavior: All 1, Real stakes 1, Last Word 0; Last Word empty state appears. ISSUE: Open calls list includes accepted, fully locked duel #2. |
| 19 | B Wall of Shame | Honest empty state without mock receipts | PASS: wall is clean, Throw down a dare links to /create?mode=lastword. Populated receipts not available. |
| 20 | A creates Last Word; B accepts; bot settles | Correct fee per side, winner, loser bubble and receipt | PENDING new on-chain lifecycle. |
| 21 | Reverse roles: B creates; A accepts; previous loser wins | Bubble clears or changes correctly; old receipt persists | PENDING new on-chain lifecycle. |
| 22 | Creator cancels an untaken call; other browser stays open | Refund/credit correct; other browser updates; no accept remains | PENDING transactions. Existing cancelled history rows visible for A. |
| 23 | B opens expired duel #3/#4 -> Reclaim | Exact locked amount returned once; repeat action disabled | PARTIAL: history shows 1 MON locked and Reclaim. Transaction not submitted. |
| 24 | Reject wallet request / double click / slow RPC / retry | No duplicate duel; recoverable error; form retained | PENDING wallet execution and network fault testing. |
| 25 | Wrong Chog challenge, creator self-accept, nonexistent ID | Clear denial without transaction; correct error route | PENDING full browser coverage. |
| 26 | Phone 390 x 844: Arena, Wall, Create, My duels, share dialog | No clipped navigation/actions or horizontal scroll | PARTIAL viewport smoke check on Wall/Arena. Full visual mobile pass still required; override reset. |
| 27 | Bare domain, app domain, old /app links, external social unfurl | Landing and app resolve; old links redirect; preview works remotely | PENDING deployed environment. Localhost links cannot be opened by outside recipients. |
| 28 | Open local legacy /app/duels/5 | Redirect to the same duel without /app prefix | PASS: browser URL becomes http://localhost:3000/duels/5. |
| 29 | B Faucet -> wallet menu -> Profile -> Chog #10 | Existing prerequisites and owner record agree | PASS: faucet 2 of 2 ready, 3/5 NFTs; profile 3 Chogs; #10 record 1W / 0L / 0T, 100%, net +0.9 MON against #7. No mint/claim submitted. |

## Browser findings

1. **Wallet restoration exposes an incorrect empty state.** My duels says No duels yet while Loading wallet is still shown, then fills with actual history. Keep the loading state until identity is known. A later hard reload also left Create loading throughout repeated checks; cause not established.
2. **Last Word discovery sends the player to the wrong mode.** Arena Last Word empty state -> Drop a hot take -> Real stakes. Carry ?mode=lastword through that CTA.
3. **Open calls contains calls that cannot be taken.** Accepted duel #2 appears under Open calls with Match the stake instructions and Both sides locked. Use a broader heading or separate open seats from live duels.

## Confirmed code-review risks needing targeted regression tests

- `src/features/betting/create-call.tsx`: `lwToken` is not in BLANK, parseDraft, pickUp or draftJson. A MON Last Word draft resumes with default CHOG. Include the selected fee currency in the existing draft format; browser reproduction awaits wallet recovery.
- `src/features/betting/arena.tsx`, `src/features/lastword/wall.tsx`, detail reads: no periodic duel refresh or event subscription. The acting browser invalidates its own cache only. Test two browsers while one accepts/cancels and the other remains focused.
- `src/features/lastword/wall.tsx`: useSettleTx runs before settlement and caches an absent transaction with staleTime Infinity. Only request after settlement or allow an absent result to refresh.
- `src/features/betting/my-duels.tsx`: Refundable remains Active for Last Word even though Last Word offers no refund after its settlement window. Treat this terminal mode-specific state as history.
- `src/features/betting/duel-page.tsx`: default entry may still be creatorChog after that NFT transfers to the taker, although the picker excludes it. Reuse the filtered fallback already in DarePage.

## Transaction completion matrix

Run these using new test duels, label dares clearly as QA, and retain every ID/transaction hash. Do not cancel or alter unrelated existing duels.

| Case | A | B | Assertions |
| --- | --- | --- | --- |
| Stakes MON | Create Above with 1 test MON | Open copied link, accept Below | Both balances/stakes; live state; settlement; winner credit; claim once; records agree |
| Stakes CHOG, roles reversed | Accept | Create with 10 test CHOG | Approval handling; pot; 5% burn; payout; no duplicate approvals or submissions |
| Last Word MON | Create 5-minute dare | Accept with #10 | Fee 1 MON each; no pot; loser wears text; Wall and public profile match |
| Last Word CHOG, roles reversed | Accept with previous losing Chog | Create counter-dare | Fee 10 CHOG each; burn; win/draw clears prior word; historical receipt remains |
| Specific Chog | Challenge #10 | Correct holder accepts | Header notification, restricted availability, fixed entered Chog, third-party denial |
| Cancel / expiry | Cancel untaken new duel | Observe without refresh | Cancel state, exact refund/credit, no repeat action; separate untaken expiry/reclaim |
| Timeout / tie | Use deterministic contract tests | Use deterministic contract tests | 24h refund boundary for stakes, terminal Last Word timeout, exact-price draw and no fee |

## Verification boundaries

This run inspected existing on-chain records and exercised forms to final review. No new duel, acceptance, cancellation, claim, approval or faucet mint was submitted. No X post was sent. Existing wallet logins were kept. Only A's test creation draft was edited; B's existing draft was not continued or discarded. No application source was changed.

Earlier parallel checks in this session: Foundry 19/19 and settlement helper tests 5/5 passed. Build compiled but was cancelled before completion; lint was cancelled. These are not complete build/lint passes. Hosted DNS, Privy allowed origins, current cron operation and fresh two-wallet settlement are still unverified.

Re-ran Foundry and settlement helper tests during this flow pass: 19/19 and 5/5 passed again. `npm run lint` also completed successfully (exit 0). Player A's direct duel URL renders public results while wallet restoration remains loading; this blocks player-specific actions but not public result viewing. Full production build remains unverified.
