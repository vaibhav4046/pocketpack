# PocketPack

**Any article becomes an offline study pack.** Paste a URL or plain text, and PocketPack gives you one small HTML file (usually under 60 KB) that opens on any phone, tablet, or laptop - with no internet, no app, and no account.

Built for **AccessED Hacks** (education accessibility).

## The barrier

Online learning materials assume you can read long walls of text, on a big screen, with a stable connection. That shuts out people reading on phones, on the move, with patchy data, with dyslexia, or with low reading stamina.

## What a pack contains

- **Chunked reading** - long text split into short, finishable parts (~150 words each) with Previous/Next navigation.
- **Read aloud** - one tap reads the current part using the device's built-in speech (Web Speech API; no audio files, works offline).
- **Dyslexia-friendly mode** - one tap switches to a wider-spaced, easier font with looser line height and letter spacing.
- **Bigger text** - one tap for larger type.
- **Hard-word glossary** - flags longer, less common words (heuristic: not in a small common-words set, and 3+ estimated syllables or 9+ letters) so a learner knows what to look up.
- **Self-quiz** - rule-based fill-in-the-blank questions built from sentences that contain glossary words.
- **Reading estimate** - word count, part count, and approximate minutes.

Everything is inlined into the single file: text, styles, and script. There are no external requests - the pack works in airplane mode.

## What it deliberately does not do

- No accounts, tracking, ads, or analytics in the pack file.
- No AI-generated "simplification" of the text - the learner reads the real words, with support around them.
- The glossary flags words to look up; it does not invent definitions (a wrong definition is worse than none).
- URL fetching depends on the page being publicly reachable and having real paragraph text; when it fails, the app says so and asks for pasted text instead of guessing.

## Try it

- Live app: (Vercel URL after deploy)
- Sample packs in `public/sample-*.html` - generated from real Wikipedia articles (Dyslexia, Photosynthesis, Internet safety). Download and open one offline.

## Run locally

Zero dependencies, Node 18+:

```
node run.mjs
# open http://localhost:4174
```

`POST /api/pack` with `{"source": "<url or text>"}` returns the pack HTML as a download.

## Architecture

- `run.mjs` - zero-dep static server + `/api/pack` endpoint.
- `src/extract.mjs` - honest article extraction: strips boilerplate, scores block containers by paragraph density, falls back to all-paragraphs when container matching under-extracts (nested divs defeat naive regex matching).
- `src/words.mjs` - syllable estimate, hard-word heuristic, Flesch reading-ease estimate, glossary extraction.
- `src/pack.mjs` - builds the single-file pack: chunked text, inline CSS/JS for navigation, read-aloud, font modes, glossary panel, and the quiz.
- `public/` - the app UI plus three pre-generated sample packs.

## Accessibility notes

- Respects `prefers-color-scheme` (dark mode).
- Controls are real buttons with titles; the pack is keyboard-navigable.
- Works at small viewport widths (phone-first reading).

## License

MIT (for the hackathon; reuse welcome).
