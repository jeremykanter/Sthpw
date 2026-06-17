"use strict";

/* Sthpw — two-handed password generator.
 * Pure browser JS. LEFT_WORDS / RIGHT_WORDS come from wordlists.js. */

// --- Easily tunable knobs ------------------------------------------------
const DEFAULTS = {
  minLen: 5,
  maxLen: 7,
  count: 4,
};
// Bounds of the bundled word data (must match build-wordlists.mjs).
const DATA_MIN_LEN = 3;
const DATA_MAX_LEN = 12;

// Digit -> shift-symbol, split by hand (standard touch typing).
const LEFT_DIGITS = { 1: "!", 2: "@", 3: "#", 4: "$", 5: "%" };
const RIGHT_DIGITS = { 6: "^", 7: "&", 8: "*", 9: "(", 0: ")" };
const LEFT_KEYS = Object.keys(LEFT_DIGITS); // ["1".."5"]
const RIGHT_KEYS = Object.keys(RIGHT_DIGITS); // ["6","7","8","9","0"]

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

// --- Word pools (memoized by length range) -------------------------------
const poolCache = new Map();

function pools(minLen, maxLen) {
  const key = `${minLen}-${maxLen}`;
  let cached = poolCache.get(key);
  if (!cached) {
    const inRange = (w) => w.length >= minLen && w.length <= maxLen;
    cached = {
      left: LEFT_WORDS.filter(inRange),
      right: RIGHT_WORDS.filter(inRange),
    };
    poolCache.set(key, cached);
  }
  return cached;
}

// --- Core generation -----------------------------------------------------
function makePair(word, capitalized, side) {
  // The capitalized word gets a shift-symbol; the lowercase one a plain digit.
  const digits = side === "left" ? LEFT_DIGITS : RIGHT_DIGITS;
  const keys = side === "left" ? LEFT_KEYS : RIGHT_KEYS;
  const key = pick(keys);
  const text = capitalized ? word.toUpperCase() + digits[key] : word + key;
  return { side, text };
}

function generateOne(leftPool, rightPool) {
  const leftWord = pick(leftPool);
  const rightWord = pick(rightPool);
  const capSide = randBool() ? "left" : "right"; // which word is ALL CAPS
  const leftFirst = randBool(); // pair ordering

  const leftPair = makePair(leftWord, capSide === "left", "left");
  const rightPair = makePair(rightWord, capSide === "right", "right");

  const segments = leftFirst ? [leftPair, rightPair] : [rightPair, leftPair];
  const password = segments.map((s) => s.text).join("");

  return { password, segments };
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
    span.className = seg.side === "left" ? "seg-left" : "seg-right";
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
  const { left, right } = pools(minLen, maxLen);

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

  clearError();
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    frag.appendChild(buildCard(generateOne(left, right)));
  }
  els.results.innerHTML = "";
  els.results.appendChild(frag);
}

// --- Init ----------------------------------------------------------------
els.generate.addEventListener("click", generate);

// Generate an initial batch so the page is useful immediately.
generate();
