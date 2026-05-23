# Broulette - Wedding Drinking Game

## Project Overview
A real-time mobile wedding drinking game for Izzy & Kyle's wedding (23 May 2026, 4:30 PM AEST). Players earn drink credits every 30 min, bet on wedding events, spin a roulette wheel, and send drinks to each other. One admin (Russell) controls the game and also plays.

**Read `THOUGHT.md` for full architecture, data model, game rules, and mini-game specs before doing any work.**

## Tech Stack
- **Hosting**: GitHub Pages (static files only)
- **Backend**: Firebase (Anonymous Auth + Firestore)
- **Frontend**: Vanilla JS or minimal framework (no heavy build tools — must deploy as static files)
- **No server-side code** — all logic is client-side + Firestore security rules
- **Local dev**: Firebase Emulator Suite for local testing (see below)

## Design Principles
- **100% mobile-first** — this will ONLY be used on phones. Design for portrait, thumb-friendly
- **One-time use** — ~25 players at a wedding, no need for scalability or polish
- **Fun and fast** — big buttons, big numbers, clear feedback, playful UI
- **Real-time** — Firestore listeners for live updates, toast notifications
- **Admin plays too** — admin panel is an overlay/extra tab, not a separate app

## Local Development

The app must run locally without a live Firebase project. Set up:

1. **Firebase Emulator Suite** for Auth + Firestore emulation
2. A `firebase.json` config that defines emulator ports
3. In the app, detect if running locally and connect to emulators:
   ```js
   if (location.hostname === 'localhost') {
     connectFirestoreEmulator(db, 'localhost', 8080);
     connectAuthEmulator(auth, 'http://localhost:9099');
   }
   ```
4. Serve static files with any local server (e.g., `npx serve public` or `python -m http.server`)
5. Include a seed script (`scripts/seed.js`) that populates the emulator with test data: a game, 5-6 fake players, some sample bets, so Russell can test locally without manually creating everything

## File Structure

```
colonies-wedding-game/
├── THOUGHT.md              ← architecture & game design
├── CLAUDE.md               ← this file
├── firebase.json           ← Firebase project config + emulator settings
├── firestore.rules         ← Firestore security rules
├── firestore.indexes.json  ← Firestore composite indexes
├── package.json            ← just for firebase-tools + local dev deps
├── scripts/
│   └── seed.js             ← seed data for local emulator testing
├── public/                 ← all static files (deployed to GitHub Pages)
│   ├── index.html          ← SPA entry point
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── app.js          ← main app init, routing, Firebase config
│   │   ├── auth.js         ← login/register (name + PIN)
│   │   ├── game.js         ← game state, credit drops, timers
│   │   ├── betting.js      ← create/view/wager on bets
│   │   ├── roulette.js     ← wheel UI, spin animation, mini-games
│   │   ├── social.js       ← drink transfers, debt requests
│   │   ├── feed.js         ← activity log + notifications
│   │   ├── leaderboard.js  ← rankings (top + bottom)
│   │   └── admin.js        ← admin panel (approvals, game controls, player mgmt)
│   └── assets/             ← images, sounds, icons
└── .github/
    └── workflows/
        └── deploy.yml      ← GitHub Pages deploy action (optional)
```

## Authentication
- **No email/password** — uses Firebase Anonymous Auth under the hood
- Player enters first name + last initial + creates a 4-digit PIN
- PIN is stored hashed in Firestore (simple hash is fine, it's a drinking game)
- Login = match name + PIN against Firestore player doc
- Registration open for first 1 hour (4:30–5:30 PM), then admin-only creation
- Admin account is pre-seeded or uses a secret admin PIN

## Key Screens (all within single page, tab/view switching)

1. **Login/Register** — name input, PIN input, big "Join Game" button
2. **Dashboard** — balance (big, prominent), countdown to next credit drop, quick action buttons (Create Bet, Send Drinks, Roulette status)
3. **Bets** — list of active bets, tap to view/wager. Create bet form.
4. **Roulette** — wheel animation, bet amount input, mini-game overlays. Shows countdown when closed, "OPEN" flash when available.
5. **Activity Log** — scrollable feed of all events. Per-player notifications as toasts.
6. **Leaderboard** — top winners AND biggest losers
7. **Admin Panel** (admin only) — pending approvals queue, game start/pause/end, player list with balances, roulette slice editor, create player accounts

## Important Game Mechanics (Quick Reference)

| Mechanic | Detail |
|----------|--------|
| Credit drop | +5 drinks every 30 min to all players |
| Bet creation | Costs 3 drinks, must resolve within 1 hour |
| Bet odds | Parimutuel — ratio of FOR vs AGAINST pool |
| Bet minimum payout | Creator gets at least 2x if they win |
| All payouts | Rounded up to whole drinks |
| Roulette | Opens for 5 min at each credit drop, single spin |
| Roulette slices | Admin-configurable (multipliers, dice, mini-games) |
| Drink transfers | Player-to-player, no approval needed |
| Debt | Player drinks IRL to get credits, admin approves |
| Registration | Open 1 hour, then admin-only |

## Things NOT to Do
- Don't use a heavy framework (no Next.js, no React unless absolutely needed — vanilla JS or Preact/Alpine max)
- Don't add a build step that complicates deployment — keep it deployable as static files
- Don't over-engineer the auth — it's friends at a wedding, not a bank
- Don't forget emulator detection for local dev
- Don't make it desktop-friendly — mobile only, don't waste time on desktop layouts
