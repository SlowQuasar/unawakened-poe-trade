// CSD is line based, but quoted strings contain escaped quotes and newlines.
export function tokens(line) {
  return [...line.matchAll(/"((?:\\.|[^"\\])*)"|([^\s]+)/g)].map(m => m[1] === undefined
    ? m[2] : m[1].replace(/\\([nrt"\\])/g, (_, c) => ({ n: '\n', r: '\r', t: '\t' }[c] ?? c)));
}

export function range(token) {
  if (/^!-?\d+$/.test(token)) return { min: null, max: null, exclude: Number(token.slice(1)) };
  // Shipped CSD contains a trailing '#' on a handful of upper bounds.
  if (/^-?\d+\|-?\d+#$/.test(token)) return { ...range(token.slice(0, -1)), raw: token };
  if (token === '#') return { min: null, max: null };
  const parts = token.split('|');
  if (!parts.every(p => p === '#' || /^-?\d+$/.test(p)) || parts.length > 2)
    throw new Error(`Invalid condition: ${token}`);
  const number = p => p === '#' ? null : Number(p);
  return { min: number(parts[0]), max: number(parts.at(-1)) };
}

export function parseCsd(text, source = '<memory>') {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const descriptions = [], includes = [], suppressed = [];
  let i = 0;
  const next = () => {
    while (i < lines.length) {
      const line = lines[i++].trim();
      if (line && !line.startsWith('//')) return line;
    }
    throw new Error(`${source}: unexpected EOF`);
  };
  function variants(count, dimensions) {
    if (!/^\d+$/.test(count)) throw new Error(`${source}:${i}: expected variant count: ${count}`);
    return Array.from({ length: Number(count) }, () => {
      const line = next(), quote = line.indexOf('"');
      if (quote < 0) throw new Error(`${source}:${i}: missing template`);
      const conditions = line.slice(0, quote).trim().split(/\s+/).filter(Boolean).map(range);
      if (conditions.length !== dimensions) throw new Error(`${source}:${i}: wrong condition count`);
      const [template, ...tail] = tokens(line.slice(quote));
      const handlers = [];
      let reminderstring;
      for (let t = 0; t < tail.length;) {
        const name = tail[t++], args = [];
        if (name === 'reminderstring') { reminderstring = tail[t++]; continue; }
        while (t < tail.length && /^-?\d+(?:\.\d+)?$/.test(tail[t])) args.push(Number(tail[t++]));
        handlers.push({ name, args });
      }
      return { conditions, template, handlers, ...(reminderstring ? { reminderstring } : {}), line: i };
    });
  }
  while (i < lines.length) {
    const line = lines[i++].trim();
    if (!line || line.startsWith('//')) continue;
    if (line.startsWith('include ')) { includes.push(tokens(line)[1]); continue; }
    if (line.startsWith('no_description ')) { suppressed.push(...tokens(line).slice(1)); continue; }
    if (line !== 'description') throw new Error(`${source}:${i}: unexpected directive ${line}`);
    const lineNumber = i, [size, ...stats] = tokens(next());
    if (Number(size) !== stats.length) throw new Error(`${source}:${i}: wrong stat count`);
    const languages = { English: variants(next(), stats.length) };
    while (i < lines.length) {
      if (!lines[i].trim()) { i++; continue; }
      if (!lines[i].trim().startsWith('lang ')) break;
      const language = tokens(lines[i++].trim())[1];
      languages[language] = variants(next(), stats.length);
    }
    descriptions.push({ source, line: lineNumber, stats, languages });
  }
  return { descriptions, includes, suppressed };
}

export function plainText(text) {
  // Game markup: [display], [metadata|display]. Bracketed help is not clipboard text.
  return text.replace(/\[([^\[\]]+)\]/g, (_, s) => s.split('|').at(-1));
}

const NUMERIC = new Set(['negate', 'divide_by_one_hundred', 'divide_by_ten', 'divide_by_fifteen',
  'milliseconds_to_seconds', 'milliseconds_to_seconds_2dp', 'per_minute_to_per_second',
  'times_twenty', 'times_one_point_five', 'multiplicative_damage_modifier']);
const numeric = name => NUMERIC.has(name) || /^(?:divide_by_|milliseconds_to_seconds|per_minute_to_per_second|multiply_by_)/.test(name) ||
  ['canonical_line', 'canonical_stat', 'markup', 'locations_to_metres', 'deciseconds_to_seconds',
    'old_leech_percent', 'old_leech_permyriad', 'double', 'negate_and_double', 'plus_two_hundred',
    '30%_of_value', '60%_of_value', 'permyriad_per_minute_to_%_per_second'].includes(name);

export function makeMatcher(variant, { ref = false } = {}) {
  // Table/name lookup handlers require domain-specific expansion; keep baseline
  // rather than emitting wildcards that could silently identify the wrong stat.
  const unsupported = variant.handlers.filter(h => !numeric(h.name));
  if (unsupported.length) return { unsupported: unsupported.map(h => h.name) };
  const used = new Set();
  let implicitIndex = 0;
  const string = plainText(variant.template).replace(/\{(\d*)(?::([^}]*))?\}/g, (_, index, format = '') => {
    used.add(index === '' ? implicitIndex++ : Number(index));
    return ref && format.includes('+') ? '+#' : '#';
  });
  if (/[{}]/.test(string)) return { unsupported: ['template-format'] };
  const negate = variant.handlers.some(h => /negate/.test(h.name) && (!h.args.length || h.args.some(n => used.has(n - 1))));
  const matcher = { string, ...(negate ? { negate: true } : {}) };
  if (!used.size && variant.conditions.length === 1) {
    const { min, max } = variant.conditions[0];
    if (min !== null && min === max) {
      let value = min;
      for (const h of variant.handlers) {
        if (h.name === 'divide_by_one_hundred') value /= 100;
        if (h.name === 'divide_by_ten') value /= 10;
        if (h.name.startsWith('milliseconds_to_seconds')) value /= 1000;
        if (h.name === 'per_minute_to_per_second') value /= 60;
        if (h.name === 'times_twenty') value *= 20;
      }
      matcher.value = value;
    }
  }
  return { matcher };
}

export function uniqueMatchers(matchers) {
  return [...new Map(matchers.map(m => [JSON.stringify(m), m])).values()];
}
