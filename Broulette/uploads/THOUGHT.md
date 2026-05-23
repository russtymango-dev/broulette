# Broulette - The Wedding Drinking Game

> "Spin it. Sip it. Win it."

## Overview

Broulette is a real-time wedding drinking game for **Izzy & Kyle's wedding** where guests earn drink credits every 30 minutes, place bets on wedding shenanigans, spin a roulette wheel, and send drinks to each other. Admin (Russell) controls the game flow and also plays.

**One-time use.** Built for a single wedding event.
**Game date:** Saturday 23 May 2026, starting at **4:30 PM AEST**
**Players:** ~20-30 guests, mobile-only

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Hosting | GitHub Pages | Free, simple, Russell's existing stack |
| Backend/DB | Firebase (free tier) | Auth, Firestore real-time DB, no server needed |
| Auth | Firebase Anonymous + Firestore | Name + PIN, no email needed |
| Frontend | Vanilla JS or lightweight framework (TBD by frontend agent) | Keep it simple |
| Domain | Existing wedding website domain | No new purchase needed |

### Firebase Free Tier Limits (Spark Plan)
- 1GB Firestore storage, 50k reads/day, 20k writes/day — more than enough for 20-30 players over one evening.

---

## Core Mechanics

### 0. Authentication
- **No email/password** — simple name + PIN system
- Player enters first name + last initial (e.g., "Russell W") and creates a 4-digit PIN
- To log back in: same name + PIN
- **Registration window**: Only the first 1 hour after game start (4:30–5:30 PM) allows self-registration
- After that, only admin can create new accounts from the admin panel
- Uses Firebase Anonymous Auth under the hood, with player data in Firestore

### 1. Drink Credits
- Game starts at **4:30 PM AEST on 23 May 2026**
- Every 30 minutes, each logged-in player receives **5 drink credits**
- Credits are cumulative — unspent credits carry forward
- Credits represent real drinks OR just game currency (player's choice how literal they go)

### 2. Betting System (Parimutuel Style)

**Creating a bet:**
- Any player can create a bet — costs **3 drinks** to create
- Player writes a proposition (e.g., "Uncle Dave will cry during the speech")
- Admin reviews and approves within 30 minutes
- Once approved, the bet goes public for others to wager on

**Betting on existing bets:**
- Players bet FOR or AGAINST the proposition
- Minimum bet: 1 drink
- Odds are determined by the ratio of drinks bet FOR vs AGAINST (parimutuel)
- Example: 10 drinks bet FOR, 30 drinks bet AGAINST → FOR payout is 4:1, AGAINST payout is 1.33:1

**Bet resolution:**
- Admin manually verifies outcome (happened / didn't happen)
- Winning side splits the entire pot proportionally to their stake
- **Minimum payout**: The bet creator always gets at least 2x their wager (minimum 1 drink profit) if they win — you can't give out 0.1 of a drink
- **All payouts rounded up** to whole drinks (no fractional drinks)
- House takes 0% (it's a wedding, not a casino)

**Bet expiry rules:**
- Bets must resolve within **1 hour** of creation (max 2 credit rounds)
- If a bet is created during the 6:30–7:00 window, it must resolve by 8:00 PM at the latest
- Unresolved bets after expiry: all drinks refunded

### 3. Roulette Wheel

**Timing:**
- Opens every 30 minutes when drink credits are distributed
- Players get a **5-minute window** to place their roulette bets
- The wheel spins **once** per round
- Players are notified when the table opens

**Wheel slices (default configuration — admin can adjust via admin panel):**

| Slice | Type | Payout | Frequency |
|-------|------|--------|-----------|
| "Cheers!" | multiplier | 2x | Common |
| "Skulls" | multiplier | 0x (lose all) | Common |
| "Sip Back" | multiplier | 0.5x (half back) | Uncommon |
| "Triple Shot" | multiplier | 3x | Uncommon |
| "Jackpot" | multiplier | 5x | Rare |
| "Dice Roll" | mini-game | Roll a d6, win that as multiplier (1x-6x) | Rare |
| "Mini-Game!" | mini-game | Triggers a random mini-game (see below) | Rare |

Admin can create/edit/remove slices and adjust their weight (frequency) from the admin panel.

**Custom slice types supported:**
- `multiplier` — fixed payout multiplier
- `mini-game` — triggers a specific or random mini-game
- `dice` — roll a die, result is the multiplier

**Mini-games (triggered by roulette slices):**

1. **Number Guess** — Pick a number 1–10. If correct: **10x** your bet. Simple, high-risk.
2. **Coin Flip** — Heads or tails. Double or nothing (2x or 0x).
3. **Higher/Lower** — Shown a random number 1–100, guess if the next number is higher or lower. Correct = 2x.
4. **Shot Roulette** — 6 glasses shown, 1 is "poison." Pick one. If you dodge the poison: 2x. If you pick it: 0x and you owe a real drink to the person with the lowest balance.
5. **Dare or Drink** — A random dare appears. Admin confirms if you did it. If yes: 5x. If you chicken out: lose your bet.

More can be added by admin — each mini-game is just a name + rules + payout structure.

### 4. Drink Transfers
- Any player can send drinks to any other player
- No admin approval needed
- Shows in activity log: "Player A sent 5 drinks to Player C"

### 5. Debt System
- Player can request to "drink IRL" to gain credits
- Request goes to admin for approval
- Rate: drink 5 real drinks → gain 5 credits (1:1)
- Admin can reject if someone's had enough
- Shows in log: "Player B took on 5 debt drinks (approved)"

---

## User Roles

### Player
- View their drink credit balance
- Create bets (costs 3 drinks)
- Bet on existing public bets
- Spin roulette during open windows
- Send drinks to other players
- Request debt drinks
- View activity log
- Receive notifications

### Admin (Russell)
- **Full player** — plays the game like everyone else, plus:
- Approve/reject new bets
- Resolve bets (mark as won/lost)
- Approve/reject debt requests
- View all player balances
- Manually adjust credits if needed
- Start/pause/end the game
- Configure roulette wheel slices (add/edit/remove)
- Create new player accounts (after registration window closes)

---

## Data Model (Firestore)

```
/games/{gameId}
  startTime: timestamp
  status: "waiting" | "active" | "paused" | "ended"
  creditInterval: 30  (minutes)
  creditsPerInterval: 5
  currentRound: number
  rouletteOpen: boolean
  rouletteCloseTime: timestamp
  registrationOpen: boolean  // auto-closes 1hr after start, admin can reopen
  rouletteSlices: [{label, multiplier, weight, type, miniGame}]

/games/{gameId}/players/{playerId}
  firstName: string
  lastInitial: string
  displayName: string  // "FirstName L"
  pin: string  // hashed 4-digit PIN
  balance: number
  isAdmin: boolean
  joinedAt: timestamp
  lastCreditRound: number  // track which round they last received credits

/games/{gameId}/bets/{betId}
  createdBy: playerId
  proposition: string
  status: "pending_approval" | "open" | "resolved_won" | "resolved_lost" | "expired" | "rejected"
  createdAt: timestamp
  expiresAt: timestamp  // createdAt + 1 hour
  approvedAt: timestamp | null
  resolvedAt: timestamp | null
  totalFor: number  // total drinks bet FOR
  totalAgainst: number  // total drinks bet AGAINST
  creationCost: 3

/games/{gameId}/bets/{betId}/wagers/{wagerId}
  playerId: string
  side: "for" | "against"
  amount: number
  placedAt: timestamp
  payout: number | null  // filled on resolution

/games/{gameId}/rouletteRounds/{roundId}
  roundNumber: number
  openedAt: timestamp
  closedAt: timestamp
  result: {sliceIndex, label, multiplier, type}
  status: "open" | "spinning" | "resolved"

/games/{gameId}/rouletteRounds/{roundId}/spins/{spinId}
  playerId: string
  betAmount: number
  payout: number
  miniGameResult: object | null  // if mini-game triggered

/games/{gameId}/debtRequests/{requestId}
  playerId: string
  amount: number
  status: "pending" | "approved" | "rejected"
  requestedAt: timestamp
  resolvedAt: timestamp | null

/games/{gameId}/transfers/{transferId}
  fromPlayerId: string
  toPlayerId: string
  amount: number
  timestamp: timestamp

/games/{gameId}/activityLog/{logId}
  type: "credit_drop" | "bet_created" | "bet_approved" | "bet_resolved" | "wager_placed" | "roulette_win" | "roulette_loss" | "mini_game" | "transfer" | "debt_approved" | "debt_rejected"
  playerId: string | null
  message: string
  timestamp: timestamp
  data: object  // type-specific payload
```

---

## Activity Log

Public feed visible to all players showing:
- Who won/lost bets and how much
- Roulette results
- Drink transfers
- New bets going live
- Credit drops

Each player also sees a **personal notification** when:
- They receive drinks from another player
- A bet they wagered on is resolved
- Their bet creation is approved/rejected
- Their debt request is approved/rejected
- Roulette table opens
- They win a mini-game

---

## Notifications

Using Firestore real-time listeners:
- Player-specific notifications stored in a subcollection or filtered from activity log
- Client listens for changes and shows toast/popup notifications
- No push notifications needed — players will have the app open on their phones

---

## Security Rules (Firestore)

- Players can only modify their own wagers and transfers (from side)
- Only admin can: approve bets, resolve bets, approve debt, adjust balances, control game state
- Balance modifications go through Cloud Functions or security rules that validate the transaction
- **Important**: Since we're on free tier and no Cloud Functions, balance validation happens client-side with Firestore security rules doing basic checks. Acceptable for a one-time wedding game with friends.

---

## Game Flow

```
1. Pre-game: Players sign up / log in. See waiting screen.
2. Admin starts game at designated time.
3. Every 30 min:
   a. All players receive 5 credits
   b. Roulette table opens (5 min window)
   c. Players notified
4. Throughout the game:
   - Players create bets → admin approves → others wager → admin resolves
   - Players transfer drinks to each other
   - Players request debt drinks → admin approves/rejects
5. Admin ends game.
6. Final leaderboard shown — most drinks = winner!
```

---

## Pages / Screens

1. **Login / Register**
2. **Dashboard** (main game screen)
   - Balance display (prominent)
   - Active bets list
   - Roulette widget (shows countdown or active wheel)
   - Quick actions: Create bet, Send drinks, Request debt
3. **Bet Detail** — view a specific bet, place wager
4. **Roulette** — wheel animation, bet placement, mini-game overlay
5. **Activity Log** — scrollable feed of all game events
6. **Leaderboard** — ranked by drink balance (top winners AND biggest losers)
7. **Admin Panel**
   - Pending bet approvals
   - Pending debt requests
   - Player management (balances, manual adjustments)
   - Game controls (start/pause/end)
   - Roulette configuration

---

## Decisions (Resolved)

| Question | Answer |
|----------|--------|
| Auth | Name + 4-digit PIN, no email |
| Registration | Open first hour only, then admin-created |
| Game start | 4:30 PM AEST, 23 May 2026 |
| Wedding | Izzy & Kyle |
| Roulette | Admin-configurable slices including custom types (dice, mini-games) |
| End condition | Admin manually ends the game |
| Leaderboard | Winners AND losers shown |
| Platform | 100% mobile-first, phone only |
| Admin role | Full player + admin controls |

---

## File Structure (Proposed)

```
colonies-wedding-game/
├── THOUGHT.md          ← this file
├── CLAUDE.md           ← instructions for agents working on this
├── public/
│   ├── index.html
│   ├── css/
│   ├── js/
│   │   ├── app.js
│   │   ├── auth.js
│   │   ├── game.js
│   │   ├── betting.js
│   │   ├── roulette.js
│   │   ├── admin.js
│   │   └── notifications.js
│   └── assets/
├── firebase/
│   ├── firestore.rules
│   └── firestore.indexes.json
└── README.md
```

---

## Timeline

- **Now**: Architecture complete (this doc)
- **Next**: Set up Firebase project, write Firestore rules, create CLAUDE.md for frontend agent
- **Then**: Frontend agent builds the UI
- **Before wedding**: Test with a few people, tweak roulette odds
