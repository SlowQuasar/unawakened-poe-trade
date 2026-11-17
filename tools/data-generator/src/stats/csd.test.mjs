import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsd, range, makeMatcher, plainText, tokens } from './csd.mjs';
import { splitStaticDescription, preserveMapTradeIdentity } from './build.mjs';

test('Blighted Map wording changes retain its historical trade identity', () => {
  const baseline = [{ ref: 'historical three-line Blight wording', trade: { ids: { implicit: ['implicit.stat_299373046'] } } }];
  const candidate = { description: { stats: ['is_blighted_map'] }, ids: {} };
  assert.deepEqual(preserveMapTradeIdentity(candidate, baseline).ids.implicit, ['implicit.stat_299373046']);
  assert.deepEqual(preserveMapTradeIdentity(candidate, baseline).ids.implicit, ['implicit.stat_299373046']);
  assert.throws(() => preserveMapTradeIdentity(candidate, []), /Missing baseline/);
  assert.equal(preserveMapTradeIdentity(undefined, baseline), undefined);
});

test('CSD ranges preserve bounds, exclusions and shipped anomalous suffix', () => {
  assert.deepEqual(range('#'), { min: null, max: null });
  assert.deepEqual(range('#|-1'), { min: null, max: -1 });
  assert.deepEqual(range('1|#'), { min: 1, max: null });
  assert.deepEqual(range('100'), { min: 100, max: 100 });
  assert.deepEqual(range('!0'), { min: null, max: null, exclude: 0 });
  assert.deepEqual(range('1|99#'), { min: 1, max: 99, raw: '1|99#' });
  assert.throws(() => range('bogus'));
});

test('description IR preserves language-specific variants, handlers and reminders', () => {
  const parsed = parseCsd(`\uFEFFinclude "Metadata/StatDescriptions/base.csd"
no_description hidden_stat
description
  1 resistance
  2
    1|# "{0:+d}% to [Fire|Fire] Resistance" reminderstring Help
    #|-1 "Lose {0}% Resistance\\nwhen Hit" negate 1 divide_by_one_hundred 1
  lang "Korean"
  1
    # "화염 저항 {0:+d}%"
`);
  assert.equal(parsed.includes[0], 'Metadata/StatDescriptions/base.csd');
  assert.deepEqual(parsed.suppressed, ['hidden_stat']);
  const description = parsed.descriptions[0];
  assert.deepEqual(description.stats, ['resistance']);
  assert.equal(description.languages.English[0].reminderstring, 'Help');
  assert.deepEqual(description.languages.English[1].handlers, [
    { name: 'negate', args: [1] }, { name: 'divide_by_one_hundred', args: [1] }
  ]);
  assert.equal(description.languages.English[1].template, 'Lose {0}% Resistance\nwhen Hit');
  assert.deepEqual(makeMatcher(description.languages.English[0], { ref: true }).matcher, { string: '+#% to Fire Resistance' });
  assert.deepEqual(makeMatcher(description.languages.English[0]).matcher, { string: '#% to Fire Resistance' });
  assert.equal(makeMatcher(description.languages.English[1]).matcher.negate, true);
  assert.equal(makeMatcher(description.languages.Korean[0]).matcher.string, '화염 저항 #%');
});

test('fixed 100% variants and multiple-stat conditions are retained', () => {
  const parsed = parseCsd(`description
1 avoid
2
100 "Cannot be Stunned"
# "{0}% chance to Avoid being Stunned"
description
2 min_damage max_damage
1
# # "Adds {0} to {1} Damage"
`);
  assert.deepEqual(makeMatcher(parsed.descriptions[0].languages.English[0]).matcher, { string: 'Cannot be Stunned', value: 100 });
  assert.equal(makeMatcher(parsed.descriptions[1].languages.English[0]).matcher.string, 'Adds # to # Damage');
});

test('milliseconds handler converts a fixed variant; lookup handlers defer safely', () => {
  const fixed = { template: 'Lasts one second', conditions: [range('1000')], handlers: [{ name: 'milliseconds_to_seconds', args: [1] }] };
  assert.equal(makeMatcher(fixed).matcher.value, 1);
  const lookup = { ...fixed, template: '{0}', handlers: [{ name: 'passive_hash', args: [1] }] };
  assert.deepEqual(makeMatcher(lookup), { unsupported: ['passive_hash'] });
  assert.deepEqual(tokens('"a\\"b\\nc" negate 1'), ['a"b\nc', 'negate', '1']);
  assert.equal(plainText('[Metadata|Displayed] and [Life]'), 'Displayed and Life');
});

test('implicit fmt placeholders and signed implicit formats produce app hashes', () => {
  const variant = { template: 'Adds {} to {:d} Damage and {:+d}% Resistance', conditions: [range('#'), range('#'), range('#')], handlers: [] };
  assert.equal(makeMatcher(variant).matcher.string, 'Adds # to # Damage and #% Resistance');
  assert.equal(makeMatcher(variant, { ref: true }).matcher.string, 'Adds # to # Damage and +#% Resistance');
});

test('malformed description fails rather than losing language alignment', () => {
  assert.throws(() => parseCsd('description\n2 one\n1\n# "bad"'), /stat count/);
  assert.throws(() => parseCsd('description\n2 one two\n1\n# "bad"'), /condition count/);
  assert.throws(() => parseCsd('description\n1 one\n2\n# "bad"'), /EOF/);
});

test('unrelated enum texts become separate refs joined across languages by condition', () => {
  const description = parseCsd(`description
1 mission_id
3
1 "Area contains Einhar"
2 "Area contains Einhar"
3 "Area contains Alva"
lang "Korean"
3
3 "지역에 알바 등장"
1 "지역에 아인하르 등장"
2 "지역에 아인하르 등장"
`).descriptions[0];
  const [einhar, alva] = splitStaticDescription(description);
  assert.equal(einhar.languages.English.length, 2);
  assert.deepEqual(einhar.languages.Korean.map(v => v.template), ['지역에 아인하르 등장', '지역에 아인하르 등장']);
  assert.equal(alva.languages.Korean[0].template, '지역에 알바 등장');
});
