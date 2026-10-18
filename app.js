const STORAGE_KEY = "rbc:readLog";
const PENDING_KEY = "rbc:pending";
const PENDING_SINCE_KEY = "rbc:pendingSince";
const ACHIEVEMENTS_KEY = "rbc:achievements";
const LIFETIME_KEY = "rbc:lifetime";
const SYNC_SECRET_KEY = "rbc:syncSecret";
const FREEZES_KEY = "rbc:freezes";
const LAST_BACKUP_KEY = "rbc:lastBackupAt";
const TRIVIA_KEY = "rbc:trivia";
const QUESTIONS_KEY = "rbc:questions";
// The reading log lives as a JSON file in a private GitHub repo (rather
// than a custom backend) because GitHub's API is reachable from almost any
// sandboxed environment — including the one running the AI Bible
// Commentary skill that reads this file back — whereas a bespoke domain
// often isn't on a sandbox's network allowlist.
const SYNC_REPO_OWNER = "yeshuakurios";
const SYNC_REPO_NAME = "ai-bible-commentary";
const SYNC_REPO_PATH = "reading-log.json";
const SYNC_API_URL = `https://api.github.com/repos/${SYNC_REPO_OWNER}/${SYNC_REPO_NAME}/contents/${SYNC_REPO_PATH}`;
// A full snapshot of the app's state (not just the append-only read log), so
// progress survives the browser wiping this site's storage.
const BACKUP_REPO_PATH = "app-backup.json";
const BACKUP_API_URL = `https://api.github.com/repos/${SYNC_REPO_OWNER}/${SYNC_REPO_NAME}/contents/${BACKUP_REPO_PATH}`;

// Achievement labels contain emoji, which plain btoa()/atob() can't handle
// (they only support Latin1) — encode/decode via UTF-8 bytes instead.
function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function fromBase64(b64) {
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const els = {
  chapter: document.getElementById("chapter-display"),
  getBtn: document.getElementById("get-btn"),
  markBtn: document.getElementById("mark-btn"),
  skipBtn: document.getElementById("skip-btn"),
  readTimer: document.getElementById("read-timer"),
  readTimerFill: document.getElementById("read-timer-fill"),
  readTimerLabel: document.getElementById("read-timer-label"),
  progressText: document.getElementById("progress-text"),
  progressBar: document.getElementById("progress-bar"),
  historyList: document.getElementById("history-list"),
  resetBtn: document.getElementById("reset-btn"),
  actionRow: document.getElementById("action-row"),
  todayCount: document.getElementById("today-count"),
  todayList: document.getElementById("today-list"),
  trendText: document.getElementById("trend-text"),
  achievementsCount: document.getElementById("achievements-count"),
  achievementsList: document.getElementById("achievements-list"),
  bookMap: document.getElementById("book-map"),
  toastContainer: document.getElementById("toast-container"),
  backupBtn: document.getElementById("backup-btn"),
  backupOutput: document.getElementById("backup-output"),
  restoreInput: document.getElementById("restore-input"),
  restoreBtn: document.getElementById("restore-btn"),
  backupStatus: document.getElementById("backup-status"),
  syncSecretInput: document.getElementById("sync-secret-input"),
  syncSaveBtn: document.getElementById("sync-save-btn"),
  syncStatus: document.getElementById("sync-status"),
  rankName: document.getElementById("rank-name"),
  levelRing: document.getElementById("level-ring"),
  levelBadge: document.getElementById("level-badge"),
  xpBar: document.getElementById("xp-bar"),
  xpText: document.getElementById("xp-text"),
  xpCapNote: document.getElementById("xp-cap-note"),
  completionsLine: document.getElementById("completions-line"),
  streakChip: document.getElementById("streak-chip"),
  goalChip: document.getElementById("goal-chip"),
  nudge: document.getElementById("nudge"),
  freezeChip: document.getElementById("freeze-chip"),
  triviaStatus: document.getElementById("trivia-status"),
  triviaStart: document.getElementById("trivia-start"),
  triviaQuiz: document.getElementById("trivia-quiz"),
  triviaMeta: document.getElementById("trivia-meta"),
  triviaQuestion: document.getElementById("trivia-question"),
  triviaChoices: document.getElementById("trivia-choices"),
  triviaFeedback: document.getElementById("trivia-feedback"),
  triviaResult: document.getElementById("trivia-result"),
  triviaExplain: document.getElementById("trivia-explain"),
  triviaSrc: document.getElementById("trivia-src"),
  triviaNext: document.getElementById("trivia-next"),
  triviaEnd: document.getElementById("trivia-end"),
  readerDetails: document.getElementById("reader"),
  readerSummary: document.getElementById("reader-summary"),
  readerVersionRow: document.getElementById("reader-version-row"),
  readerVersionBtn: document.getElementById("reader-version-btn"),
  readerText: document.getElementById("reader-text"),
  readerMarkRow: document.getElementById("reader-mark-row"),
  markBtn2: document.getElementById("mark-btn-2"),
  questionsDetails: document.getElementById("questions"),
  questionsCount: document.getElementById("questions-count"),
  qForm: document.getElementById("q-form"),
  qPassage: document.getElementById("q-passage"),
  qVersion: document.getElementById("q-version"),
  qVersionOther: document.getElementById("q-version-other"),
  qText: document.getElementById("q-text"),
  qList: document.getElementById("q-list"),
  qIncludeText: document.getElementById("q-include-text"),
  qCopy: document.getElementById("q-copy"),
  qPreview: document.getElementById("q-preview"),
  qStatus: document.getElementById("q-status"),
  qClear: document.getElementById("q-clear"),
  cloudRestoreBtn: document.getElementById("cloud-restore-btn"),
  cloudStatus: document.getElementById("cloud-status"),
  levelupModal: document.getElementById("levelup-modal"),
  levelupKicker: document.getElementById("levelup-kicker"),
  levelupLevel: document.getElementById("levelup-level"),
  levelupRank: document.getElementById("levelup-rank"),
  levelupRankup: document.getElementById("levelup-rankup"),
  levelupCompletion: document.getElementById("levelup-completion"),
  levelupDismiss: document.getElementById("levelup-dismiss"),
};

const TOTAL_CHAPTERS = BIBLE_BOOKS.reduce((sum, [, count]) => sum + count, 0);
const BOOK_INDEX = new Map(BIBLE_BOOKS.map(([name], i) => [name, i]));
const OT_BOOKS = BIBLE_BOOKS.slice(0, 39);
const NT_BOOKS = BIBLE_BOOKS.slice(39);
const OT_TOTAL = OT_BOOKS.reduce((sum, [, count]) => sum + count, 0);
const NT_TOTAL = NT_BOOKS.reduce((sum, [, count]) => sum + count, 0);
const HALFWAY = Math.round(TOTAL_CHAPTERS / 2);
const MILESTONES = [1, 10, 25, 50, 100, 250, HALFWAY, 750, 1000, TOTAL_CHAPTERS];
const TREND_WINDOW_DAYS = 7;

// --- XP, levels, and ranks. Levels grow linearly (a flat XP amount per
// level, not an escalating one) so progress always feels the same weight.
//
// Anti-farming: XP is deliberately hard to grind past a genuine reading
// pace. Two independent brakes apply:
//   1. A minimum "dwell time" before a chapter can be marked read at all
//      (see MIN_READ_SECONDS) — you can't rubber-stamp your way through
//      the Bible with rapid clicks.
//   2. A soft daily cap on full-value XP (see DAILY_FULL_XP_CAP) — chapters
//      beyond the cap still count toward real reading progress and
//      achievements, they just earn reduced XP toward your level, so a
//      single binge session can't out-level weeks of steady reading.
// On top of that, your level is "lifetime" — finishing the whole Bible
// banks that cycle's XP permanently and starts a fresh no-repeat cycle, so
// re-reading the whole Bible keeps raising your level rather than
// resetting it. Level is meant to be an honest reflection of cumulative
// time spent in Scripture, not a number that can be cheaply inflated.
const XP_PER_CHAPTER_FULL = 10;
const XP_PER_CHAPTER_REDUCED = 3;
const DAILY_FULL_XP_CAP = 15;
const MIN_READ_SECONDS = 25;
const XP_PER_LEVEL = 100;

// --- Habit loop: a daily streak and a small daily goal. Both reward showing
// up consistently rather than binging, so they sit alongside (and don't
// weaken) the anti-farming rules above — streak bonuses are one-time per
// milestone, and the goal is purely a celebration, not extra XP.
const DAILY_GOAL = 3;
// Streak freezes: read 7 days in a row to earn one (hold up to 2). A freeze
// is spent automatically on a missed day so a single slip doesn't erase a
// long streak. A frozen day keeps the streak alive but doesn't add to it.
const FREEZE_EARN_EVERY_DAYS = 7;
const MAX_FREEZES = 2;
const STREAK_MILESTONES = [
  { days: 3, xp: 15 },
  { days: 7, xp: 30 },
  { days: 14, xp: 50 },
  { days: 30, xp: 100 },
  { days: 60, xp: 150 },
  { days: 100, xp: 250 },
  { days: 180, xp: 400 },
  { days: 365, xp: 1000 },
];

// Ranks come quickly at first (a new title every level or two while you're
// getting started, roughly every 10-20 chapters) and stretch out as levels
// climb, so there's always a title within reach.
const RANKS = [
  { min: 1, name: "Seeker" },
  { min: 2, name: "Inquirer" },
  { min: 3, name: "Hearer" },
  { min: 4, name: "Learner" },
  { min: 5, name: "Believer" },
  { min: 6, name: "Disciple" },
  { min: 8, name: "Follower of the Way" },
  { min: 10, name: "Servant" },
  { min: 12, name: "Reader of the Word" },
  { min: 14, name: "Psalmist" },
  { min: 17, name: "Scribe" },
  { min: 20, name: "Watchman" },
  { min: 23, name: "Intercessor" },
  { min: 26, name: "Evangelist" },
  { min: 30, name: "Shepherd" },
  { min: 34, name: "Teacher" },
  { min: 38, name: "Elder" },
  { min: 43, name: "Prophet" },
  { min: 48, name: "Apostle" },
  { min: 54, name: "Overseer" },
  { min: 60, name: "Sage of Scripture" },
  { min: 68, name: "Faithful Witness" },
  { min: 78, name: "Keeper of the Covenant" },
  { min: 90, name: "Steward of the Mysteries" },
  { min: 105, name: "Pillar of the Church" },
  { min: 120, name: "Friend of God" },
  { min: 145, name: "Beloved of God" },
];

function milestoneXp(n) {
  if (n === TOTAL_CHAPTERS) return 500;
  if (n === HALFWAY) return 100;
  return 20;
}

function levelForXp(xp) {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

function xpIntoLevel(xp) {
  return xp % XP_PER_LEVEL;
}

function getRank(level) {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (level >= r.min) current = r;
    else break;
  }
  return current;
}

function ordinal(n) {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`;
}

function allChapterKeys() {
  const keys = [];
  for (const [book, count] of BIBLE_BOOKS) {
    for (let ch = 1; ch <= count; ch++) keys.push(`${book} ${ch}`);
  }
  return keys;
}

function splitKey(key) {
  const lastSpace = key.lastIndexOf(" ");
  return [key.slice(0, lastSpace), Number(key.slice(lastSpace + 1))];
}

// --- Read log: an append-only array of { k: chapterKey, t: timestamp,
// xp: xpEarned }. Order doubles as "the exact order chapters were read in".
// `t` is null and `xp` is absent for entries migrated from an older version
// of the app that didn't record them.

function loadReadLog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (parsed.length > 0 && typeof parsed[0] === "string") {
      const migrated = parsed.map((k) => ({ k, t: null }));
      saveReadLog(migrated);
      return migrated;
    }
    return parsed;
  } catch {
    return [];
  }
}

function saveReadLog(log) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
}

function readKeysSet(log) {
  return new Set(log.map((e) => e.k));
}

function loadPending() {
  return localStorage.getItem(PENDING_KEY);
}

function loadPendingSince() {
  const raw = localStorage.getItem(PENDING_SINCE_KEY);
  return raw ? Number(raw) : null;
}

function savePending(key) {
  if (key === null) {
    localStorage.removeItem(PENDING_KEY);
    localStorage.removeItem(PENDING_SINCE_KEY);
  } else {
    localStorage.setItem(PENDING_KEY, key);
    localStorage.setItem(PENDING_SINCE_KEY, String(Date.now()));
  }
}

// --- Lifetime XP: banked permanently across reading cycles, so finishing
// the whole Bible (and starting again) keeps raising your level instead of
// resetting it.

function loadLifetime() {
  try {
    const raw = localStorage.getItem(LIFETIME_KEY);
    if (!raw) return { bankedXp: 0, completions: [] };
    const parsed = JSON.parse(raw);
    return {
      bankedXp: typeof parsed.bankedXp === "number" ? parsed.bankedXp : 0,
      completions: Array.isArray(parsed.completions) ? parsed.completions : [],
    };
  } catch {
    return { bankedXp: 0, completions: [] };
  }
}

function saveLifetime(lifetime) {
  localStorage.setItem(LIFETIME_KEY, JSON.stringify(lifetime));
}

function computeCycleXp(log, achievements) {
  const chapterXp = log.reduce((sum, e) => sum + (typeof e.xp === "number" ? e.xp : XP_PER_CHAPTER_FULL), 0);
  const bonusXp = achievements.reduce((sum, a) => sum + (a.xp || 0), 0);
  return chapterXp + bonusXp;
}

function computeLifetimeXp(log, achievements) {
  return loadLifetime().bankedXp + computeCycleXp(log, achievements) + loadTrivia().xp;
}

// The daily cap looks at how many chapters have already been logged today
// (regardless of what they earned) to decide the rate for the *next* one.
function xpForNextChapter(log) {
  const todayCount = computeTodayEntries(log).length;
  return todayCount < DAILY_FULL_XP_CAP ? XP_PER_CHAPTER_FULL : XP_PER_CHAPTER_REDUCED;
}

// Called whenever a cycle's read set turns out to be complete (either via
// a live "Mark as Read" or a self-heal on load, e.g. after restoring a
// backup). Banks the cycle's XP permanently and clears per-cycle state so
// a fresh no-repeat cycle can begin.
function bankCycleCompletion(log, achievements) {
  const cycleXp = computeCycleXp(log, achievements);
  const lifetime = loadLifetime();
  lifetime.bankedXp += cycleXp;
  lifetime.completions.push(Date.now());
  saveLifetime(lifetime);
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(ACHIEVEMENTS_KEY);
  return lifetime;
}

// --- Reading log sync: best-effort append of each marked-read chapter to
// reading-log.json in a private GitHub repo, so external tools (e.g. the
// AI Bible Commentary skill) can find "read today" chapters without access
// to this browser's localStorage. The token never ships in this repo's
// source — it's pasted in by hand and kept only in localStorage.

function loadSyncSecret() {
  return localStorage.getItem(SYNC_SECRET_KEY);
}

function saveSyncSecret(secret) {
  if (secret) localStorage.setItem(SYNC_SECRET_KEY, secret);
  else localStorage.removeItem(SYNC_SECRET_KEY);
}

async function syncReadChapter(key, timestamp) {
  const token = loadSyncSecret();
  if (!token) return;
  try {
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    };
    let sha;
    let entries = [];
    const getRes = await fetch(SYNC_API_URL, { headers });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
      entries = JSON.parse(fromBase64(data.content.replace(/\s/g, "")));
    } else if (getRes.status !== 404) {
      return; // Best-effort only — don't retry or surface an error.
    }

    entries.push({ k: key, t: timestamp, date: localDateKey(new Date(timestamp)) });
    await fetch(SYNC_API_URL, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Log read: ${key}`,
        content: toBase64(JSON.stringify(entries)),
        ...(sha ? { sha } : {}),
      }),
    });
  } catch {
    // Best-effort only — reading progress is already saved locally
    // regardless of whether the sync call succeeds.
  }
}

function handleSyncSave() {
  const secret = els.syncSecretInput.value.trim();
  saveSyncSecret(secret);
  els.syncSecretInput.value = "";
  els.syncStatus.textContent = secret ? "Sync key saved on this device." : "Sync key cleared.";
  renderCloudStatus();
  if (secret) checkCloudOnLoad();
}

// --- Cloud backup: a full snapshot of progress (log, achievements, lifetime
// XP, streak freezes) pushed to app-backup.json in the same private repo after
// every chapter. The sync token itself is stored in localStorage, so if the
// browser wipes this site's data the token goes too — recovery is: paste the
// token again, then tap "Restore from cloud".

function buildBackupPayload() {
  return {
    v: 5,
    log: loadReadLog(),
    achievements: loadAchievements(),
    lifetime: loadLifetime(),
    freezes: loadFreezes(),
    trivia: loadTrivia(),
    questions: loadQuestions(),
  };
}

function applyBackupPayload(payload) {
  saveReadLog(payload.log);
  saveAchievements(Array.isArray(payload.achievements) ? payload.achievements : []);
  const lifetime = payload.lifetime && typeof payload.lifetime === "object" ? payload.lifetime : {};
  saveLifetime({
    bankedXp: typeof lifetime.bankedXp === "number" ? lifetime.bankedXp : 0,
    completions: Array.isArray(lifetime.completions) ? lifetime.completions : [],
  });
  const freezes = payload.freezes && typeof payload.freezes === "object" ? payload.freezes : {};
  saveFreezes({
    available: typeof freezes.available === "number" ? freezes.available : 0,
    used: Array.isArray(freezes.used) ? freezes.used : [],
    grantedOn: Array.isArray(freezes.grantedOn) ? freezes.grantedOn : [],
  });
  saveTrivia(sanitizeTrivia(payload.trivia));
  // Questions are the user's own writing: an older backup that predates
  // them must not wipe the ones already on this device.
  if (payload.questions !== undefined) saveQuestions(sanitizeQuestions(payload.questions));
  triviaSession = null;
  els.triviaQuiz.hidden = true;
  localStorage.removeItem(PENDING_KEY);
  localStorage.removeItem(PENDING_SINCE_KEY);
}

// Total chapters read across every completed cycle plus the current one —
// used to make sure an emptied browser never overwrites a fuller backup.
function progressScore(payload) {
  const completions = Array.isArray(payload?.lifetime?.completions) ? payload.lifetime.completions.length : 0;
  const logLength = Array.isArray(payload?.log) ? payload.log.length : 0;
  const triviaCards = payload?.trivia?.cards && typeof payload.trivia.cards === "object" ? Object.keys(payload.trivia.cards).length : 0;
  return completions * TOTAL_CHAPTERS + logLength + triviaCards;
}

function githubHeaders(token) {
  return { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };
}

// Resolves to { sha, payload } (both null if there's no backup yet), or
// throws if GitHub couldn't be reached / refused the request.
async function fetchCloudBackup(token) {
  const res = await fetch(BACKUP_API_URL, { headers: githubHeaders(token), cache: "no-store" });
  if (res.status === 404) return { sha: null, payload: null };
  if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
  const data = await res.json();
  let payload = null;
  try {
    payload = JSON.parse(fromBase64(data.content.replace(/\s/g, "")));
  } catch {
    // A corrupt remote file is treated as "no usable backup".
  }
  return { sha: data.sha, payload };
}

function setCloudStatus(text) {
  els.cloudStatus.textContent = text;
}

function renderCloudStatus() {
  if (!loadSyncSecret()) {
    setCloudStatus("Save a sync token above to turn on automatic cloud backup.");
    return;
  }
  const at = Number(localStorage.getItem(LAST_BACKUP_KEY));
  setCloudStatus(at ? `☁️ Last cloud backup: ${new Date(at).toLocaleString()}` : "☁️ Cloud backup is on — it saves after your next chapter.");
}

let backupTimer = null;
let backupChain = Promise.resolve();

// Debounced so a burst of actions makes one write; serialized so two
// overlapping pushes can't race on the file's sha.
function scheduleBackupSync() {
  if (!loadSyncSecret()) return;
  clearTimeout(backupTimer);
  backupTimer = setTimeout(() => {
    backupChain = backupChain.then(() => pushBackup()).catch(() => {});
  }, 1500);
}

async function pushBackup({ force = false } = {}) {
  const token = loadSyncSecret();
  if (!token) return;
  try {
    const local = buildBackupPayload();
    const { sha, payload: remote } = await fetchCloudBackup(token);
    if (!force && remote && progressScore(remote) > progressScore(local)) {
      setCloudStatus("⚠️ Your cloud backup has more progress than this device, so it was not overwritten. Tap \"Restore from cloud\" to recover it.");
      return;
    }
    const putRes = await fetch(BACKUP_API_URL, {
      method: "PUT",
      headers: { ...githubHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Back up app state",
        content: toBase64(JSON.stringify(local)),
        ...(sha ? { sha } : {}),
      }),
    });
    if (!putRes.ok) throw new Error(`GitHub responded ${putRes.status}`);
    localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
    renderCloudStatus();
  } catch {
    setCloudStatus("⚠️ Cloud backup failed — it will retry after your next chapter.");
  }
}

async function handleCloudRestore() {
  const token = loadSyncSecret();
  if (!token) {
    setCloudStatus("Save your sync token first, then tap Restore from cloud.");
    return;
  }
  setCloudStatus("Checking for a cloud backup…");
  let remote;
  try {
    remote = (await fetchCloudBackup(token)).payload;
  } catch {
    setCloudStatus("Couldn't reach the cloud backup — check your token and connection.");
    return;
  }
  if (!remote || !Array.isArray(remote.log)) {
    setCloudStatus("No cloud backup was found yet.");
    return;
  }
  const hasLocal = progressScore(buildBackupPayload()) > 0;
  if (hasLocal && !confirm("This replaces your current reading history, achievements, level, and freezes with your cloud backup. Continue?")) {
    renderCloudStatus();
    return;
  }
  applyBackupPayload(remote);
  render();
  setCloudStatus("✅ Restored from your cloud backup!");
}

// If this browser has no progress (e.g. storage was wiped) but a sync token
// is present, tell the user a backup is waiting rather than letting them
// start over by accident.
async function checkCloudOnLoad() {
  const token = loadSyncSecret();
  if (!token || progressScore(buildBackupPayload()) > 0) return;
  try {
    const { payload } = await fetchCloudBackup(token);
    if (payload && progressScore(payload) > 0) {
      showToasts([{ label: "☁️ A cloud backup was found — open Reading log sync to restore it." }]);
      setCloudStatus("☁️ A cloud backup is available — tap \"Restore from cloud\".");
    }
  } catch {
    // Best-effort only.
  }
}

// Uniform random integer in [0, max) using the Web Crypto API (rejection
// sampling avoids the modulo bias a plain `% max` would introduce).
function secureRandomInt(max) {
  const range = Math.floor(4294967296 / max) * max; // largest multiple of max <= 2^32
  const buf = new Uint32Array(1);
  let value;
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= range);
  return value % max;
}

function pickRandomUnread(readSet, excludeKey) {
  let unread = allChapterKeys().filter((k) => !readSet.has(k));
  if (unread.length === 0) return null;
  if (excludeKey) {
    const withoutExclude = unread.filter((k) => k !== excludeKey);
    if (withoutExclude.length > 0) unread = withoutExclude;
  }
  return unread[secureRandomInt(unread.length)];
}

// --- The shared random order. par/queue.json is one fixed shuffle of every chapter;
// the app hands out the next unread chapter in it, and the KJV27 pipeline modernizes
// chapters in the same order, so modernized text is ready for what you read next.
// Skipping sends a chapter to the back of the line. After a first full read-through
// (or if the file can't be loaded) it's the old behaviour: a random unread chapter.

const SKIPPED_KEY = "rbc:skipped";
let queueOrder = null;

async function loadQueue() {
  try {
    const res = await fetch("par/queue.json", { cache: "no-cache" });
    if (!res.ok) return;
    const order = (await res.json()).order;
    const valid = new Set(allChapterKeys());
    if (Array.isArray(order) && order.length === valid.size && order.every((k) => valid.has(k))) queueOrder = order;
  } catch {
    // no queue: random unread chapters, as before
  }
}

function loadSkipped() {
  try {
    const list = JSON.parse(localStorage.getItem(SKIPPED_KEY) || "[]");
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

function saveSkipped(set) {
  try {
    localStorage.setItem(SKIPPED_KEY, JSON.stringify([...set]));
  } catch {
    // skipped chapters just come back sooner
  }
}

function pickNextChapter(readSet, excludeKey) {
  if (queueOrder && loadLifetime().completions.length === 0) {
    const skipped = loadSkipped();
    const first = (skip) => queueOrder.find((k) => !readSet.has(k) && !skip.has(k) && k !== excludeKey);
    let key = first(skipped);
    if (!key && skipped.size) {
      saveSkipped(new Set()); // every unread chapter has been skipped once: start the line again
      key = first(new Set());
    }
    if (key) return key;
  }
  return pickRandomUnread(readSet, excludeKey);
}

function computeBookCounts(readSet) {
  const counts = new Map();
  for (const key of readSet) {
    const [book] = splitKey(key);
    counts.set(book, (counts.get(book) || 0) + 1);
  }
  return counts;
}

// --- Daily stats

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function computeDayCounts(log) {
  const counts = new Map();
  for (const { t } of log) {
    if (t == null) continue;
    const key = localDateKey(new Date(t));
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function computeTodayEntries(log) {
  const todayKey = localDateKey(new Date());
  return log.filter((e) => e.t != null && localDateKey(new Date(e.t)) === todayKey);
}

function computeTrend(dayCounts, remaining) {
  if (remaining <= 0) return { done: true };
  const now = new Date();
  let sum = 0;
  for (let i = 0; i < TREND_WINDOW_DAYS; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    sum += dayCounts.get(localDateKey(d)) || 0;
  }
  const avgPerDay = sum / TREND_WINDOW_DAYS;
  if (avgPerDay <= 0) return { done: false, avgPerDay: 0 };
  const daysLeft = Math.ceil(remaining / avgPerDay);
  const finishDate = new Date(now);
  finishDate.setDate(finishDate.getDate() + daysLeft);
  return { done: false, avgPerDay, daysLeft, finishDate };
}

// Consecutive days with at least one chapter read. A streak is still "alive"
// if you haven't read yet today but did yesterday — it only breaks once a
// whole day passes with nothing read.
function computeStreak(dayCounts, frozen = new Set()) {
  const isRead = (key) => (dayCounts.get(key) || 0) > 0;
  const day = new Date();
  const readToday = isRead(localDateKey(day));
  if (!readToday) day.setDate(day.getDate() - 1);
  let current = 0;
  for (;;) {
    const key = localDateKey(day);
    if (isRead(key)) current++;
    else if (!frozen.has(key)) break;
    day.setDate(day.getDate() - 1);
  }

  // Best run over every read-or-frozen day (frozen days bridge, not count).
  const keys = [...new Set([...dayCounts.keys(), ...frozen])].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const key of keys) {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const consecutive = prev && Math.round((date - prev) / 86400000) === 1;
    if (isRead(key)) run = consecutive ? run + 1 : 1;
    else run = consecutive ? run : 0;
    best = Math.max(best, run);
    prev = date;
  }
  return { current, best: Math.max(best, current), readToday };
}

// --- Streak freezes

function loadFreezes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FREEZES_KEY) || "{}");
    return {
      available: typeof parsed.available === "number" ? parsed.available : 0,
      used: Array.isArray(parsed.used) ? parsed.used : [],
      grantedOn: Array.isArray(parsed.grantedOn) ? parsed.grantedOn : [],
    };
  } catch {
    return { available: 0, used: [], grantedOn: [] };
  }
}

function saveFreezes(freezes) {
  localStorage.setItem(FREEZES_KEY, JSON.stringify(freezes));
}

function frozenSet() {
  return new Set(loadFreezes().used);
}

// Spends freezes on the days missed since the last day that was read (or
// frozen), but only if there are enough to cover the whole gap — otherwise
// the streak is lost anyway and the freezes are kept. Today is never
// "missed": there's still time to read. Returns the days it froze.
function applyFreezes(log) {
  const freezes = loadFreezes();
  if (freezes.available <= 0) return [];
  const dayCounts = computeDayCounts(log);
  const frozen = new Set(freezes.used);
  const covered = (key) => (dayCounts.get(key) || 0) > 0 || frozen.has(key);

  const day = new Date();
  day.setDate(day.getDate() - 1);
  const missed = [];
  while (!covered(localDateKey(day)) && missed.length <= MAX_FREEZES) {
    missed.push(localDateKey(day));
    day.setDate(day.getDate() - 1);
  }
  if (missed.length === 0 || missed.length > freezes.available || !covered(localDateKey(day))) return [];

  freezes.available -= missed.length;
  freezes.used.push(...missed);
  saveFreezes(freezes);
  return missed;
}

// Earn one freeze each time the streak hits a multiple of 7 days.
function maybeGrantFreeze(streakDays) {
  if (streakDays <= 0 || streakDays % FREEZE_EARN_EVERY_DAYS !== 0) return false;
  const freezes = loadFreezes();
  const today = localDateKey(new Date());
  if (freezes.grantedOn.includes(today) || freezes.available >= MAX_FREEZES) return false;
  freezes.available++;
  freezes.grantedOn.push(today);
  saveFreezes(freezes);
  return true;
}

// The most compelling "just a little more" hook: a book you're close to
// finishing, else how far the next chapter-count milestone is.
function computeNudge(readSet, todayCount) {
  const bookCounts = computeBookCounts(readSet);
  let closest = null;
  for (const [book, total] of BIBLE_BOOKS) {
    const read = bookCounts.get(book) || 0;
    const left = total - read;
    if (read > 0 && left > 0 && (!closest || left < closest.left)) closest = { book, left };
  }
  if (closest && closest.left <= 3) {
    const { book, left } = closest;
    return `📖 Only ${left} chapter${left === 1 ? "" : "s"} left to finish ${book}!`;
  }
  const next = MILESTONES.find((m) => m > readSet.size);
  if (next) {
    const left = next - readSet.size;
    if (left <= 10) return `🎯 ${left} more chapter${left === 1 ? "" : "s"} to reach ${next}!`;
  }
  if (todayCount > 0 && todayCount < DAILY_GOAL) {
    const left = DAILY_GOAL - todayCount;
    return `🔥 ${left} more to hit today's goal — you're on a roll!`;
  }
  return "";
}

// --- Achievements

function loadAchievements() {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAchievements(list) {
  localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(list));
}

function milestoneLabel(n) {
  if (n === TOTAL_CHAPTERS) return "You've read the entire Bible! 🏆";
  if (n === HALFWAY) return `Halfway through the Bible — ${n} chapters! 🎉`;
  if (n === 1) return "First chapter read! 🎉";
  return `${n} chapters read!`;
}

function computeNewBadges(newReadSet, markedKey, streakDays) {
  const unlocked = new Set(loadAchievements().map((a) => a.id));
  const newBadges = [];
  const n = newReadSet.size;

  for (const m of MILESTONES) {
    if (n === m) {
      const id = `milestone-${m}`;
      if (!unlocked.has(id)) newBadges.push({ id, label: milestoneLabel(m), xp: milestoneXp(m) });
    }
  }

  for (const m of STREAK_MILESTONES) {
    if (streakDays === m.days) {
      const id = `streak-${m.days}`;
      if (!unlocked.has(id)) newBadges.push({ id, label: `${m.days}-day reading streak! 🔥`, xp: m.xp });
    }
  }

  const [book] = splitKey(markedKey);
  const bookCounts = computeBookCounts(newReadSet);
  const bookTotal = BIBLE_BOOKS.find(([b]) => b === book)[1];
  if (bookCounts.get(book) === bookTotal) {
    const id = `book-${book}`;
    if (!unlocked.has(id)) newBadges.push({ id, label: `Finished the book of ${book}! 📖`, xp: 25 });
  }

  const isOT = BOOK_INDEX.get(book) < OT_BOOKS.length;
  const testamentBooks = isOT ? OT_BOOKS : NT_BOOKS;
  const testamentTotal = isOT ? OT_TOTAL : NT_TOTAL;
  const testamentReadCount = testamentBooks.reduce((sum, [b]) => sum + (bookCounts.get(b) || 0), 0);
  if (testamentReadCount === testamentTotal) {
    const name = isOT ? "Old Testament" : "New Testament";
    const id = `testament-${name}`;
    if (!unlocked.has(id)) newBadges.push({ id, label: `Finished the ${name}! 🎉`, xp: 100 });
  }

  return newBadges;
}

function persistAchievements(newBadges) {
  if (newBadges.length === 0) return;
  const list = loadAchievements();
  const now = Date.now();
  for (const badge of newBadges) list.push({ ...badge, at: now });
  saveAchievements(list);
}

function showToasts(newBadges) {
  newBadges.forEach((badge, i) => {
    setTimeout(() => {
      const toast = document.createElement("div");
      toast.className = "toast";
      toast.textContent = badge.label;
      els.toastContainer.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add("show"));
      setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
      }, 3600);
    }, i * 400);
  });
}

function resetLevelupModal() {
  els.levelupModal.classList.remove("epic");
  els.levelupKicker.textContent = "📖 Level Up! 📖";
  els.levelupCompletion.hidden = true;
}

function showLevelUp(newLevel, oldRank, newRank) {
  resetLevelupModal();
  const rankedUp = newRank.name !== oldRank.name;
  els.levelupLevel.textContent = `Level ${newLevel}`;
  els.levelupRank.textContent = newRank.name;
  els.levelupRankup.hidden = !rankedUp;
  els.levelupModal.hidden = false;
  requestAnimationFrame(() => els.levelupModal.classList.add("show"));
}

function showBibleCompleted(completionCount, newLevel, newRank) {
  resetLevelupModal();
  els.levelupModal.classList.add("epic");
  els.levelupKicker.textContent = "🏆 The Whole Bible — Complete! 🏆";
  els.levelupLevel.textContent = `Level ${newLevel}`;
  els.levelupRank.textContent = newRank.name;
  els.levelupRankup.hidden = true;
  els.levelupCompletion.hidden = false;
  els.levelupCompletion.textContent =
    completionCount === 1
      ? "This is your first full journey through Scripture. 📖✨"
      : `This is your ${ordinal(completionCount)} full journey through Scripture. 📖✨`;
  els.levelupModal.hidden = false;
  requestAnimationFrame(() => els.levelupModal.classList.add("show"));
}

function hideLevelUp() {
  els.levelupModal.classList.remove("show");
  setTimeout(() => {
    els.levelupModal.hidden = true;
  }, 300);
}

// --- Bible Trivia: obscure facts (see trivia.js), taught one at a time and
// brought back on a spaced-repetition schedule.
//
// XP is deliberately small next to reading: a new fact earns 2-6 XP (a
// chapter earns 10). The big payoff is remembering a fact after a long gap —
// the retention bonus grows with the time since you last saw it, up to 45 XP
// at about six months. Anti-farming: a fact pays its base XP only the first
// time you ever answer it, so total new-fact XP is capped by the size of the
// fact bank however fast you go, and a fact can't be reviewed again until
// it's due.
const TRIVIA_BY_ID = new Map(TRIVIA_CARDS.map((c) => [c.id, c]));
const TRIVIA_RETRY_GAP = 4; // questions before a missed fact is asked again
const TRIVIA_NEW_XP = [2, 3, 4, 5, 6]; // by the card's tier
const TRIVIA_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60, 120, 180, 365];
const TRIVIA_MAX_BONUS = 45;
// Trivia XP per answer shrinks as the fact bank grows past this size, so a huge
// bank can't out-earn reading Scripture. Total possible XP still grows, but
// only with the square root of the bank size.
const TRIVIA_XP_FULL_BANK = 200;
const TRIVIA_MAX_REVIEWS_PER_SESSION = 15;
const TRIVIA_TIER_NAMES = ["Warm-up", "Student", "Scholar", "Expert", "Master of Obscurity"];
const DAY_MS = 86400000;

function emptyTrivia() {
  return { xp: 0, cards: {}, skill: { tier: 1, streak: 0, miss: 0 } };
}

function sanitizeTrivia(raw) {
  const t = emptyTrivia();
  if (!raw || typeof raw !== "object") return t;
  if (typeof raw.xp === "number") t.xp = raw.xp;
  if (raw.cards && typeof raw.cards === "object") {
    for (const [id, c] of Object.entries(raw.cards)) {
      if (c && typeof c.level === "number" && typeof c.due === "number") {
        t.cards[id] = {
          level: c.level,
          due: c.due,
          last: typeof c.last === "number" ? c.last : c.due,
          reps: typeof c.reps === "number" ? c.reps : 1,
          lapses: typeof c.lapses === "number" ? c.lapses : 0,
        };
      }
    }
  }
  if (raw.skill && typeof raw.skill === "object") {
    const tier = Number(raw.skill.tier);
    t.skill.tier = tier >= 1 && tier <= TRIVIA_TIER_NAMES.length ? Math.floor(tier) : 1;
    t.skill.streak = Number(raw.skill.streak) || 0;
    t.skill.miss = Number(raw.skill.miss) || 0;
  }
  return t;
}

function loadTrivia() {
  try {
    return sanitizeTrivia(JSON.parse(localStorage.getItem(TRIVIA_KEY) || "null"));
  } catch {
    return emptyTrivia();
  }
}

function saveTrivia(trivia) {
  localStorage.setItem(TRIVIA_KEY, JSON.stringify(trivia));
}

function triviaDueIds(trivia, now = Date.now()) {
  return Object.entries(trivia.cards)
    .filter(([id, c]) => c.due <= now && TRIVIA_BY_ID.has(id))
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);
}

// The longer you go between correct recalls, the bigger the reward.
function retentionBonus(elapsedDays) {
  return Math.min(TRIVIA_MAX_BONUS, Math.round(6 * Math.log2(1 + Math.max(0, elapsedDays))));
}

function triviaXpScale() {
  return Math.min(1, Math.sqrt(TRIVIA_XP_FULL_BANK / Math.max(1, TRIVIA_CARDS.length)));
}

function scaleTriviaXp(xp) {
  return xp > 0 ? Math.max(1, Math.round(xp * triviaXpScale())) : 0;
}

function shuffled(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// New facts come from the tier closest to the player's current skill tier.
function pickNewCard(trivia) {
  const unseen = TRIVIA_CARDS.filter((c) => !trivia.cards[c.id]);
  if (unseen.length === 0) return null;
  const best = Math.min(...unseen.map((c) => Math.abs(c.tier - trivia.skill.tier)));
  const pool = unseen.filter((c) => Math.abs(c.tier - trivia.skill.tier) === best);
  return pool[secureRandomInt(pool.length)];
}

// Three right in a row on new facts moves you up a tier; two misses in a
// row moves you down one.
function adaptSkill(skill, correct) {
  if (correct) {
    skill.streak++;
    skill.miss = 0;
    if (skill.streak >= 3 && skill.tier < TRIVIA_TIER_NAMES.length) {
      skill.tier++;
      skill.streak = 0;
    }
  } else {
    skill.miss++;
    skill.streak = 0;
    if (skill.miss >= 2 && skill.tier > 1) {
      skill.tier--;
      skill.miss = 0;
    }
  }
}

function formatInterval(days) {
  if (days >= 365) return "a year";
  if (days >= 60) return `${Math.round(days / 30)} months`;
  if (days >= 14) return `${Math.round(days / 7)} weeks`;
  return days === 1 ? "tomorrow" : `${days} days`;
}

let triviaSession = null;
let triviaSummary = "";

function startTrivia() {
  triviaSummary = "";
  const due = triviaDueIds(loadTrivia()).slice(0, TRIVIA_MAX_REVIEWS_PER_SESSION);
  triviaSession = { queue: due, retry: [], xp: 0, correct: 0, total: 0, current: null };
  nextTriviaCard();
}

function nextTriviaCard() {
  const s = triviaSession;
  const trivia = loadTrivia();
  let card = null;
  let kind = null;
  // A fact missed earlier this session comes back after a few other questions.
  const readyIdx = s.retry.findIndex((r) => r.at <= s.total);
  if (readyIdx >= 0) {
    card = TRIVIA_BY_ID.get(s.retry.splice(readyIdx, 1)[0].id);
    kind = "retry";
  } else if (s.queue.length > 0) {
    card = TRIVIA_BY_ID.get(s.queue.shift());
    kind = "review";
  } else {
    card = pickNewCard(trivia);
    kind = "new";
  }
  if (!card && s.retry.length > 0) {
    card = TRIVIA_BY_ID.get(s.retry.shift().id);
    kind = "retry";
  }
  if (!card) {
    endTrivia();
    return;
  }
  s.current = { card, kind, choices: shuffled([card.answer, ...card.wrong]) };
  renderTriviaQuestion();
}

function renderTriviaQuestion() {
  const { card, kind, choices } = triviaSession.current;
  const kindLabel = { new: "New fact", review: "Review", retry: "Try again" }[kind];
  els.triviaMeta.textContent = `${kindLabel} · ${card.cat} · ${TRIVIA_TIER_NAMES[card.tier - 1]}`;
  els.triviaQuestion.textContent = card.q;
  els.triviaChoices.innerHTML = "";
  for (const choice of choices) {
    const btn = document.createElement("button");
    btn.className = "trivia-choice";
    btn.textContent = choice;
    btn.addEventListener("click", () => answerTrivia(choice));
    els.triviaChoices.appendChild(btn);
  }
  els.triviaFeedback.hidden = true;
  els.triviaQuiz.hidden = false;
  els.triviaStart.hidden = true;
}

function answerTrivia(choice) {
  const s = triviaSession;
  const { card, kind } = s.current;
  const correct = choice === card.answer;
  const trivia = loadTrivia();
  const now = Date.now();
  const oldLevel = levelForXp(computeLifetimeXp(loadReadLog(), loadAchievements()));
  const oldRank = getRank(oldLevel);
  let xp = 0;
  let result = "";
  let nextDays = null;

  if (kind === "new") {
    xp = correct ? scaleTriviaXp(TRIVIA_NEW_XP[card.tier - 1]) : 0;
    nextDays = TRIVIA_INTERVALS_DAYS[0];
    trivia.cards[card.id] = {
      level: correct ? 1 : 0,
      due: now + nextDays * DAY_MS,
      last: now,
      reps: 1,
      lapses: correct ? 0 : 1,
    };
    adaptSkill(trivia.skill, correct);
    result = correct ? `✅ Correct! +${xp} XP` : "❌ Not quite — now you know!";
  } else if (kind === "review") {
    const c = trivia.cards[card.id];
    const elapsedDays = (now - c.last) / DAY_MS;
    if (correct) {
      xp = scaleTriviaXp(retentionBonus(elapsedDays));
      c.level++;
      c.reps++;
      nextDays = TRIVIA_INTERVALS_DAYS[Math.min(c.level - 1, TRIVIA_INTERVALS_DAYS.length - 1)];
      const ago = elapsedDays >= 1 ? ` after ${Math.round(elapsedDays)} day${Math.round(elapsedDays) === 1 ? "" : "s"}` : "";
      result = `🧠 You remembered it${ago}! +${xp} XP retention bonus`;
    } else {
      c.lapses++;
      c.level = Math.floor(c.level / 2);
      nextDays = TRIVIA_INTERVALS_DAYS[0];
      result = "❌ Forgotten — it will come back soon so it sticks.";
    }
    c.due = now + nextDays * DAY_MS;
    c.last = now;
  } else {
    result = correct ? "✅ Got it this time." : "❌ Still tricky — it's scheduled to return soon.";
  }

  if (!correct && kind !== "retry") s.retry.push({ id: card.id, at: s.total + 1 + TRIVIA_RETRY_GAP });
  s.total++;
  if (correct) s.correct++;
  s.xp += xp;
  trivia.xp += xp;
  saveTrivia(trivia);
  scheduleBackupSync();

  for (const btn of els.triviaChoices.children) {
    btn.disabled = true;
    if (btn.textContent === card.answer) btn.classList.add("correct");
    else if (btn.textContent === choice) btn.classList.add("wrong");
  }
  els.triviaResult.textContent = result;
  els.triviaExplain.textContent = card.ref ? `${card.why} (${card.ref})` : card.why;
  if (nextDays !== null) {
    els.triviaExplain.textContent += ` — You'll see this again ${formatInterval(nextDays) === "tomorrow" ? "tomorrow" : "in " + formatInterval(nextDays)}.`;
  }
  els.triviaSrc.hidden = !card.src;
  els.triviaSrc.textContent = card.src ? `Evidence: ${card.src}` : "";
  els.triviaFeedback.hidden = false;
  els.triviaNext.focus();

  const newLevel = levelForXp(computeLifetimeXp(loadReadLog(), loadAchievements()));
  render();
  if (newLevel > oldLevel) showLevelUp(newLevel, oldRank, getRank(newLevel));
}

function endTrivia() {
  const s = triviaSession;
  triviaSession = null;
  els.triviaQuiz.hidden = true;
  triviaSummary =
    s.total > 0
      ? `Session done: ${s.correct}/${s.total} correct, +${s.xp} XP.`
      : "";
  renderTrivia();
}

function renderTrivia() {
  if (triviaSession) return; // don't disturb a question in progress
  const trivia = loadTrivia();
  const due = triviaDueIds(trivia).length;
  const unseen = TRIVIA_CARDS.filter((c) => !trivia.cards[c.id]).length;
  const seen = TRIVIA_CARDS.length - unseen;
  const tier = trivia.skill.tier;

  const lines = [];
  if (triviaSummary) lines.push(triviaSummary);
  lines.push(`${due} due for review · ${unseen} new fact${unseen === 1 ? "" : "s"} to learn`);
  lines.push(`Difficulty: ${TRIVIA_TIER_NAMES[tier - 1]} (${tier}/${TRIVIA_TIER_NAMES.length}) · ${seen}/${TRIVIA_CARDS.length} facts learned`);
  if (due === 0 && unseen === 0) {
    lines.push("You've seen every fact — reviews will return on schedule.");
  }
  els.triviaStatus.textContent = lines.join("\n");
  els.triviaStart.hidden = due === 0 && unseen === 0;
  els.triviaStart.textContent = due > 0 ? "Start trivia" : "Learn something new";
}

// --- KJV reader. The text is public domain (1769 King James Version) and
// ships as one small JSON file per book under kjv/, fetched when you need it.
// In the data, a leading "#" starts a new paragraph and [brackets] mark the
// words the translators printed in italics.

const kjvCache = new Map();

function bookSlug(book) {
  return book.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function loadKjvBook(book) {
  const slug = bookSlug(book);
  if (!kjvCache.has(slug)) {
    const promise = fetch(`kjv/${slug}.json`).then((res) => {
      if (!res.ok) throw new Error(`KJV ${slug}: ${res.status}`);
      return res.json();
    });
    promise.catch(() => kjvCache.delete(slug)); // allow a retry after a failure
    kjvCache.set(slug, promise);
  }
  return kjvCache.get(slug).then((data) => data.chapters);
}

async function kjvChapterVerses(book, chapter) {
  const chapters = await loadKjvBook(book);
  const verses = chapters[chapter - 1];
  if (!verses) throw new Error(`No KJV text for ${book} ${chapter}`);
  return verses;
}

// --- KJV27 (a light modernization of the KJV, drafted by the pipeline in par/).
// par/progress.json lists the chapters that have KJV27 text on main; every other
// chapter is simply shown in the KJV. A reader can flip a chapter back to the KJV.

const READER_VERSION_KEY = "rbc:readerVersion";
let parProgress = null; // Promise of the set of chapter keys that have KJV27 text

function loadParProgress() {
  if (!parProgress) {
    parProgress = fetch("par/progress.json", { cache: "no-cache" })
      .then((res) => (res.ok ? res.json() : { chapters: {} }))
      .then((data) => new Set(Object.keys(data.chapters || {})))
      .catch(() => new Set()); // offline or missing: KJV everywhere
  }
  return parProgress;
}

function preferredVersion() {
  try {
    return localStorage.getItem(READER_VERSION_KEY) === "kjv" ? "kjv" : "par";
  } catch {
    return "par";
  }
}

// Resolves to {version: "par"|"kjv", verses, parAvailable}. KJV27 is used only when the
// chapter has it and the reader hasn't chosen the KJV; any problem falls back to the KJV.
async function chapterText(book, chapter) {
  const key = `${bookSlug(book)}-${chapter}`;
  let hasPar = (await loadParProgress()).has(key);
  if (hasPar && preferredVersion() === "par") {
    try {
      const res = await fetch(`par/text/${key}.json`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (Array.isArray(data.verses) && data.verses.length && data.verses.every((v) => typeof v === "string")) {
        return { version: "par", verses: data.verses, parAvailable: true };
      }
    } catch {
      hasPar = false; // listed but unreadable: show the KJV and no toggle
    }
  }
  return { version: "kjv", verses: await kjvChapterVerses(book, chapter), parAvailable: hasPar };
}

// Appends text to `parent`, rendering [bracketed] words in italics.
function appendWithItalics(parent, text) {
  for (const part of text.split(/(\[[^\]]*\])/)) {
    if (!part) continue;
    if (part.startsWith("[") && part.endsWith("]")) {
      const em = document.createElement("i");
      em.textContent = part.slice(1, -1);
      parent.appendChild(em);
    } else {
      parent.appendChild(document.createTextNode(part));
    }
  }
}

function plainVerse(raw) {
  return raw.replace(/^#\s*/, "").replace(/[\[\]]/g, "");
}

let readerToken = 0;
let readerKey = undefined;

function updateReader(pending) {
  els.readerMarkRow.hidden = pending === null;
  if (pending === readerKey) return; // already showing this chapter
  readerKey = pending;
  renderReader(pending);
}

async function renderReader(pending) {
  const token = ++readerToken;
  els.readerText.textContent = "";
  if (!pending) {
    els.readerSummary.textContent = "Read it here · KJV";
    const p = document.createElement("p");
    p.className = "reader-status";
    p.textContent = "Get a random chapter and its King James text will appear here.";
    els.readerText.appendChild(p);
    return;
  }
  els.readerSummary.textContent = `${pending} · KJV`;
  els.readerVersionRow.hidden = true;
  const status = document.createElement("p");
  status.className = "reader-status";
  status.textContent = "Loading…";
  els.readerText.appendChild(status);

  const [book, chapter] = splitKey(pending);
  let verses, text;
  try {
    text = await chapterText(book, chapter);
    verses = text.verses;
  } catch {
    if (token !== readerToken) return;
    readerKey = undefined; // let the next render try again
    status.textContent = "Couldn't load the text — check your connection and tap here to retry.";
    status.style.cursor = "pointer";
    status.addEventListener("click", () => updateReader(loadPending()));
    return;
  }
  if (token !== readerToken) return; // a different chapter was requested meanwhile

  els.readerSummary.textContent = `${pending} · ${text.version === "par" ? "KJV27" : "KJV"}`;
  els.readerVersionRow.hidden = !text.parAvailable;
  els.readerVersionBtn.textContent = text.version === "par" ? "Show the KJV" : "Show KJV27";
  els.readerVersionBtn.onclick = () => {
    try {
      localStorage.setItem(READER_VERSION_KEY, text.version === "par" ? "kjv" : "par");
    } catch {
      // the choice just won't be remembered
    }
    readerKey = undefined;
    updateReader(loadPending());
  };

  els.readerText.textContent = "";
  let para = null;
  verses.forEach((raw, i) => {
    let text = raw;
    if (text.startsWith("#")) {
      text = text.replace(/^#\s*/, "");
      para = null;
    }
    if (!para) {
      para = document.createElement("p");
      para.className = "verse-para";
      els.readerText.appendChild(para);
    }
    const num = document.createElement("sup");
    num.className = "verse-num";
    num.textContent = String(i + 1);
    num.tabIndex = 0;
    num.setAttribute("role", "button");
    num.title = "Ask a question about this verse";
    const ask = () => askAboutVerse(book, chapter, i + 1);
    num.addEventListener("click", ask);
    num.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        ask();
      }
    });
    para.appendChild(num);
    appendWithItalics(para, text + " ");
  });
}

// --- Questions notebook: jot questions per passage and Bible version, then
// copy them all as one prompt for an LLM.

const BIBLE_VERSIONS = ["KJV", "NKJV", "ESV", "NIV", "NLT", "NASB", "CSB", "NRSV", "AMP", "MSG"];
const OTHER_VERSION = "Other…";
const BOOK_ALIASES = {
  psalm: "Psalms",
  "song of songs": "Song of Solomon",
  "songs of solomon": "Song of Solomon",
  "song of solomon": "Song of Solomon",
};

function emptyQuestions() {
  return { items: [], lastVersion: "KJV" };
}

function sanitizeQuestions(raw) {
  const q = emptyQuestions();
  if (!raw || typeof raw !== "object") return q;
  if (typeof raw.lastVersion === "string" && raw.lastVersion) q.lastVersion = raw.lastVersion;
  if (Array.isArray(raw.items)) {
    for (const it of raw.items) {
      if (it && typeof it.text === "string" && it.text.trim()) {
        q.items.push({
          id: typeof it.id === "string" ? it.id : String(Math.random()).slice(2),
          passage: typeof it.passage === "string" ? it.passage : "",
          version: typeof it.version === "string" && it.version ? it.version : "KJV",
          text: it.text,
          t: typeof it.t === "number" ? it.t : 0,
        });
      }
    }
  }
  return q;
}

function loadQuestions() {
  try {
    return sanitizeQuestions(JSON.parse(localStorage.getItem(QUESTIONS_KEY) || "null"));
  } catch {
    return emptyQuestions();
  }
}

function saveQuestions(questions) {
  localStorage.setItem(QUESTIONS_KEY, JSON.stringify(questions));
}

function currentVersionChoice() {
  return els.qVersion.value === OTHER_VERSION ? els.qVersionOther.value.trim() || "Unspecified version" : els.qVersion.value;
}

function setVersionChoice(version) {
  if (BIBLE_VERSIONS.includes(version)) {
    els.qVersion.value = version;
    els.qVersionOther.hidden = true;
  } else {
    els.qVersion.value = OTHER_VERSION;
    els.qVersionOther.hidden = false;
    els.qVersionOther.value = version;
  }
}

let passageEdited = false;
let lastPassageDefault = "";

function renderQuestions(pending) {
  const questions = loadQuestions();
  els.questionsCount.textContent = questions.items.length > 0 ? `(${questions.items.length})` : "";

  // Default the passage to the chapter being read, unless the user typed one.
  const wanted = pending || "";
  if (!passageEdited || els.qPassage.value === lastPassageDefault) {
    els.qPassage.value = wanted;
    passageEdited = false;
  }
  lastPassageDefault = wanted;

  els.qList.innerHTML = "";
  const groups = new Map();
  for (const item of questions.items) {
    const key = item.passage || "General";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  for (const [passage, items] of groups) {
    const heading = document.createElement("li");
    heading.className = "q-group";
    heading.textContent = passage;
    els.qList.appendChild(heading);
    for (const item of items) {
      const li = document.createElement("li");
      const head = document.createElement("div");
      head.className = "q-item-head";
      const badge = document.createElement("span");
      badge.className = "q-badge";
      badge.textContent = item.version;
      const actions = document.createElement("span");
      actions.className = "q-item-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => editQuestion(item.id));
      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "Delete";
      del.addEventListener("click", () => deleteQuestion(item.id));
      actions.append(edit, del);
      head.append(badge, actions);
      const text = document.createElement("p");
      text.className = "q-text";
      text.textContent = item.text;
      li.append(head, text);
      els.qList.appendChild(li);
    }
  }
}

function askAboutVerse(book, chapter, verse) {
  els.questionsDetails.open = true;
  els.qPassage.value = `${book} ${chapter}:${verse}`;
  passageEdited = true;
  setVersionChoice("KJV"); // you're reading the KJV text here
  els.qText.focus();
  els.questionsDetails.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function handleAddQuestion(e) {
  e.preventDefault();
  const text = els.qText.value.trim();
  if (!text) {
    els.qStatus.textContent = "Write your question first.";
    els.qText.focus();
    return;
  }
  const questions = loadQuestions();
  const version = currentVersionChoice();
  questions.items.push({
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    passage: els.qPassage.value.trim() || loadPending() || "General",
    version,
    text,
    t: Date.now(),
  });
  questions.lastVersion = version;
  saveQuestions(questions);
  els.qText.value = "";
  els.qStatus.textContent = "Question saved.";
  scheduleBackupSync();
  renderQuestions(loadPending());
}

function editQuestion(id) {
  const questions = loadQuestions();
  const item = questions.items.find((q) => q.id === id);
  if (!item) return;
  const edited = prompt("Edit your question:", item.text);
  if (edited === null) return;
  if (!edited.trim()) return deleteQuestion(id);
  item.text = edited.trim();
  saveQuestions(questions);
  scheduleBackupSync();
  renderQuestions(loadPending());
}

function deleteQuestion(id) {
  const questions = loadQuestions();
  questions.items = questions.items.filter((q) => q.id !== id);
  saveQuestions(questions);
  scheduleBackupSync();
  renderQuestions(loadPending());
}

function handleClearQuestions() {
  const questions = loadQuestions();
  if (questions.items.length === 0) return;
  if (!confirm(`Delete all ${questions.items.length} saved questions? Copy them first if you still need them.`)) return;
  questions.items = [];
  saveQuestions(questions);
  els.qPreview.hidden = true;
  els.qStatus.textContent = "All questions cleared.";
  scheduleBackupSync();
  renderQuestions(loadPending());
}

// Turns "John 3:16-18", "Psalm 23", "1 John 4:8" into { book, chapter, from, to }.
function parsePassage(text) {
  const m = text.trim().match(/^((?:[123]\s*)?[A-Za-z][A-Za-z.\s]*?)\s*(\d+)(?::\s*(\d+)(?:\s*[-–—]\s*(\d+))?)?$/);
  if (!m) return null;
  const name = m[1].replace(/\./g, "").replace(/\s+/g, " ").trim().replace(/^([123])\s*/, "$1 ").toLowerCase();
  const book = BOOK_ALIASES[name] || (BIBLE_BOOKS.find(([b]) => b.toLowerCase() === name) || [])[0];
  if (!book) return null;
  const chapter = Number(m[2]);
  const total = BIBLE_BOOKS.find(([b]) => b === book)[1];
  if (chapter < 1 || chapter > total) return null;
  const from = m[3] ? Number(m[3]) : null;
  const to = m[4] ? Number(m[4]) : from;
  if (from !== null && to < from) return null;
  return { book, chapter, from, to };
}

function passageLabel(p) {
  if (p.from === null) return `${p.book} ${p.chapter}`;
  return p.to === p.from ? `${p.book} ${p.chapter}:${p.from}` : `${p.book} ${p.chapter}:${p.from}–${p.to}`;
}

const PROMPT_INTRO = `I'm reading through the Bible and wrote down questions as I went. Please answer each one.

How to answer:
- Start with what the passage itself says in context, then add historical, cultural, or linguistic background where it helps.
- Where a translation's wording matters, explain what the Hebrew or Greek behind it says and how other major translations render it.
- Say plainly where scholars disagree or the text is unclear. Don't invent details, quotes, or sources.
- Answer in order, label each answer with its question number, and keep each one focused.`;

async function buildQuestionsPrompt(items, includeKjvText) {
  const lines = [PROMPT_INTRO, "", "My questions (the Bible version I was reading is in brackets):", ""];
  items.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.passage || "General"} [${item.version}]`);
    for (const line of item.text.split("\n")) lines.push(`   ${line}`);
    lines.push("");
  });

  if (includeKjvText) {
    const seen = new Set();
    const sections = [];
    const skipped = [];
    for (const item of items) {
      const parsed = item.passage ? parsePassage(item.passage) : null;
      if (!parsed) {
        if (item.passage && item.passage !== "General") skipped.push(item.passage);
        continue;
      }
      const label = passageLabel(parsed);
      if (seen.has(label)) continue;
      seen.add(label);
      try {
        const verses = await kjvChapterVerses(parsed.book, parsed.chapter);
        const from = parsed.from ?? 1;
        const to = parsed.to ?? verses.length;
        const body = [];
        for (let v = from; v <= Math.min(to, verses.length); v++) body.push(`${v} ${plainVerse(verses[v - 1])}`);
        sections.push(`=== ${label} (KJV) ===\n${body.join("\n")}`);
      } catch {
        skipped.push(item.passage);
      }
    }
    if (sections.length > 0) {
      lines.push("For reference, here is the King James text of the passages above:", "", sections.join("\n\n"), "");
    }
    if (skipped.length > 0) {
      lines.push(`(I couldn't include the text for: ${[...new Set(skipped)].join("; ")}.)`, "");
    }
  }
  return lines.join("\n").trimEnd() + "\n";
}

async function handleCopyPrompt() {
  const { items } = loadQuestions();
  if (items.length === 0) {
    els.qStatus.textContent = "Add at least one question first.";
    return;
  }
  els.qCopy.disabled = true;
  els.qStatus.textContent = "Building your prompt…";
  try {
    const text = await buildQuestionsPrompt(items, els.qIncludeText.checked);
    els.qPreview.value = text;
    els.qPreview.hidden = false;
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      els.qPreview.focus();
      els.qPreview.select();
      try {
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      }
    }
    els.qStatus.textContent = copied
      ? `Copied ${items.length} question${items.length === 1 ? "" : "s"} — paste it into your LLM.`
      : "Couldn't copy automatically. The prompt is selected below: tap and hold to copy it.";
  } finally {
    els.qCopy.disabled = false;
  }
}

function initQuestionsUi() {
  for (const v of [...BIBLE_VERSIONS, OTHER_VERSION]) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    els.qVersion.appendChild(opt);
  }
  setVersionChoice(loadQuestions().lastVersion);
  els.qVersion.addEventListener("change", () => {
    els.qVersionOther.hidden = els.qVersion.value !== OTHER_VERSION;
    if (!els.qVersionOther.hidden) els.qVersionOther.focus();
  });
  els.qPassage.addEventListener("input", () => {
    passageEdited = true;
  });
  els.qForm.addEventListener("submit", handleAddQuestion);
  els.qCopy.addEventListener("click", handleCopyPrompt);
  els.qClear.addEventListener("click", handleClearQuestions);
}

// --- Rendering

function render() {
  const frozenDays = applyFreezes(loadReadLog());
  if (frozenDays.length > 0) {
    showToasts([{ label: `🧊 Streak freeze saved your streak (${frozenDays.length} day${frozenDays.length === 1 ? "" : "s"} covered)` }]);
    scheduleBackupSync();
  }

  let log = loadReadLog();
  let readSet = readKeysSet(log);

  // A completed cycle is always banked immediately (see bankCycleCompletion),
  // but self-heal here too in case state was left complete by an older
  // version of the app or a restored backup.
  if (readSet.size === TOTAL_CHAPTERS) {
    bankCycleCompletion(log, loadAchievements());
    log = loadReadLog();
    readSet = readKeysSet(log);
  }

  let pending = loadPending();

  // Self-heal state left over from an older version of the app (or a
  // corrupted/edited storage) where reading history exists but there's no
  // chapter queued up — without this, the Get button would stay hidden
  // (since `started` is true) with no way left to fetch a new chapter.
  if (pending === null && readSet.size > 0) {
    pending = pickNextChapter(readSet);
    savePending(pending);
  }

  const started = pending !== null || readSet.size > 0;

  els.progressText.textContent = `${readSet.size} / ${TOTAL_CHAPTERS} chapters read`;
  els.progressBar.style.width = `${(readSet.size / TOTAL_CHAPTERS) * 100}%`;

  els.chapter.textContent = pending || "Press the button to get a chapter";
  els.getBtn.hidden = started;
  els.actionRow.hidden = pending === null;

  updateReader(pending);
  renderKjv27Progress();
  renderQuestions(pending);
  renderLevel(log);
  renderHabit(log, readSet);
  renderTrivia();
  renderToday(log);
  renderTrend(log, readSet);
  renderHistory(readSet);
  renderAchievements();
  renderBookMap(readSet);
  updateReadTimer();
  els.syncStatus.textContent = loadSyncSecret() ? "Sync key saved on this device." : "";
  if (!els.cloudStatus.textContent) renderCloudStatus();
}

function renderLevel(log) {
  const achievements = loadAchievements();
  const lifetime = loadLifetime();
  const xp = lifetime.bankedXp + computeCycleXp(log, achievements) + loadTrivia().xp;
  const level = levelForXp(xp);
  const rank = getRank(level);
  const xpInLevel = xpIntoLevel(xp);
  const pct = (xpInLevel / XP_PER_LEVEL) * 100;

  els.rankName.textContent = rank.name;
  els.levelBadge.textContent = String(level);
  els.levelRing.style.setProperty("--pct", `${pct}%`);
  els.xpBar.style.width = `${pct}%`;
  els.xpText.textContent = `${xpInLevel} / ${XP_PER_LEVEL} XP to next level`;

  const todayCount = computeTodayEntries(log).length;
  if (todayCount >= DAILY_FULL_XP_CAP) {
    els.xpCapNote.hidden = false;
    els.xpCapNote.textContent = `🔥 Full-XP chapters used for today (${DAILY_FULL_XP_CAP}) — keep reading, they still count, and XP resumes at full strength tomorrow.`;
  } else {
    els.xpCapNote.hidden = true;
  }

  const completions = lifetime.completions.length;
  if (completions > 0) {
    els.completionsLine.hidden = false;
    els.completionsLine.textContent = `🏆 ${completions} full ${completions === 1 ? "journey" : "journeys"} through the entire Bible`;
  } else {
    els.completionsLine.hidden = true;
  }
}

function renderHabit(log, readSet) {
  const todayCount = computeTodayEntries(log).length;
  const streak = computeStreak(computeDayCounts(log), frozenSet());

  if (streak.current > 0) {
    els.streakChip.textContent = `🔥 ${streak.current}-day streak`;
    els.streakChip.classList.toggle("at-risk", !streak.readToday);
    els.streakChip.title = streak.readToday
      ? `Best: ${streak.best} days`
      : `Read a chapter today to keep your ${streak.current}-day streak alive! Best: ${streak.best} days`;
  } else {
    els.streakChip.textContent = "🔥 Start a streak today";
    els.streakChip.classList.remove("at-risk");
    els.streakChip.title = "";
  }

  const freezesLeft = loadFreezes().available;
  els.freezeChip.textContent = `🧊 ${freezesLeft}/${MAX_FREEZES} freezes`;
  els.freezeChip.title = `Read ${FREEZE_EARN_EVERY_DAYS} days in a row to earn a freeze. It's spent automatically on a missed day.`;
  els.freezeChip.classList.toggle("empty", freezesLeft === 0);

  const goalMet = todayCount >= DAILY_GOAL;
  els.goalChip.classList.toggle("met", goalMet);
  els.goalChip.textContent = goalMet
    ? `✅ Daily goal done · ${todayCount} today`
    : `${"●".repeat(todayCount)}${"○".repeat(DAILY_GOAL - todayCount)} ${todayCount}/${DAILY_GOAL} today`;

  const nudge = streak.current > 0 && !streak.readToday
    ? `⏳ Read today to keep your ${streak.current}-day streak!`
    : computeNudge(readSet, todayCount);
  els.nudge.hidden = !nudge;
  els.nudge.textContent = nudge;
}

function showXpPop(xp) {
  const pop = document.createElement("div");
  pop.className = "xp-pop";
  pop.textContent = `+${xp} XP`;
  els.chapter.parentElement.appendChild(pop);
  setTimeout(() => pop.remove(), 1200);
}

function buzz(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Haptics are a nicety; ignore where unsupported.
  }
}

// The Mark-as-Read button appears twice (under the chapter title and below
// the text), and both share one waiting state.
function setMarkButtons(waiting) {
  for (const btn of [els.markBtn, els.markBtn2]) {
    btn.disabled = waiting;
    btn.classList.toggle("waiting", waiting);
  }
}

function updateReadTimer() {
  const pending = loadPending();
  if (!pending) {
    els.readTimer.hidden = true;
    setMarkButtons(false);
    return;
  }

  const since = loadPendingSince();
  const elapsed = since ? (Date.now() - since) / 1000 : MIN_READ_SECONDS;
  const remaining = Math.max(0, MIN_READ_SECONDS - elapsed);

  if (remaining <= 0) {
    els.readTimer.hidden = true;
    setMarkButtons(false);
    return;
  }

  els.readTimer.hidden = false;
  setMarkButtons(true);
  const pct = ((MIN_READ_SECONDS - remaining) / MIN_READ_SECONDS) * 100;
  els.readTimerFill.style.width = `${pct}%`;
  els.readTimerLabel.textContent = `Take a moment to read — ${Math.ceil(remaining)}s`;
}

function isMarkReady() {
  const since = loadPendingSince();
  if (since == null) return true;
  return (Date.now() - since) / 1000 >= MIN_READ_SECONDS;
}

function renderToday(log) {
  const todayEntries = computeTodayEntries(log);
  els.todayCount.textContent = `${todayEntries.length} chapter${todayEntries.length === 1 ? "" : "s"} read today`;

  els.todayList.innerHTML = "";
  if (todayEntries.length === 0) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = "No chapters read yet today — get started!";
    els.todayList.appendChild(li);
    return;
  }
  todayEntries.forEach((entry, i) => {
    const li = document.createElement("li");
    li.textContent = `${i + 1}. ${entry.k}`;
    els.todayList.appendChild(li);
  });
}

function renderTrend(log, readSet) {
  const remaining = TOTAL_CHAPTERS - readSet.size;
  const dayCounts = computeDayCounts(log);
  const trend = computeTrend(dayCounts, remaining);

  if (trend.done) {
    els.trendText.textContent = "🎉 You've read the whole Bible!";
    return;
  }
  if (trend.avgPerDay <= 0) {
    els.trendText.textContent = "Read a few chapters over the next few days to see your pace and a projected finish date.";
    return;
  }
  const dateLabel = trend.finishDate.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const rate = trend.avgPerDay.toFixed(1);
  const days = trend.daysLeft;
  els.trendText.textContent = `At your recent pace (~${rate} chapters/day over the last ${TREND_WINDOW_DAYS} days), you'll finish the whole Bible in about ${days} day${days === 1 ? "" : "s"} — around ${dateLabel}.`;
}

function renderHistory(readSet) {
  els.historyList.innerHTML = "";
  const items = [...readSet].sort((a, b) => {
    const [bookA, chA] = splitKey(a);
    const [bookB, chB] = splitKey(b);
    return BOOK_INDEX.get(bookA) - BOOK_INDEX.get(bookB) || chA - chB;
  });
  for (const key of items) {
    const li = document.createElement("li");
    li.textContent = key;
    els.historyList.appendChild(li);
  }
}

function renderAchievements() {
  const list = [...loadAchievements()].reverse();
  els.achievementsCount.textContent = list.length > 0 ? `(${list.length})` : "";
  els.achievementsList.innerHTML = "";
  if (list.length === 0) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = "No achievements yet — start reading to unlock some!";
    els.achievementsList.appendChild(li);
    return;
  }
  for (const badge of list) {
    const li = document.createElement("li");
    const dateLabel = new Date(badge.at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    li.textContent = `${badge.label} — ${dateLabel}`;
    els.achievementsList.appendChild(li);
  }
}

function abbreviateBook(name) {
  if (/^[123] /.test(name)) return name[0] + name.slice(2, 4);
  return name.slice(0, 3);
}

function renderBookGroup(container, books, bookCounts) {
  for (const [book, total] of books) {
    const read = bookCounts.get(book) || 0;
    const pct = Math.round((read / total) * 100);
    const cell = document.createElement("div");
    cell.className = "book-cell";
    cell.style.setProperty("--pct", `${pct}%`);
    cell.title = `${book}: ${read} / ${total} chapters read`;
    const label = document.createElement("span");
    label.textContent = abbreviateBook(book);
    cell.appendChild(label);
    container.appendChild(cell);
  }
}

function renderBookMap(readSet) {
  const bookCounts = computeBookCounts(readSet);
  els.bookMap.innerHTML = "";

  const otHeading = document.createElement("h3");
  otHeading.textContent = "Old Testament";
  els.bookMap.appendChild(otHeading);
  const otGrid = document.createElement("div");
  otGrid.className = "book-grid";
  renderBookGroup(otGrid, OT_BOOKS, bookCounts);
  els.bookMap.appendChild(otGrid);

  const ntHeading = document.createElement("h3");
  ntHeading.textContent = "New Testament";
  els.bookMap.appendChild(ntHeading);
  const ntGrid = document.createElement("div");
  ntGrid.className = "book-grid";
  renderBookGroup(ntGrid, NT_BOOKS, bookCounts);
  els.bookMap.appendChild(ntGrid);
}

// --- Event handlers

function handleGet() {
  const readSet = readKeysSet(loadReadLog());
  savePending(pickNextChapter(readSet));
  render();
}

function handleMark() {
  const pending = loadPending();
  if (!pending) return;
  if (!isMarkReady()) return; // anti-farming: mirrors the disabled button state

  const oldLog = loadReadLog();
  const oldAchievements = loadAchievements();
  const oldLevel = levelForXp(computeLifetimeXp(oldLog, oldAchievements));
  const oldRank = getRank(oldLevel);

  const markedAt = Date.now();
  const xpEarned = xpForNextChapter(oldLog);
  const log = [...oldLog, { k: pending, t: markedAt, xp: xpEarned }];
  saveReadLog(log);
  syncReadChapter(pending, markedAt);

  const newReadSet = readKeysSet(log);
  const oldTodayCount = computeTodayEntries(oldLog).length;
  const streakDays = computeStreak(computeDayCounts(log), frozenSet()).current;
  const newBadges = computeNewBadges(newReadSet, pending, streakDays);
  if (maybeGrantFreeze(streakDays)) {
    newBadges.unshift({ id: `freeze-${localDateKey(new Date())}`, label: "🧊 Streak freeze earned — it protects you if you miss a day!", xp: 0, transient: true });
  }
  if (oldTodayCount + 1 === DAILY_GOAL) {
    newBadges.unshift({ id: `goal-${localDateKey(new Date())}`, label: `🎯 Daily goal reached — ${DAILY_GOAL} chapters today!`, xp: 0, transient: true });
  }
  persistAchievements(newBadges.filter((b) => !b.transient));
  scheduleBackupSync();
  showXpPop(xpEarned);
  buzz(newBadges.length > 0 ? [30, 40, 60] : 20);
  const achievements = loadAchievements();

  if (newReadSet.size === TOTAL_CHAPTERS) {
    const lifetime = bankCycleCompletion(log, achievements);
    scheduleBackupSync();
    const newLevel = levelForXp(lifetime.bankedXp + loadTrivia().xp);
    savePending(pickRandomUnread(new Set()));
    render();
    showToasts(newBadges);
    showBibleCompleted(lifetime.completions.length, newLevel, getRank(newLevel));
    return;
  }

  savePending(pickNextChapter(newReadSet));
  const newLevel = levelForXp(computeLifetimeXp(log, achievements));
  render();
  showToasts(newBadges);
  if (newLevel > oldLevel) {
    showLevelUp(newLevel, oldRank, getRank(newLevel));
  }
}

function handleSkip() {
  const pending = loadPending();
  const readSet = readKeysSet(loadReadLog());
  if (pending) {
    const skipped = loadSkipped();
    skipped.add(pending);
    saveSkipped(skipped);
  }
  savePending(pickNextChapter(readSet, pending));
  render();
}

function handleReset() {
  const confirmed = confirm(
    "This erases your entire reading history, achievements, saved questions, and your lifetime level — including all Bible completions — and starts over from Level 1. If cloud backup is on, your cloud backup is erased too. This cannot be undone. Continue?"
  );
  if (!confirmed) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PENDING_KEY);
  localStorage.removeItem(PENDING_SINCE_KEY);
  localStorage.removeItem(ACHIEVEMENTS_KEY);
  localStorage.removeItem(LIFETIME_KEY);
  localStorage.removeItem(FREEZES_KEY);
  localStorage.removeItem(SKIPPED_KEY);
  localStorage.removeItem(TRIVIA_KEY);
  localStorage.removeItem(QUESTIONS_KEY);
  triviaSession = null;
  els.triviaQuiz.hidden = true;
  triviaSummary = "";
  render();
  // Overwrite the cloud copy too, otherwise it would resurrect on restore.
  backupChain = backupChain.then(() => pushBackup({ force: true })).catch(() => {});
}

function handleBackup() {
  const code = toBase64(JSON.stringify(buildBackupPayload()));
  els.backupOutput.value = code;
  els.backupOutput.select();
  if (navigator.clipboard) {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        els.backupStatus.textContent = "Copied to clipboard — paste it somewhere safe, like Notes.";
      })
      .catch(() => {
        els.backupStatus.textContent = "Backup code ready below — copy it manually.";
      });
  } else {
    els.backupStatus.textContent = "Backup code ready below — copy it manually.";
  }
}

function handleRestore() {
  const raw = els.restoreInput.value.trim();
  if (!raw) return;
  let payload;
  try {
    payload = JSON.parse(fromBase64(raw));
  } catch {
    els.backupStatus.textContent = "That doesn't look like a valid backup code.";
    return;
  }
  if (!payload || !Array.isArray(payload.log)) {
    els.backupStatus.textContent = "That doesn't look like a valid backup code.";
    return;
  }
  if (!confirm("This replaces your current reading history, achievements, and level with the backup. Continue?")) return;

  applyBackupPayload(payload);
  scheduleBackupSync();
  els.restoreInput.value = "";
  els.backupStatus.textContent = "Restored from backup!";
  render();
}

els.getBtn.addEventListener("click", handleGet);
els.markBtn.addEventListener("click", handleMark);
els.skipBtn.addEventListener("click", handleSkip);
els.resetBtn.addEventListener("click", handleReset);
els.backupBtn.addEventListener("click", handleBackup);
els.restoreBtn.addEventListener("click", handleRestore);
els.syncSaveBtn.addEventListener("click", handleSyncSave);
els.cloudRestoreBtn.addEventListener("click", handleCloudRestore);
els.triviaStart.addEventListener("click", startTrivia);
els.triviaNext.addEventListener("click", nextTriviaCard);
els.triviaEnd.addEventListener("click", endTrivia);
els.markBtn2.addEventListener("click", handleMark);
initQuestionsUi();
els.levelupDismiss.addEventListener("click", hideLevelUp);
els.levelupModal.addEventListener("click", (e) => {
  if (e.target === els.levelupModal) hideLevelUp();
});

// Ticks the read-timer countdown while a chapter is pending. render() also
// calls updateReadTimer() directly so state-changing actions reflect
// immediately without waiting for the next tick.
setInterval(updateReadTimer, 500);

// Ask the browser not to evict this site's storage under normal storage
// pressure (supported on Chrome/Firefox/Edge; Safari ignores the call but
// it's harmless there). This has no effect on iOS's separate, stricter
// privacy-driven eviction of Home Screen web app storage.
if (navigator.storage?.persist) {
  navigator.storage.persist();
}

// Settings > LLM Usage: a meter over the token ledger the KJV27 pipeline
// writes to par/usage.json (the app itself makes no LLM calls).
const USAGE_BUDGET_KEY = "rbc:usageBudget";
const DEFAULT_USAGE_BUDGET = 5000000; // a full translation pass is ~3-5M tokens

function usageBudget() {
  try {
    const n = Number(localStorage.getItem(USAGE_BUDGET_KEY));
    return n > 0 ? n : DEFAULT_USAGE_BUDGET;
  } catch (e) {
    return DEFAULT_USAGE_BUDGET;
  }
}

function showSettings(open) {
  document.body.classList.toggle("settings-open", open);
  document.getElementById("settings-view").hidden = !open;
  document.getElementById("llm-usage").hidden = true;
  document.getElementById("settings-menu").hidden = false;
  if (open) window.scrollTo(0, 0);
}

function renderUsage(ledger) {
  const budget = usageBudget();
  const total = Number(ledger?.total_tokens) || 0;
  const meter = document.getElementById("usage-meter");
  meter.setAttribute("aria-valuenow", String(total));
  meter.setAttribute("aria-valuemax", String(budget));
  const pct = Math.min(100, (total / budget) * 100);
  const fill = document.getElementById("usage-fill");
  fill.style.width = pct + "%";
  fill.classList.toggle("over", total > budget);
  document.getElementById("usage-total").textContent =
    `${total.toLocaleString()} of ${budget.toLocaleString()} tokens (${pct.toFixed(1)}%)`;
  document.getElementById("usage-budget").value = budget;

  const list = document.getElementById("usage-providers");
  list.textContent = "";
  Object.entries(ledger?.providers || {})
    .sort((a, b) => b[1].total_tokens - a[1].total_tokens)
    .forEach(([name, t]) => {
      const li = document.createElement("li");
      const share = total ? (t.total_tokens / total) * 100 : 0;
      const label = document.createElement("span");
      label.textContent = `${name}: ${t.total_tokens.toLocaleString()} tokens, ${t.calls} call${t.calls === 1 ? "" : "s"}`;
      const track = document.createElement("div");
      track.className = "usage-meter small";
      const bar = document.createElement("div");
      bar.className = "usage-fill";
      bar.style.width = share + "%";
      track.appendChild(bar);
      li.append(label, track);
      list.appendChild(li);
    });
  document.getElementById("usage-status").textContent = ledger?.updated
    ? `Last updated ${new Date(ledger.updated).toLocaleString()}.`
    : "No usage recorded yet.";
}

async function openLlmUsage() {
  document.getElementById("settings-menu").hidden = true;
  document.getElementById("llm-usage").hidden = false;
  renderUsage(null);
  try {
    const res = await fetch("par/usage.json", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    renderUsage(await res.json());
  } catch (e) {
    document.getElementById("usage-status").textContent = "Couldn't load par/usage.json.";
  }
}

document.getElementById("settings-btn").addEventListener("click", () => showSettings(true));
document.getElementById("settings-back").addEventListener("click", () => {
  const sub = !document.getElementById("llm-usage").hidden;
  showSettings(sub);
});
document.getElementById("llm-usage-link").addEventListener("click", openLlmUsage);

// Homepage KJV27 queue: how many of the next queued chapters already have KJV27 text.
const KJV27_LOOKAHEAD = 20;

async function renderKjv27Progress() {
  const status = document.getElementById("kjv27-status");
  status.textContent = "Loading…";
  if (!queueOrder) await loadQueue();
  const done = await loadParProgress();
  if (!queueOrder) {
    status.textContent = "Couldn't load par/queue.json.";
    return;
  }
  const readSet = readKeysSet(loadReadLog());
  const skipped = loadSkipped();
  const unread = queueOrder.filter((k) => !readSet.has(k));
  // The same order the app hands chapters out: skipped ones go to the back of the line.
  const next = [...unread.filter((k) => !skipped.has(k)), ...unread.filter((k) => skipped.has(k))].slice(0, KJV27_LOOKAHEAD);
  const hasPar = (k) => {
    const [book, ch] = splitKey(k);
    return done.has(`${bookSlug(book)}-${ch}`);
  };
  const ready = next.filter(hasPar).length;
  document.getElementById("kjv27-count").textContent = `· ${ready} of next ${next.length} ready`;
  document.getElementById("kjv27-next-fill").style.width = (next.length ? (ready / next.length) * 100 : 0) + "%";
  const list = document.getElementById("kjv27-list");
  list.textContent = "";
  next.forEach((k, i) => {
    const li = document.createElement("li");
    li.textContent = `${hasPar(k) ? "✓" : "–"} ${i + 1}. ${k}`;
    list.appendChild(li);
  });
  document.getElementById("kjv27-all").textContent = `${done.size.toLocaleString()} of ${queueOrder.length.toLocaleString()} chapters have KJV27 in all.`;
  status.textContent = "";
}

document.getElementById("usage-budget").addEventListener("change", (e) => {
  const n = Number(e.target.value);
  try {
    if (n > 0) localStorage.setItem(USAGE_BUDGET_KEY, String(Math.round(n)));
  } catch (err) {}
  openLlmUsage();
});

// --- New-version prompt. The deploy workflow stamps the commit into the page (<meta name="build">,
// and ?v= on the scripts) and writes the same value to version.json. If version.json ever differs
// from the build this page was loaded with, offer a reload. Unstamped copies (local files) skip it.
const RUNNING_BUILD = document.querySelector('meta[name="build"]')?.content || "";
let dismissedBuild = null;

async function checkForUpdate() {
  if (!RUNNING_BUILD || RUNNING_BUILD.startsWith("__")) return;
  try {
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;
    const { build } = await res.json();
    if (build && build !== RUNNING_BUILD && build !== dismissedBuild) {
      document.getElementById("update-banner").dataset.build = build;
      document.getElementById("update-banner").hidden = false;
    }
  } catch {
    // offline: try again next time
  }
}

document.getElementById("update-reload").addEventListener("click", async () => {
  try {
    await fetch(location.pathname, { cache: "reload" }); // refresh the cached page so the reload gets the new scripts
  } catch {
    // reload anyway
  }
  location.reload();
});
document.getElementById("update-later").addEventListener("click", () => {
  const banner = document.getElementById("update-banner");
  dismissedBuild = banner.dataset.build || null;
  banner.hidden = true;
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkForUpdate();
});
setInterval(checkForUpdate, 10 * 60 * 1000);
setTimeout(checkForUpdate, 3000);

loadQueue();
render();
checkCloudOnLoad();
