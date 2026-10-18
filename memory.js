// Scripture memory: save a verse, a passage or any highlighted words, then drill them in the app.
// Loaded before app.js; everything here that touches app.js (els, parsePassage, kjvChapterVerses, ...)
// runs only after app.js has finished loading.

const MEMORY_KEY = "rbc:memory";
const MEMORY_DAYS = [0, 1, 3, 7, 14, 30, 60]; // days until the next review, by box (0 = missed or new)
const MEMORY_MAX_BOX = MEMORY_DAYS.length - 1;
const MEMORY_PASS = 0.9; // share of the words you must type right
// XP for passing a review, by the box the item reaches (a longer gap is a bigger feat), scaled up
// for longer passages. Only reviews that are due pay out, a retry after a miss pays nothing, and
// total memory XP is capped per day, so repeating a drill can't farm levels.
const MEMORY_XP = [0, 2, 3, 4, 6, 8, 10];
const MEMORY_XP_DAILY_CAP = 20;
const MEM_DAY_MS = 86400000;

function sanitizeMemory(raw) {
  const m = { items: [], xp: 0, day: "", earned: 0 };
  if (!raw || typeof raw !== "object") return m;
  if (typeof raw.xp === "number" && raw.xp > 0) m.xp = raw.xp;
  if (typeof raw.day === "string") m.day = raw.day;
  if (typeof raw.earned === "number" && raw.earned > 0) m.earned = raw.earned;
  if (!Array.isArray(raw.items)) return m;
  for (const it of raw.items) {
    if (!it || typeof it.text !== "string" || !it.text.trim()) continue;
    m.items.push({
      id: typeof it.id === "string" ? it.id : String(Math.random()).slice(2),
      ref: typeof it.ref === "string" ? it.ref : "",
      version: typeof it.version === "string" && it.version ? it.version : "KJV",
      text: it.text.trim(),
      box: Number.isInteger(it.box) ? Math.max(0, Math.min(MEMORY_MAX_BOX, it.box)) : 0,
      due: typeof it.due === "number" ? it.due : 0,
      t: typeof it.t === "number" ? it.t : 0,
    });
  }
  return m;
}

function loadMemory() {
  try {
    return sanitizeMemory(JSON.parse(localStorage.getItem(MEMORY_KEY) || "null"));
  } catch {
    return sanitizeMemory(null);
  }
}

function saveMemory(memory) {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // storage full or blocked: the change just won't stick
  }
}

function addMemoryItem({ ref, version, text }) {
  const memory = loadMemory();
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return false;
  if (memory.items.some((it) => it.ref === ref && it.text === clean)) return false;
  memory.items.push({
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    ref,
    version,
    text: clean,
    box: 0,
    due: 0,
    t: Date.now(),
  });
  saveMemory(memory);
  scheduleBackupSync();
  renderMemory();
  return true;
}

// --- Words

function memWords(text) {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}'\s-]/gu, " ")
    .split(/[\s-]+/)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter(Boolean);
}

// Longest common subsequence of two word lists; returns which target words were matched.
function memMatch(target, typed) {
  const n = target.length;
  const m = typed.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = target[i] === typed[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const hit = new Array(n).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (target[i] === typed[j]) {
      hit[i++] = true;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return { hit, matched: dp[0][0] };
}

const MEM_WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

// Masks a verse for self-testing. "blanks" hides a share of the words; "letters" keeps only first letters.
function maskText(text, mode, share) {
  const total = (text.match(MEM_WORD) || []).length;
  const hide = new Set();
  if (mode === "blanks") {
    const want = Math.max(1, Math.round(total * share));
    while (hide.size < Math.min(want, total)) hide.add(Math.floor(Math.random() * total));
  }
  let i = -1;
  return text.replace(MEM_WORD, (w) => {
    i++;
    if (mode === "letters") return w[0] + "·".repeat(Math.min(w.length - 1, 4));
    return hide.has(i) ? "_".repeat(Math.max(3, Math.min(w.length, 9))) : w;
  });
}

// --- Highlighting in the reader

let memSelection = null; // {ref, version, text}: the last valid highlight in the reader

function readerHighlight() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !readerKey) return null;
  const range = sel.getRangeAt(0);
  if (!els.readerText.contains(range.commonAncestorContainer)) return null;
  const frag = range.cloneContents();
  frag.querySelectorAll("sup.verse-num").forEach((n) => n.remove());
  const text = frag.textContent.replace(/\s+/g, " ").trim();
  if (!text) return null;
  const nums = [...els.readerText.querySelectorAll(".verse")]
    .filter((span) => range.intersectsNode(span))
    .map((span) => Number(span.dataset.v));
  if (nums.length === 0) return null;
  const [book, chapter] = splitKey(readerKey);
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  return {
    ref: lo === hi ? `${book} ${chapter}:${lo}` : `${book} ${chapter}:${lo}–${hi}`,
    version: els.readerSummary.textContent.endsWith("KJV27") ? "KJV27" : "KJV",
    text,
  };
}

// Plain text of one verse in the reader, without its number.
function readerVerseText(v) {
  const span = els.readerText.querySelector(`.verse[data-v="${v}"]`);
  if (!span) return "";
  const copy = span.cloneNode(true);
  copy.querySelectorAll("sup.verse-num").forEach((n) => n.remove());
  return copy.textContent.replace(/\s+/g, " ").trim();
}

function initMemorizePill() {
  const pill = document.getElementById("memorize-pill");
  let timer = 0;
  document.addEventListener("selectionchange", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const found = readerHighlight();
      if (found) memSelection = found;
      pill.hidden = !found;
      if (found) pill.textContent = `📌 Memorize “${found.text.length > 28 ? found.text.slice(0, 26) + "…" : found.text}”`;
    }, 120);
  });
  pill.addEventListener("pointerdown", (e) => e.preventDefault()); // keep the highlight while tapping
  pill.addEventListener("click", () => {
    if (!memSelection) return;
    const added = addMemoryItem(memSelection);
    showToasts([{ label: added ? `📌 Saved to Scripture memory: ${memSelection.ref}` : "Already in Scripture memory" }]);
    pill.hidden = true;
    memSelection = null;
    window.getSelection().removeAllRanges();
  });
}

// --- The list

function dueLabel(item) {
  if (item.box >= MEMORY_MAX_BOX && item.due > Date.now()) return "Memorized";
  const days = Math.ceil((item.due - Date.now()) / MEM_DAY_MS);
  if (item.due <= Date.now()) return item.box === 0 ? "New" : "Due";
  return days <= 1 ? "Due tomorrow" : `Due in ${days} days`;
}

function renderMemory() {
  const memory = loadMemory();
  const due = memory.items.filter((it) => it.due <= Date.now());
  document.getElementById("memory-count").textContent =
    memory.items.length === 0 ? "" : due.length > 0 ? `(${due.length} due)` : `(${memory.items.length})`;
  const list = document.getElementById("mem-list");
  list.textContent = "";
  for (const item of memory.items) {
    const li = document.createElement("li");
    const head = document.createElement("div");
    head.className = "q-item-head";
    head.append(textEl("strong", "", item.ref || "Highlight"), textEl("span", "q-badge", item.version), textEl("span", "q-badge", dueLabel(item)));
    const del = textEl("button", "q-clear", "Remove");
    del.type = "button";
    del.addEventListener("click", () => {
      const m = loadMemory();
      m.items = m.items.filter((it) => it.id !== item.id);
      saveMemory(m);
      scheduleBackupSync();
      renderMemory();
    });
    head.appendChild(del);
    li.append(head, textEl("p", "mem-snippet", item.text));
    list.appendChild(li);
  }
  const practice = document.getElementById("mem-practice");
  practice.hidden = memory.items.length === 0;
  practice.textContent = due.length > 0 ? `Practice (${due.length} due)` : "Practice anyway";
}

async function handleAddMemoryByRef(e) {
  e.preventDefault();
  const input = document.getElementById("mem-passage");
  const status = document.getElementById("mem-status");
  const parsed = parsePassage(input.value);
  if (!parsed) {
    status.textContent = "Try something like John 3:16, Psalm 23:1-4 or Psalm 23.";
    return;
  }
  status.textContent = "Looking it up…";
  try {
    const verses = await kjvChapterVerses(parsed.book, parsed.chapter);
    const from = parsed.from ?? 1;
    const to = Math.min(parsed.to ?? verses.length, verses.length);
    if (from > verses.length) throw new Error("range");
    const text = verses.slice(from - 1, to).map(plainVerse).join(" ");
    const ref = passageLabel({ ...parsed, from: parsed.from ?? 1, to: parsed.from === null ? verses.length : to });
    const added = addMemoryItem({ ref, version: "KJV", text });
    status.textContent = added ? `Added ${ref}.` : "That one is already in your list.";
    if (added) input.value = "";
  } catch {
    status.textContent = "Couldn't find that passage — check the reference and your connection.";
  }
}

// --- Practice

let drill = null; // {queue, i, pass, miss, retried}

function startDrill() {
  const memory = loadMemory();
  const now = Date.now();
  let pool = memory.items.filter((it) => it.due <= now);
  if (pool.length === 0) pool = memory.items.slice();
  if (pool.length === 0) return;
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  drill = { queue: pool.map((it) => it.id), i: 0, pass: 0, miss: 0, xp: 0, retried: new Set(), practiceAhead: !memory.items.some((it) => it.due <= now) };
  document.getElementById("mem-home").hidden = true;
  showDrillCard();
}

function endDrill() {
  const box = document.getElementById("mem-drill");
  const summary = drill
    ? `Session done: ${drill.pass} remembered, ${drill.miss} to review again${drill.xp > 0 ? `, +${drill.xp} XP` : ""}.`
    : "";
  drill = null;
  box.hidden = true;
  box.textContent = "";
  document.getElementById("mem-home").hidden = false;
  document.getElementById("mem-status").textContent = summary;
  render();
}

// Awards XP for a pass and returns how much was earned (0 for a retry, a practice-ahead or past the cap).
function awardMemoryXp(memory, item, wasDue, retry) {
  if (!wasDue || retry) return 0;
  const today = localDateKey(new Date());
  if (memory.day !== today) {
    memory.day = today;
    memory.earned = 0;
  }
  const words = memWords(item.text).length;
  const want = Math.round(MEMORY_XP[item.box] * Math.min(3, Math.max(1, words / 25)));
  const xp = Math.max(0, Math.min(want, MEMORY_XP_DAILY_CAP - memory.earned));
  memory.earned += xp;
  memory.xp += xp;
  return xp;
}

function gradeItem(id, passed) {
  const memory = loadMemory();
  const item = memory.items.find((it) => it.id === id);
  let xp = 0;
  let levelUp = null;
  if (item) {
    const wasDue = item.due <= Date.now();
    item.box = passed ? Math.min(MEMORY_MAX_BOX, item.box + 1) : 0;
    item.due = Date.now() + MEMORY_DAYS[item.box] * MEM_DAY_MS;
    if (passed) {
      const log = loadReadLog();
      const oldLevel = levelForXp(computeLifetimeXp(log, loadAchievements()));
      xp = awardMemoryXp(memory, item, wasDue, drill.retried.has(id));
      saveMemory(memory);
      const newLevel = levelForXp(computeLifetimeXp(log, loadAchievements()));
      if (newLevel > oldLevel) levelUp = { oldRank: getRank(oldLevel), newLevel };
    } else {
      saveMemory(memory);
    }
    scheduleBackupSync();
  }
  drill.xp += xp;
  if (xp > 0) showXpPop(xp);
  if (levelUp) {
    render();
    showLevelUp(levelUp.newLevel, levelUp.oldRank, getRank(levelUp.newLevel));
  }
  if (passed) drill.pass++;
  else {
    drill.miss++;
    if (!drill.retried.has(id)) {
      drill.retried.add(id);
      drill.queue.push(id); // one more try at the end of this session
    }
  }
  drill.i++;
  showDrillCard();
}

function showDrillCard() {
  const box = document.getElementById("mem-drill");
  box.textContent = "";
  box.hidden = false;
  const id = drill.queue[drill.i];
  const item = id && loadMemory().items.find((it) => it.id === id);
  if (!item) {
    if (id) {
      drill.i++; // removed meanwhile
      return showDrillCard();
    }
    return endDrill();
  }
  const stage = item.box <= 0 ? "blanks-easy" : item.box === 1 ? "blanks-hard" : item.box === 2 ? "letters" : "type";
  const label = { "blanks-easy": "Fill in the blanks", "blanks-hard": "Fill in the blanks (harder)", letters: "First letters", type: "From memory" }[stage];
  const progress = textEl("p", "hint", `${drill.i + 1} of ${drill.queue.length} · ${label}${drill.practiceAhead ? " · practice only, no XP" : ""}`);
  const title = document.createElement("h3");
  title.className = "mem-ref";
  title.textContent = `${item.ref || "Highlight"} (${item.version})`;
  box.append(progress, title);

  const quit = textEl("button", "q-clear", "End session");
  quit.type = "button";
  quit.addEventListener("click", endDrill);

  if (stage !== "type") {
    const masked = maskText(item.text, stage === "letters" ? "letters" : "blanks", stage === "blanks-easy" ? 0.3 : 0.6);
    const prompt = textEl("p", "mem-text", masked);
    const reveal = textEl("button", "primary", "Show the answer");
    reveal.type = "button";
    reveal.addEventListener("click", () => {
      prompt.textContent = item.text;
      reveal.replaceWith(gradeButtons(item.id, "Did you get it?"));
    });
    box.append(prompt, reveal, quit);
    return;
  }

  const ta = document.createElement("textarea");
  ta.className = "code-box";
  ta.rows = 5;
  ta.placeholder = "Type it out from memory…";
  ta.autocapitalize = "off";
  ta.spellcheck = false;
  const hint = textEl("button", "", "Hint: first words");
  hint.type = "button";
  hint.addEventListener("click", () => {
    hint.replaceWith(textEl("p", "hint", item.text.split(/\s+/).slice(0, 3).join(" ") + " …"));
  });
  const check = textEl("button", "primary", "Check");
  check.type = "button";
  check.addEventListener("click", () => {
    const target = memWords(item.text);
    const typed = memWords(ta.value);
    const { hit, matched } = memMatch(target, typed);
    const accuracy = matched / Math.max(target.length, typed.length, 1);
    const passed = accuracy >= MEMORY_PASS;
    const shown = document.createElement("p");
    shown.className = "mem-text";
    // Show the real text, with the words you missed marked.
    let k = -1;
    let cursor = 0;
    for (const m of item.text.matchAll(MEM_WORD)) {
      k++;
      shown.appendChild(document.createTextNode(item.text.slice(cursor, m.index)));
      const span = document.createElement("span");
      span.textContent = m[0];
      if (!hit[k]) span.className = "mem-miss";
      shown.appendChild(span);
      cursor = m.index + m[0].length;
    }
    shown.appendChild(document.createTextNode(item.text.slice(cursor)));
    const verdict = textEl("p", passed ? "mem-pass" : "mem-fail", `${Math.round(accuracy * 100)}% — ${passed ? "well done" : "missed words are underlined"}`);
    const next = textEl("button", "primary", "Next");
    next.type = "button";
    next.addEventListener("click", () => gradeItem(item.id, passed));
    ta.replaceWith(shown);
    hint.remove();
    check.replaceWith(verdict, next);
  });
  box.append(ta, hint, check, quit);
  setTimeout(() => ta.focus(), 0);
}

function gradeButtons(id, question) {
  const wrap = document.createElement("div");
  wrap.append(textEl("p", "hint", question));
  const yes = textEl("button", "primary", "I knew it");
  const no = textEl("button", "", "Missed some");
  yes.type = no.type = "button";
  yes.addEventListener("click", () => gradeItem(id, true));
  no.addEventListener("click", () => gradeItem(id, false));
  const row = document.createElement("div");
  row.className = "button-row";
  row.append(yes, no);
  wrap.appendChild(row);
  return wrap;
}

function initMemory() {
  document.getElementById("mem-form").addEventListener("submit", handleAddMemoryByRef);
  document.getElementById("mem-practice").addEventListener("click", startDrill);
  initMemorizePill();
  renderMemory();
}

document.addEventListener("DOMContentLoaded", initMemory);
