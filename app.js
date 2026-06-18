"use strict";

/* Sthpw. Word data (LEFT_WORDS / RIGHT_WORDS / BALANCED_WORDS) comes from
   wordlists.js. Two modes:
     - "split"    : one left-hand word + one right-hand word (Sthpw).
     - "balanced" : two mixed-hand words that alternate hands (Fstbll). */

// --- Easily tunable knobs ------------------------------------------------
const DEFAULTS = {
  minLen: 5,
  maxLen: 7,
  count: 4,
};
// Bounds of the bundled word data (must match build-wordlists.mjs).
const DATA_MIN_LEN = 3;
const DATA_MAX_LEN = 12;

// Digit -> shift-symbol. Split by hand for "split" mode; the full set is used
// in "balanced" mode (where each word already uses both hands).
const LEFT_DIGITS = { 1: "!", 2: "@", 3: "#", 4: "$", 5: "%" };
const RIGHT_DIGITS = { 6: "^", 7: "&", 8: "*", 9: "(", 0: ")" };
const ALL_DIGITS = { ...LEFT_DIGITS, ...RIGHT_DIGITS };

// --- Secure randomness ---------------------------------------------------
// Unbiased integer in [0, n) via rejection sampling on crypto bytes.
function randInt(n) {
  if (n <= 0) throw new Error("randInt needs n > 0");
  const maxUnbiased = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  let x;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= maxUnbiased);
  return x % n;
}

function pick(arr) {
  return arr[randInt(arr.length)];
}

function randBool() {
  return randInt(2) === 0;
}

// --- Word pools (memoized by mode + length range) ------------------------
const poolCache = new Map();

function pools(mode, minLen, maxLen) {
  const key = `${mode}-${minLen}-${maxLen}`;
  let cached = poolCache.get(key);
  if (!cached) {
    const inRange = (w) => w.length >= minLen && w.length <= maxLen;
    cached =
      mode === "balanced"
        ? { balanced: BALANCED_WORDS.filter(inRange) }
        : { left: LEFT_WORDS.filter(inRange), right: RIGHT_WORDS.filter(inRange) };
    poolCache.set(key, cached);
  }
  return cached;
}

// --- Core generation -----------------------------------------------------
function makePair(word, capitalized, digits, cls) {
  // The capitalized word gets a shift-symbol; the lowercase one a plain digit.
  const key = pick(Object.keys(digits));
  const text = capitalized ? word.toUpperCase() + digits[key] : word + key;
  return { cls, text };
}

function generateSplit(leftPool, rightPool) {
  const leftWord = pick(leftPool);
  const rightWord = pick(rightPool);
  const capLeft = randBool(); // which word is ALL CAPS
  const leftFirst = randBool(); // pair ordering

  const leftPair = makePair(leftWord, capLeft, LEFT_DIGITS, "seg-left");
  const rightPair = makePair(rightWord, !capLeft, RIGHT_DIGITS, "seg-right");

  const segments = leftFirst ? [leftPair, rightPair] : [rightPair, leftPair];
  return { password: segments.map((s) => s.text).join(""), segments };
}

function generateBalanced(pool) {
  const wordA = pick(pool);
  let wordB = pick(pool);
  while (pool.length > 1 && wordB === wordA) wordB = pick(pool);

  const capA = randBool(); // which word is ALL CAPS

  const pairA = makePair(wordA, capA, ALL_DIGITS, "seg-a");
  const pairB = makePair(wordB, !capA, ALL_DIGITS, "seg-b");

  // Color order is fixed: the "a" word is always first, the "b" word second.
  const segments = [pairA, pairB];
  return { password: segments.map((s) => s.text).join(""), segments };
}

// --- Clipboard -----------------------------------------------------------
async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path (e.g. file://) */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// --- Rendering -----------------------------------------------------------
const els = {
  generate: document.getElementById("generate"),
  results: document.getElementById("results"),
  error: document.getElementById("error"),
};

const modeTabs = {
  split: document.getElementById("mode-split"),
  balanced: document.getElementById("mode-balanced"),
};

let mode = "split";

function showError(msg) {
  els.error.textContent = msg;
  els.error.hidden = false;
  els.results.innerHTML = "";
}

function clearError() {
  els.error.hidden = true;
  els.error.textContent = "";
}

function buildCard(result) {
  const row = document.createElement("div");
  row.className = "row";

  const pw = document.createElement("div");
  pw.className = "password";
  for (const seg of result.segments) {
    const span = document.createElement("span");
    span.className = seg.cls;
    span.textContent = seg.text;
    pw.appendChild(span);
  }

  const copyBtn = document.createElement("button");
  copyBtn.className = "copy-btn";
  copyBtn.type = "button";
  copyBtn.textContent = "Copy";
  copyBtn.addEventListener("click", async () => {
    const ok = await copyText(result.password);
    copyBtn.textContent = ok ? "Copied" : "Press ⌘C";
    copyBtn.classList.toggle("copied", ok);
    setTimeout(() => {
      copyBtn.textContent = "Copy";
      copyBtn.classList.remove("copied");
    }, 1400);
  });

  row.append(pw, copyBtn);
  return row;
}

function generate() {
  // Settings are fixed in code (see DEFAULTS at the top of this file).
  const { minLen, maxLen, count } = DEFAULTS;

  let makeOne;
  if (mode === "balanced") {
    const { balanced } = pools(mode, minLen, maxLen);
    if (balanced.length === 0) {
      showError(
        `No balanced words fit ${minLen}–${maxLen} letters. ` +
          `Try widening the length range.`,
      );
      return;
    }
    makeOne = () => generateBalanced(balanced);
  } else {
    const { left, right } = pools(mode, minLen, maxLen);
    if (left.length === 0 || right.length === 0) {
      const which = [];
      if (left.length === 0) which.push("left-hand");
      if (right.length === 0) which.push("right-hand");
      showError(
        `No ${which.join(" or ")} words fit ${minLen}–${maxLen} letters. ` +
          `Try widening the length range.`,
      );
      return;
    }
    makeOne = () => generateSplit(left, right);
  }

  clearError();
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    frag.appendChild(buildCard(makeOne()));
  }
  els.results.innerHTML = "";
  els.results.appendChild(frag);
}

function setMode(next) {
  mode = next;
  for (const [name, el] of Object.entries(modeTabs)) {
    const selected = name === next;
    el.setAttribute("aria-selected", String(selected));
    el.tabIndex = selected ? 0 : -1;
  }
  generate();
}

// --- Init ----------------------------------------------------------------
for (const [name, el] of Object.entries(modeTabs)) {
  el.addEventListener("click", () => setMode(name));
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setMode(name);
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = name === "split" ? "balanced" : "split";
      modeTabs[next].focus();
      setMode(next);
    }
  });
}

els.generate.addEventListener("click", generate);

// Generate an initial batch so the page is useful immediately.
generate();
