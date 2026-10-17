# Random Bible Chapter

A tiny static web app that gives you a random, never-repeated Bible chapter
to read, and keeps track of what you've already read so you can work
through the whole Bible in random order without duplicates.

- No build step, no backend — plain HTML/CSS/JS.
- Reading progress is stored in your browser's `localStorage` (per browser,
  not synced across devices).
- A level, rank, and XP system turns your reading history into a number you
  can actually be proud of — see "Levels, XP, and anti-farming" below.
- Optionally, pasting a GitHub token under "Reading log sync" appends each
  chapter you mark as read to `reading-log.json` in a private GitHub repo
  (via the GitHub Contents API), so other tools (like a commentary pipeline)
  can look up what you read today. Using GitHub's API instead of a bespoke
  backend keeps the log reachable from sandboxed environments that only
  allow a small domain allowlist. The token is never stored in this repo —
  only in your browser's `localStorage` — and should be a fine-grained
  personal access token scoped to just that one repo's Contents permission.
- Randomness comes from the Web Crypto API (`crypto.getRandomValues`) with
  rejection sampling, rather than `Math.random()`. See "How random is it?"
  below.

## Running locally

Just open `index.html` in a browser, or serve the folder with any static
file server, e.g.:

```sh
python3 -m http.server
```

## Deploying to GitHub Pages

This repo includes a GitHub Actions workflow
(`.github/workflows/deploy.yml`) that deploys the site on every push to
`main`. To enable it:

1. Go to the repository's **Settings → Pages**.
2. Under "Build and deployment", set **Source** to **GitHub Actions**.
3. Push to `main` (or re-run the workflow) — the site will be published at
   `https://<username>.github.io/<repo>/`.

## Levels, XP, and anti-farming

Your level is meant to be an honest signal of how much time you've actually
spent reading Scripture — something you could tell a friend and have it mean
something — so it's deliberately hard to inflate:

- **A reading timer.** When a chapter comes up, "Mark as Read" stays disabled
  for a short dwell period. You can't rubber-stamp your way through the
  Bible with rapid clicks.
- **A daily soft cap on XP.** The first 15 chapters you mark in a calendar
  day earn full XP toward your level; chapters beyond that still count
  fully toward your reading progress and achievements, just at a reduced XP
  rate. A single binge session can't out-level weeks of steady, consistent
  reading.
- **Lifetime leveling.** Finishing every chapter of the Bible banks that
  cycle's XP permanently and automatically starts a fresh no-repeat cycle —
  your level never resets, and reading through the whole Bible again keeps
  raising it. Each full completion is tracked and shown on your level card,
  so "Level 63, two full journeys through Scripture" is a real, comparable
  achievement.

The one true reset is "Erase everything & start over" under Reading
history, which wipes your level and completions too — for when you
actually want to start from zero.

## Streaks, daily goal, and nudges

To make coming back every day feel good:

- **Daily streak.** Consecutive days with at least one chapter read. It stays
  alive until a full day passes with nothing read, and pulses when today's
  reading is still needed to save it. Streak milestones (3, 7, 14, 30, 60,
  100, 180, and 365 days) unlock a one-time achievement with bonus XP.
- **Daily goal.** Read 3 chapters in a day for a celebration. It's purely a
  celebration — no extra XP — so it can't be farmed.
- **Streak freezes.** Read 7 days in a row to earn a freeze (hold up to 2).
  If you miss a day, a freeze is spent automatically and your streak
  survives. A frozen day keeps the streak alive but doesn't add to it, and
  freezes are only spent if they cover the whole gap — a longer break loses
  the streak but keeps your freezes.
- **"Almost there" nudges.** The app points out when you're 1–3 chapters from
  finishing a book or a few chapters from the next milestone.
- **Instant feedback.** A floating "+XP" pop and a light haptic buzz (where
  supported) on every chapter you mark as read.

## Cloud backup

If you save a sync token (see "Reading log sync & cloud backup" in the app),
a full snapshot of your progress — history, achievements, lifetime level, and
streak freezes — is saved to `app-backup.json` in your private repo after
every chapter. If the browser ever wipes this site's data, paste your token
again and tap **Restore from cloud**.

- A backup is never overwritten by a device with *less* progress than it, so
  opening the app on a freshly wiped browser can't clobber your history.
- "Erase everything & start over" also erases the cloud copy.
- The token itself is never included in the backup.

## Bible Trivia

A trivia section built to teach you things you don't already know — obscure
ancient-Near-East background, archaeology, rare Hebrew/Greek/Aramaic words,
hapax legomena. Every question is a mini-lesson: the explanation always
shows, whether you got it right or not.

- **Adaptive difficulty.** Facts come in five tiers, from Warm-up to Master of
  Obscurity. Three new facts right in a row moves you up a tier; two misses in
  a row moves you down.
- **Spaced repetition.** A fact you get right comes back after 1, 3, 7, 14,
  30, 60, 120, 180, then 365 days. Forget one and it drops back toward the
  start so it sticks. Facts missed in a session get one more try at the end.
- **XP, with Scripture on top.** A new fact earns 2–6 XP (a chapter earns
  10). The big reward is remembering: a correct review earns a retention
  bonus that grows with the time since you last saw the fact — about 18 XP
  after a week, 30 after a month, and the 45 XP maximum at around six months.
- **Not farmable.** Only 5 new facts a day, reviews are offered only when
  they're due, and retries earn nothing.

The fact bank is split by theme: `trivia.js` (core), `trivia-prophecy.js`
(oracles set beside the extrabiblical records and excavations that bear on
them), `trivia-archaeology.js`, `trivia-language.js` (rare words, loanwords,
manuscripts), `trivia-ane.js` (Near Eastern background), and `trivia-discoveries.js` (major finds and how they were made, including celebrated claims that did not hold up). Each card can
carry an `src` field naming the inscription, text, or excavation behind it,
shown as "Evidence" after you answer.

Prophecy cards are written to separate what the sources document from what
scholars dispute — for example when Isaiah 40–55 or Daniel was composed, or
whether Tyre's later history matches Ezekiel 26 literally — rather than
claiming more than the evidence shows.

To add facts, push cards onto `TRIVIA_CARDS` from any `trivia-*.js` file and
load it in `index.html` (never rename or reuse an `id`, since progress is
stored by id). Keep the three wrong answers close in length and style to the
right one so length isn't a clue. Trivia progress is included in backups,
cloud backup, and reset.

## How random is it?

The app uses `crypto.getRandomValues()`, the browser's cryptographically
secure pseudorandom number generator (CSPRNG), instead of `Math.random()`.
It's seeded from the operating system's own entropy sources and is good
enough for security-sensitive uses like generating tokens — well beyond
what's needed here, but it also avoids the subtle statistical biases
`Math.random()` can have. The selection is also done via rejection
sampling over the exact number of unread chapters, so every remaining
chapter has an equal chance of being picked (no modulo bias).

True hardware randomness (e.g. from atmospheric noise or radioactive
decay) isn't available to a browser sandbox, so this is the strongest
randomness a client-side web app can offer.
