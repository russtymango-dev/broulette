# Agent handoff prompt — copy/paste into the next session

Paste the block below into a fresh Claude conversation (or Claude Code) along with the project files. It's written as a direct instruction to the agent.

---

You are picking up a project called **Broulette** — a real-time mobile drinking game built for Izzy & Kyle's wedding (Saturday 23 May 2026, 4:30 PM AEST). The frontend prototype is **fully built and interactive**; the Firebase backend is **not built yet** and is the main remaining work.

**Read these files first, in this order, before doing anything:**

1. `HANDOFF.md` — the source of truth for this project. Captures every design decision and every deviation from the original spec. Trust this over the older `CLAUDE.md` / `THOUGHT.md` wherever they conflict.
2. `Broulette.html` — the prototype entry point. Open it in a browser to see what's already working.
3. `store.jsx` — the in-memory game state. Every method here needs a Firestore equivalent. The shape was deliberately designed to map cleanly to the schema in `HANDOFF.md`.
4. `THOUGHT.md` and the original `CLAUDE.md` — the *original* brief. Useful for context but **superseded** by `HANDOFF.md` in any disagreement.

**Critical things you should know going in (these are deviations from the original spec — don't accidentally undo them):**

- Currency is "**sips**", not "drinks". 10 sips = 1 IRL drink.
- PINs are **6 digits**, not 4. Russell's hardcoded PIN: **787789**.
- The game starts on Russell's **manual button press** (from the admin Game tab), not at a fixed time. Status defaults to `'waiting'` in production — anyone who logs in before that sees a Lobby screen.
- Anyone can **sign up at any time**; Russell approves new players from Admin → Approvals. There's no longer a 1-hour registration window.
- Roulette is a **single shared spin per round**. Players bet on slices during a 5-minute window; one spin resolves it for everyone.
- **Bet payouts** have a universal **1.5× minimum** floor, rounded up — replaces the old "creator gets 2×" rule.
- **Skulls is non-bettable**. When it lands, every player drinks 2 sips IRL and the game grants everyone +2 sips automatically.
- **Sip Back is now ×1.5** (was ×0.5 in the original spec).
- Auto credit drops (+5 sips every 30 min) **plus** an opt-in "Buy more sips" request flow (up to 5 extra per round, Russell approves) — both are kept, not one-or-the-other.
- Russell can see all players' PINs from Admin → Players (tap row to reveal) — this is the lost-PIN recovery path. Don't remove this.
- Mini-games (Number Guess, Coin Flip, Higher/Lower, Shot Roulette, Dare or Drink) trigger **only** when the wheel lands on the Mini-Game slice. They aren't accessible standalone.

**Your job is the backend.** Specifically:

1. Create a Firebase project (Anonymous Auth + Firestore on the free Spark plan).
2. Write `firestore.rules` per the security model in `HANDOFF.md`.
3. Write `firestore.indexes.json` for the queries `store.jsx` uses.
4. Replace `store.jsx`'s in-memory store with Firestore reads/writes + `onSnapshot` listeners. The React subscribe/notify pattern in `store.jsx` already maps cleanly — every method that mutates `state` becomes a Firestore transaction. Collections and field names in `HANDOFF.md` match the API surface.
5. Hash PINs before storing them (a simple browser-side SHA-256 is sufficient — it's friends-at-a-wedding security, not a bank). Update `tryLogin` to compare hashes.
6. Set up `firebase.json` with emulator config for local dev.
7. Add a `scripts/seed.js` to populate the emulator with the demo players currently hardcoded in `store.jsx`.
8. Add the GitHub Pages deploy workflow (`.github/workflows/deploy.yml`) so pushes to `main` deploy `public/` (or whichever folder the bundled app lives in).
9. Detect `location.hostname === 'localhost'` and connect to the Firebase emulators when running locally.

**Don't touch the frontend prototype's UI / UX / copy** unless Russell explicitly asks. Every screen, animation, copy line, and palette decision is already settled and signed off. If you spot something that looks wrong, ask first.

**Two things to ask Russell before you wire the backend:**

- Does he want the wheel to **auto-spin** when the 5-minute betting window closes, or should he tap a "Spin" button manually? Currently auto-spins.
- Does he want bot mini-game auto-resolution to stay (4.5s timer, 40% win rate), or should those bets just be voided?

Read `HANDOFF.md` first. Then `Broulette.html`. Then `store.jsx`. Then ask any clarifying questions before you start writing code.
