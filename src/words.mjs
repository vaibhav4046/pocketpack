// Word difficulty: rough syllable estimate + a small common-words set.
// "Hard" = not common AND (>=3 syllables or >=9 letters). Crude, transparent,
// and good enough for a glossary nudge - not a linguistics engine.

const COMMON = new Set(("the be to of and a in that have i it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is are was were been has had did said each many more much where why very through before between never under while might must shall should against below above such own same off both few those too during again once here when where how".split(/\s+/)));

export function estimateSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!word) return 0;
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]e|ed|es)$/, '').replace(/^y/, '');
  const groups = word.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function isHardWord(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length < 6) return false;
  if (COMMON.has(w)) return false;
  return estimateSyllables(w) >= 3 || w.length >= 9;
}

// Simple word stats for the pack's "reading level" panel.
export function readingStats(text) {
  const sentences = text.split(/[.!?]+\s+/).filter(s => s.trim().length > 0);
  const words = text.match(/[A-Za-z']+/g) || [];
  const syllables = words.reduce((a, w) => a + estimateSyllables(w), 0);
  const wps = words.length / Math.max(1, sentences.length);
  const spw = syllables / Math.max(1, words.length);
  // Flesch Reading Ease (standard formula, reported as an estimate)
  const flesch = 206.835 - 1.015 * wps - 84.6 * spw;
  const minutes = Math.max(1, Math.round(words.length / 200));
  return { words: words.length, sentences: sentences.length, flesch: Math.round(flesch), minutes };
}

// Extract glossary candidates with counts, top N by frequency.
export function glossaryCandidates(text, max = 12) {
  const freq = new Map();
  const forms = new Map();
  for (const m of text.matchAll(/[A-Za-z][A-Za-z-]{4,}/g)) {
    const raw = m[0];
    const low = raw.toLowerCase();
    if (isHardWord(low)) {
      freq.set(low, (freq.get(low) || 0) + 1);
      if (!forms.has(low)) forms.set(low, raw);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([low, count]) => ({ word: forms.get(low), count }));
}
