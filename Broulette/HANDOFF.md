# Broulette — Project Handoff

**Status:** Interactive frontend prototype complete. Backend (Firebase) **not yet built**.
**Last updated:** May 22, 2026 — for Izzy & Kyle's wedding (23 May 2026, 4:30 PM AEST).
**Prototype entry:** `Broulette.html` (loads React + Babel from CDN, no build step).

---

## TL;DR for whoever picks this up next

The prototype runs the whole game in fake in-memory JavaScript state. Every screen, every interaction, every animation is working — login, sign-up queue, dashboard, bet creation/wagering, group-spin wheel, dice + mini-games, sip transfers, leaderboard, full admin panel. **Refresh the page and it resets to its seed.**

To ship to the wedding you need to:
1. Spin up a Firebase project (Anonymous Auth + Firestore on the free Spark plan).
2. Write `firestore.rules` (security model below).
3. Replace `store.jsx`'s in-memory methods with Firestore reads/writes + `onSnapshot` listeners. The React subscribe/notify pattern maps cleanly — every method that mutates state today becomes a Firestore transaction.
4. Hash PINs before storing (even a simple SHA-256 in-browser is fine; this is friends-at-a-wedding security, not a bank).
5. Wire `firebase.json` for the emulator + a GitHub Pages deploy workflow.

The shape of `store.jsx`'s API was designed with this swap in mind — every collection name and field already matches the schema in `THOUGHT.md` (with the deviations noted below).

---

## Major deviations from the original spec

The original `CLAUDE.md` + `THOUGHT.md` describe a 4-digit PIN, drinks as currency, automatic registration window, creator-2× bet minimum, and individual-spin roulette. Over the course of design we changed several of those — capturing each here so the backend agent doesn't accidentally implement the obsolete behaviour.

### 1. Currency renamed: "drinks" → "sips"
- 1 sip credit = 1 actual sip IRL.
- **10 sips = 1 whole drink** (just a conversion to talk about, not a game mechanic).
- Every UI label, toast, and balance display says "sips". Internally the field is still `player.balance` (number).

### 2. PIN is now 6 digits (was 4)
- Validation enforces `pin.length === 6` in `LoginScreen`.
- Russell's hard-set PIN: **787789** (first name `Russell`, last initial `W`).
- All seeded demo players use 6-digit PINs.
- iOS device frame is pre-filled with Russell's credentials for demo purposes.

### 3. Registration: no time window, Russell approves everyone
- **Removed:** the "first 1 hour after start" auto-open window.
- **New flow:** anyone can submit a sign-up at any time. Their request lands in `state.registrationRequests` with status `pending`. Russell sees it in **Admin → Approvals → Sign-ups** and approves or declines. Only on approval does a player record get created.
- The LoginScreen has a "Pending approval" waiting state after submission — polls the store; when status flips to `approved`, the player is auto-logged-in.
- PIN is displayed back to the player on the waiting screen ("Write this down — you'll need it to sign back in if you refresh"). It is *also* shown on the form itself with a gold callout, since `type="tel"` already shows digits unmasked.

### 4. Game start: admin button, not fixed time
- **Removed:** auto-start at 4:30 PM AEST. The original spec assumed the game starts at the ceremony time.
- **New flow:** the game starts in `gameStatus: 'waiting'` state. Anyone who logs in before Russell hits the button sees a **WaitingLobbyScreen** with the player list and a "Hold tight — waiting for Russell" message.
- Russell's lobby view shows the same player list **plus a big gold "START THE GAME →" button**. Pressing it: sets status `active`, anchors `gameStartedAtVirtual = now`, sets `currentRound = 1`, grants the first +5 sips to everyone, and opens the first 5-minute wheel-betting window.
- *Demo note:* the seeded state ships with `gameStatus: 'active'` mid-round-2 so the prototype shows the interesting screens immediately. Use the **Tweaks → "Reset to pre-game"** button to test the lobby flow.

### 5. Bet payouts: universal 1.5× minimum (was creator-only 2×)
- Anyone who wins a parimutuel bet gets at least `ceil(amount * 1.5)` back, rounded up. So:
  - Bet 2 → minimum 3 back
  - Bet 5 → minimum 8 back
  - Bet 10 → minimum 15 back
- Removed the "creator gets at least 2×" special case. Universal floor applies to everyone — including the creator.
- Copy on the **Create Bet** sheet now reads: *"Minimum payout if you win: 1.5× your wager, rounded up."*

### 6. Roulette: ONE shared spin per round (not individual spins)
- **Old model:** each player taps "spin" privately and gets their own outcome.
- **New model:** the wheel opens a **5-minute betting window** at the start of each 30-minute round. During the window, players place bets *on individual slices*. When the window closes (or admin clicks "Spin the wheel now"), the wheel spins **once** for everyone. Players who bet on the winning slice get `amount × multiplier`. Everyone else loses their bet.
- Bet panel shows each slice's **% chance** (weight ÷ total weight), the colored multiplier tile, and the popularity of bets on it.
- The wheel itself only shows slice **labels** — the "×N" small text below was removed per request.

### 7. Slice updates
The 7 default slices, with the new behaviour:

| Slice      | Type        | Behaviour                                                      | Weight |
|------------|-------------|----------------------------------------------------------------|--------|
| Cheers     | multiplier  | ×2 payout                                                       | 5      |
| **Skulls** | **penalty** | **Non-bettable.** When it lands: everyone drinks 2 sips IRL and gets **+2 sips** to their balance. All other bettors lose their stake. | 5 |
| Sip Back   | multiplier  | **×1.5** payout *(was ×0.5 in the original spec)*               | 3      |
| Triple     | multiplier  | ×3 payout                                                       | 2      |
| JACKPOT    | multiplier  | ×5 payout                                                       | 1      |
| Dice       | dice        | Single shared 1–6 roll; everyone who bet on Dice gets `bet × roll` | 2 |
| Mini-Game  | mini-game   | Each player who bet plays the same randomly-chosen mini-game; win = `bet × game.payoutMult`, loss = 0 | 2 |

Slice config is admin-editable in **Admin → Wheel** — you can rename, retype, adjust multiplier, change weight, add new slices.

### 8. Sip economy: auto-drops + optional purchase
- **Auto:** every 30 minutes, every player auto-gets **+5 sips**. No action needed.
- **Buy more:** on top of that, each player can request **up to 5 extra sips per 30-minute round** by tapping the dashboard's "Buy more sips" tile. The request goes to Russell, who approves in **Admin → Approvals → Sip requests**. The extra-sip quota resets each round.
- The original spec called this "debt" — renamed to "buy more sips" because the request flow is the same but the framing is friendlier.

### 9. Mini-games are now ONLY accessed via the Mini-Game wheel slice
- Original spec described them as triggerable from roulette. The new model: when the wheel lands on Mini-Game, the store picks one of `numberGuess | coinFlip | higherLower | shotRoulette | dareOrDrink` at random. Every player who bet on that slice plays the same game independently.
- The current player on each phone gets a forced modal popup with the game. Bots (other players not currently signed in on a phone) auto-resolve after ~4.5s with a 40% win rate.
- Payout multipliers: Number Guess 10×, Coin Flip 2×, Higher/Lower 2×, Shot Roulette 2×, Dare or Drink 5×.

### 10. Dashboard: "Sips this round" widget
- New: a card near the top of the home screen showing transfers involving the current player in the current round. Shows who sent the player sips, totals received and sent, and a CTA to send sips if there's no activity yet.
- Filters activity by `_vtime >= roundStart`.

### 11. Russell can see all PINs
- In **Admin → Players**, tapping any player's row reveals their 6-digit PIN in a gold pill (with a "Hide" button to collapse). This is so Russell can recover lost PINs for anyone who refreshes their browser and forgets theirs.
- The Sign-ups panel in Admin → Approvals also shows requestors' PINs in plaintext (so Russell can confirm they're not a typo before approving).

### 12. Rules popup
- Shown automatically the first time `me` becomes truthy in a session (i.e., immediately after login). Sheet-style modal with the six house rules and a pinned "Got it" CTA at the bottom.

### 13. Reception-themed bet suggestions
- The game starts AFTER the ceremony, so ceremony-y suggestions like "Best man drops the rings" were removed. New defaults focus on speeches / dancing / cake / DJ.

---

## File structure

```
Broulette.html         ← entry point (loads React + Babel from unpkg)
Broulette v1.html      ← preserved earlier version (drinks/individual-spin model)
styles.css             ← all design tokens + components
store.jsx              ← in-memory game state, all game logic
ui.jsx                 ← shared primitives (Avatar, Sheet, Dialog, Stepper, ToastStack…)
screens.jsx            ← LoginScreen, WaitingLobbyScreen, DashboardScreen, BetsScreen,
                         CreateBetSheet, SendDrinksSheet, DebtSheet (now "Buy more sips"),
                         RulesDialog, ActivityScreen, LeaderboardScreen, SipsThisRoundCard
roulette.jsx           ← WheelSVG, RouletteScreen, BetPanel, ResultBanner, mini-games
admin.jsx              ← AdminScreen with Approvals / Players / Game / Wheel tabs
app.jsx                ← BroApp shell — tab routing, sheets, lobby gate
entry.jsx              ← Mounts BroApp into iOS + Android frames; Tweaks panel
design-canvas.jsx      ← starter (Figma-style canvas wrapper)
ios-frame.jsx          ← starter (iPhone bezel)
android-frame.jsx      ← starter (Android bezel)
tweaks-panel.jsx       ← starter (Tweaks control panel)
```

---

## Russell's credentials (hardcoded for demo)

- **Name:** Russell W
- **PIN:** **787789**
- Pre-filled on the iOS phone frame on load.

Demo "Izzy M" (Android) PIN: **052326** (their wedding date in MMDDYY).

All other demo players have 6-digit PINs visible in `store.jsx`'s `SAMPLE_PLAYERS` and revealable from Admin → Players in-app.

---

## Tweaks panel reference (testing aids — not user-facing in production)

| Tweak | Effect |
|-------|--------|
| Theme | Switch palette: Cream / Vine / Midnight |
| Time speed | 1× / 60× / 600× / 3600× — fast-forward virtual clock so round drops and wheel spins fire in seconds |
| Next round now | Bumps the round-start anchor forward to trigger the next round |
| Spin the wheel now | Closes the betting window and spins immediately |
| Reset to pre-game | Sets `gameStatus = 'waiting'` so you can test the lobby + admin Start button |

These all live in `entry.jsx`. They're hidden by default (toolbar toggle). Won't ship to production.

---

## Backend status — what's NOT done

| Item | Status | Notes |
|---|---|---|
| Firebase project | ❌ | Needs to be created (Auth + Firestore, Spark plan) |
| `firebase.json` + emulator config | ❌ | |
| `firestore.rules` | ❌ | Spec below |
| `firestore.indexes.json` | ❌ | |
| Cloud Functions | ❌ | Not strictly needed if rules cover validation |
| Replace in-memory store with Firestore | ❌ | Biggest chunk of work |
| PIN hashing | ❌ | Currently plaintext in seed data |
| GitHub Pages deploy workflow | ❌ | |

### Firestore schema (matches what `store.jsx` looks like today)

```
/games/{gameId}
  status: "waiting" | "active" | "paused" | "ended"   // was registrationOpen too — now gone
  startedAt: timestamp | null                          // set when admin presses Start
  roundLen: 1800
  betWindowLen: 300
  autoSipsPerRound: 5
  extraSipsMax: 5
  currentRound: number
  rouletteOpen: boolean
  rouletteBetsCloseAt: timestamp
  rouletteResult: { sliceId, dieValue?, miniGame?, finalized } | null
  rouletteRoundId: string
  rouletteSlices: [{ id, label, type, multiplier?, penaltyAmount?, weight, color }]

/games/{gameId}/players/{playerId}
  firstName, lastInitial, displayName
  pin           // 6-digit string — hash before storing!
  balance: number
  isAdmin: boolean
  joinedRound: number
  avatar: 'blush' | 'gold' | 'sage' | 'burg' | 'ink'

/games/{gameId}/registrationRequests/{reqId}
  firstName, lastInitial, pin (hashed)
  status: "pending" | "approved" | "rejected"
  requestedAt: timestamp
  resolvedAt: timestamp | null
  playerId: string | null     // set on approval

/games/{gameId}/sipsThisRound      // map: playerId → count
  // resets at each round start

/games/{gameId}/sipRequests/{reqId}
  playerId, amount, status, requestedAt, resolvedAt

/games/{gameId}/bets/{betId}
  createdBy, proposition
  status: "pending_approval" | "open" | "resolved_won" | "resolved_lost" | "expired" | "rejected"
  createdAt, expiresAt, approvedAt, resolvedAt
  totalFor, totalAgainst
  creationCost: 3

/games/{gameId}/bets/{betId}/wagers/{wagerId}
  playerId, side: "for" | "against", amount, payout

/games/{gameId}/rouletteBets/{betId}     // current round only, cleared at round end
  playerId, sliceId, amount

/games/{gameId}/rouletteHistory/{roundId}
  sliceId, label, multiplier | 'mini', dieValue?

/games/{gameId}/transfers/{transferId}
  fromPlayerId, toPlayerId, amount, timestamp

/games/{gameId}/activityLog/{logId}
  type: "credit_drop" | "bet_created" | "bet_approved" | "bet_resolved" | "bet_rejected"
      | "wager_placed" | "roulette_bet" | "roulette_result" | "roulette_penalty"
      | "transfer" | "sips_requested" | "sips_approved" | "sips_rejected"
      | "signup_requested" | "signup_rejected" | "player_joined"
      | "round_start" | "game_start"
  playerId | null
  message: string
  timestamp
  data: object
```

### Security rules — minimum sketch

- **Anyone** (signed in anonymously): can read all game-public state, can create their own wager / transfer (from-side) / sip request / roulette bet, can create a registrationRequest. Balance writes are server-validated (subtract from own balance only).
- **Admin only:** approveBet / rejectBet / resolveBet, approveSipRequest / rejectSipRequest, approveRegistration / rejectRegistration, startGame, setGameStatus, updateSlice / addSlice / removeSlice, adjustBalance, executeRouletteSpin.
- **Cloud Functions or transaction-only:** the auto-credit-drop (don't trust the client clock) and `executeRouletteSpin` (don't trust the client RNG).

> Without Cloud Functions the auto credit drop + wheel spin will need to be triggered by the admin's client (their tab acts as the "server"). This is acceptable for a one-evening wedding game — Russell will have the app open the whole time anyway.

---

## Iteration log (in order)

This captures the design decisions Russell made over the course of building, so the next agent doesn't accidentally undo them.

1. **Initial scope** — Asked for fully interactive prototype, wedding-appropriate aesthetic (cream/blush/gold/serif), iOS + Android side-by-side, real spinning wheel with mini-games. No Affinda tokens (which were attached but inappropriate for the wedding context).

2. **First build** — Drinks economy, 4-digit PIN, auto credit drops, individual roulette spins (each player taps "spin" and gets their own outcome), creator-only 2× bet minimum, registration open for first hour. Mini-games triggered from roulette landing on Mini-Game / Dice slices.

3. **Sips terminology** — Switched currency from "drinks" → "sips". Added 10-sips-per-drink rule. Added rules popup that shows on every login. The original spec said no auto drops, then Russell reverted that decision: auto +5 every 30 min stays, PLUS optional "buy more sips" request flow (max 5 extra per round, admin approves). Buy more sips replaces the original "debt" mechanic with friendlier framing.

4. **Group-spin roulette** — Rewrote the wheel: instead of individual spins, the wheel opens a 5-minute betting window per round, players bet on slices, then **one shared spin** resolves it for everyone. Result banner shows what landed, who won, payouts. Bet panel shows % odds per slice.

5. **1.5× universal bet minimum** — Replaced the creator-only 2× rule with a universal `ceil(amount × 1.5)` floor for any winner of a parimutuel bet. So even betting on a sure thing always returns at least 1.5× rounded up.

6. **Wheel polish** — Restored the original 7 slices (Cheers / Skulls / Sip Back / Triple / JACKPOT / Dice / Mini-Game) including Dice and Mini-Game types in the new group-spin model. Removed the small "×N" text from inside the wheel slices. Added odds % display per slice.

7. **Skulls as penalty** — Made Skulls non-bettable. When it lands: everyone drinks 2 sips IRL and the game grants everyone +2 sips automatically. Other bettors lose their stake as usual.

8. **Sip Back → 1.5× multiplier** (was 0.5×).

9. **Sips-this-round widget** — Added a card to the top of the dashboard showing transfers involving the player in the current round, with sender list and totals.

10. **6-digit PINs** — Bumped from 4 to 6 digits. Russell's hardcoded PIN: 787789. Demo Izzy's: 052326.

11. **Registration overhaul** — Removed the 1-hour open window. Anyone can request to join anytime; Russell approves. Sign-up form shows a gold "Write this down — you'll need it to sign back in" callout under the PIN field. After submitting, a "Waiting for Russell" screen displays the chosen PIN big in mono digits with the same reminder. When the player switches from the Sign In tab to the Join the game tab, the form auto-clears the demo defaults so they pick their own credentials.

12. **Reception-themed bet suggestions** — Removed ceremony-y suggestions (rings being dropped) since the game starts after the ceremony.

13. **Admin Start Game button** — Removed auto-start at fixed time. Game now starts in `gameStatus: 'waiting'`. Russell's admin Game tab has a prominent "Start the game now" button (only shown when status is waiting). Players who arrive before the game starts see a Lobby screen with the player list and "Hold tight" copy. Demo state ships in `active` so the prototype's interesting; use Tweaks → Reset to pre-game to test the lobby flow.

14. **PIN recovery** — Admin → Players shows each player's 6-digit PIN on tap (reveal with a "Hide" toggle). Sign-ups in Admin → Approvals show requestors' PINs in plaintext too. This is the lost-PIN recovery path: Russell looks it up and tells the player in person.

---

## Open questions / known limitations

- **No persistence.** State lives in memory. Refresh = reset to seed. Backend wiring is the fix.
- **No PIN hashing.** Demo stores plaintext. Hash before going live.
- **Bot mini-game auto-resolution is timer-based.** When the wheel lands on Mini-Game, players not currently signed in on a phone auto-resolve their bet after 4.5 seconds with a 40% win rate. In production this would need to be either: (a) admin-triggered after polling players IRL, or (b) gracefully handled when those players sign in later.
- **No game-end flow.** Admin can `setGameStatus('ended')` from the Game tab but there's no celebratory winner-reveal UI yet. Worth adding for the actual night.
- **Live player tracking is in-memory.** The store tracks `livePlayerIds` (a Set) so it knows which players are bots vs phones, but this resets on refresh. In Firestore you'd want a per-player `lastSeenAt` heartbeat or presence subscription.

---

## What still needs to happen before the wedding

1. **Backend wiring** (above). Probably 1-2 days of focused work with Claude Code or a dev.
2. **Test with 3-5 real people** on real phones at a small dinner ahead of time. Tweak slice weights based on what feels right.
3. **Decide Russell's wheel-spin trigger** — does it auto-trigger when betting closes, or does Russell tap "Spin"? Currently auto-triggers.
4. **Set the actual game start time** (i.e., when Russell expects to press the button) and tell guests when to arrive at the app.
5. **Buy a domain or use the existing wedding website domain.** Plug it into GitHub Pages.

---

Thanks for the great brief and the back-and-forth — design moved fast because you had strong opinions. Good luck on the day.
