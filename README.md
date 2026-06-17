# Sthpw

A tiny, dependency-free web app that generates **memorable, easy-to-type passwords**
that alternate between your left and right hands on a QWERTY keyboard.

Each password combines:

- one **left-hand word** (only `q w e r t a s d f g z x c v b`),
- one **right-hand word** (only `y u i o p h j k l n m`),
- one word in **ALL CAPS**, the other lowercase,
- two **digits** split across the hands — one shown as its shift-symbol, one as a plain number.

The four layouts (which word is capitalized × which pair comes first):

```
[LEFT WORD][left symbol][right word][right number]      e.g.  STRAFE$onion7
[RIGHT WORD][right symbol][left word][left number]      e.g.  NYLON^carafe3
[left word][left number][RIGHT WORD][right symbol]      e.g.  carafe3NYLON^
[right word][right number][LEFT WORD][left symbol]      e.g.  onion7STRAFE$
```

The capitalized word is always followed by a shift-symbol from its own hand; the
lowercase word by a plain number from its own hand.

## Running

It's pure static HTML/CSS/JS — just open `index.html` in a browser. No server and
no build step. All generation happens locally using `crypto.getRandomValues`. The
only network request is an optional Google Fonts load for IBM Plex; offline it
falls back to system fonts and works the same.

## Files

| File           | Purpose                                                        |
| -------------- | -------------------------------------------------------------- |
| `index.html`   | Markup                                                         |
| `styles.css`   | Styling                                                        |
| `app.js`       | Generation logic + UI                                          |
| `wordlists.js` | Generated word data (`LEFT_WORDS`, `RIGHT_WORDS`)              |
| `build/`       | One-time dev script to (re)build `wordlists.js`                |

## Tuning

- **Length range / count:** edit the `DEFAULTS` constant at the top of
  [`app.js`](app.js).
- **Bundled word length window:** edit `MIN_LEN` / `MAX_LEN` in
  [`build/build-wordlists.mjs`](build/build-wordlists.mjs), then rebuild.

## Rebuilding the word list

```sh
node build/build-wordlists.mjs
```

This downloads the [dwyl/english-words](https://github.com/dwyl/english-words)
dictionary (`words_alpha.txt`, ~4 MB, cached in `build/`), partitions it into
left-hand-only and right-hand-only words, and writes `wordlists.js`. Current
pools: **5,348 left** words, **906 right** words (right-hand words are scarce
because that half of the keyboard has no `a` or `e`).

## Note on strength

These passwords are optimized for memorability and typing speed; their entropy is
inherently bounded (~25–30 bits depending on the length range). For your most
sensitive accounts, a long random string from a password manager is still
stronger.
