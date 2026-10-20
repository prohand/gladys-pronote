// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code registers, nor which keys the code fires — these
// tests keep both sides in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_CONFIG } from '../src/config.js';
import { ACTION_KEYS } from '../src/actions.js';
import { SCENE_ACTIONS, SCENE_TRIGGERS } from '../src/capabilities/scenes.js';
import { STUDENT_LISTS, WIDGET_KEYS } from '../src/capabilities/widgets.js';
import { EVENT_DATA, KINDS } from '../src/pronote/events.js';
import { DAYS } from '../src/pronote/derive.js';
import { LANGUAGES } from '../src/i18n.js';

const read = async (path) => readFile(new URL(path, import.meta.url), 'utf8');
const manifest = JSON.parse(await read('../gladys-assistant-integration.json'));
const pkg = JSON.parse(await read('../package.json'));
const indexSource = await read('../index.js');

test('version, image and package agree (the Release workflow writes all three)', () => {
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.docker_image, `ghcr.io/prohand/gladys-pronote:${pkg.version}`);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/prohand/gladys-pronote/main/cover.png',
  );
});

test('the manifest declares the cloud transport only', () => {
  // PRONOTE is a server on the internet (Index Éducation or the school's
  // host): there is no local channel to prefer.
  assert.deepEqual(manifest.transports, ['cloud']);
});

test('every manifest action is registered in index.js and handled', () => {
  assert.deepEqual(
    manifest.actions.map((action) => action.key).sort(),
    Object.values(ACTION_KEYS).sort(),
  );
  for (const action of manifest.actions) {
    assert.match(indexSource, new RegExp(`onAction\\('${action.key}'`), action.key);
  }
});

test('every scene action is registered in index.js and handled', () => {
  assert.deepEqual(
    manifest.scene_actions.map((action) => action.key).sort(),
    Object.values(SCENE_ACTIONS).sort(),
  );
  for (const key of Object.values(SCENE_ACTIONS)) {
    assert.match(indexSource, new RegExp(`onSceneAction\\('${key}'`), key);
  }
});

test('the scene triggers the code fires are the ones the manifest declares', () => {
  assert.deepEqual(Object.keys(SCENE_TRIGGERS).sort(), Object.keys(KINDS).sort());
  assert.deepEqual(
    manifest.scene_triggers.map((trigger) => trigger.key).sort(),
    Object.values(SCENE_TRIGGERS).sort(),
  );
});

test('every key of an event is a declared field or variable', () => {
  // The core drops what is not declared: a key the code sends and the manifest
  // forgot is a variable nobody can use.
  const samples = {
    grades: {
      subject: 's',
      value: 1,
      out_of: 20,
      value_20: 1,
      label: '1/20',
      coefficient: 1,
      class_average: 1,
      comment: '',
      date: new Date().toISOString(),
    },
    homework: { subject: 's', description: 'd', due: new Date().toISOString() },
    cancellations: {
      subject: 's',
      start: new Date().toISOString(),
      end: new Date().toISOString(),
      status: '',
    },
    absences: { type: 'absence', start: new Date().toISOString(), justified: true, reason: '' },
    observations: {
      kind: 'observation',
      title: 't',
      subject: 's',
      comment: '',
      date: new Date().toISOString(),
    },
  };
  for (const [kind, key] of Object.entries(SCENE_TRIGGERS)) {
    const trigger = manifest.scene_triggers.find((entry) => entry.key === key);
    const declared = [
      ...trigger.fields.map((field) => field.key),
      ...trigger.variables.map((variable) => variable.key),
    ];
    const sent = ['device', 'student_name', ...Object.keys(EVENT_DATA[kind](samples[kind]))];
    assert.deepEqual([...new Set(sent)].sort(), [...new Set(declared)].sort(), key);
    assert.ok(sent.length <= 30, `${key}: at most 30 keys`);
  }
});

test('the day choices are the ones the code knows', () => {
  const options = (fields) =>
    fields.find((field) => field.key === 'day').options.map((option) => option.value);
  const summary = manifest.scene_actions.find((action) => action.key === 'day_summary');
  assert.deepEqual(options(summary.fields).sort(), Object.values(DAYS).sort());
  const timetable = manifest.widgets.find((widget) => widget.key === WIDGET_KEYS.TIMETABLE);
  assert.deepEqual(options(timetable.settings).sort(), Object.values(DAYS).sort());
});

test('the list choices of the student widget are the ones the code knows', () => {
  const student = manifest.widgets.find((widget) => widget.key === WIDGET_KEYS.STUDENT);
  const list = student.settings.find((setting) => setting.key === 'list');
  assert.deepEqual(
    list.options.map((option) => option.value).sort(),
    Object.values(STUDENT_LISTS).sort(),
  );
  assert.equal(list.default, STUDENT_LISTS.HOMEWORK);
});

test('every widget is registered and handled', () => {
  assert.deepEqual(
    manifest.widgets.map((widget) => widget.key).sort(),
    Object.values(WIDGET_KEYS).sort(),
  );
  assert.match(indexSource, /onWidgetGet\(key/);
  assert.match(indexSource, /onWidgetAction\(key/);
  assert.ok(manifest.widgets.length <= 5);
});

// The store schema is the admission authority: a field type outside this list,
// or a placeholder that is not a multi-language object, gets the integration
// rejected by the indexer.
const FIELD_TYPES = ['string', 'number', 'boolean', 'select', 'multi_select', 'secret', 'section'];

const allFields = () => [
  ...manifest.config_schema,
  ...manifest.actions.flatMap((action) => action.fields ?? []),
  ...manifest.widgets.flatMap((widget) => widget.settings ?? []),
  ...manifest.scene_triggers.flatMap((trigger) => trigger.fields ?? []),
  ...manifest.scene_actions.flatMap((action) => action.fields ?? []),
];

test('every field uses a type the store accepts', () => {
  for (const field of allFields()) {
    assert.ok(FIELD_TYPES.includes(field.type), `field "${field.key}": type "${field.type}"`);
    assert.match(field.key, /^[a-z0-9_]+$/, `field key "${field.key}" must be snake_case`);
    if (field.placeholder !== undefined) {
      assert.equal(typeof field.placeholder, 'object', `field "${field.key}": placeholder object`);
      assert.ok(['string', 'number', 'secret'].includes(field.type), field.key);
    }
    if (field.min !== undefined || field.max !== undefined) {
      assert.equal(field.type, 'number', `field "${field.key}": min/max are number-only`);
    }
    if (field.source !== undefined) {
      assert.equal(field.source, 'devices');
      assert.equal(field.options, undefined, `field "${field.key}": source and options`);
    }
  }
});

test('config_schema defaults stay consistent with DEFAULT_CONFIG', () => {
  for (const field of manifest.config_schema) {
    if (field.type === 'section') {
      assert.ok(!(field.key in DEFAULT_CONFIG), `section "${field.key}" stores no value`);
      assert.equal(field.default, undefined);
      assert.equal(field.required, undefined);
      for (const link of field.links ?? []) {
        assert.match(link.url, /^https:\/\//);
      }
      continue;
    }
    assert.ok(field.key in DEFAULT_CONFIG, `config key "${field.key}" missing in DEFAULT_CONFIG`);
    if (field.default !== undefined) {
      assert.equal(DEFAULT_CONFIG[field.key], field.default, field.key);
    }
  }
});

test('the password is a secret field', () => {
  assert.equal(manifest.config_schema.find((field) => field.key === 'password').type, 'secret');
});

const CATEGORIES = [
  'climate',
  'lighting',
  'energy',
  'security',
  'multimedia',
  'appliances',
  'environment',
  'protocols',
  'network',
  'notifications',
  'assistants',
  'services',
];

test('the categories stay inside the vocabulary the store indexes', () => {
  assert.ok(manifest.categories.length >= 1 && manifest.categories.length <= 3);
  for (const category of manifest.categories) {
    assert.ok(CATEGORIES.includes(category), category);
  }
});

test('the Gladys floor covers the scene and widget declarations', () => {
  const [major, minor] = manifest.gladys_version.replace(/^>=/, '').split('.').map(Number);
  assert.ok(major > 5 || (major === 5 && minor >= 1), manifest.gladys_version);
});

/** Every multi-language object of the manifest, with where it sits. */
function multiLanguageTexts(node, path = 'manifest') {
  if (Array.isArray(node)) {
    return node.flatMap((child, index) => multiLanguageTexts(child, `${path}[${index}]`));
  }
  if (node === null || typeof node !== 'object') {
    return [];
  }
  const keys = Object.keys(node);
  if (keys.includes('en') && keys.every((key) => /^[a-z]{2}$/.test(key))) {
    return [{ path, text: node }];
  }
  return keys.flatMap((key) => multiLanguageTexts(node[key], `${path}.${key}`));
}

test('every multi-language text of the manifest carries en, fr, de and es', () => {
  const texts = multiLanguageTexts(manifest);
  assert.ok(texts.length > 100, `only ${texts.length} texts found`);
  for (const { path, text } of texts) {
    assert.deepEqual(Object.keys(text).sort(), [...LANGUAGES].sort(), `${path}: languages`);
    for (const language of LANGUAGES) {
      assert.ok(text[language].trim().length > 0, `${path}.${language} is empty`);
    }
  }
});

test('the per-language length limits of the store hold in every language', () => {
  const within = (text, min, max, where) => {
    for (const language of LANGUAGES) {
      const { length } = text[language];
      assert.ok(length >= min && length <= max, `${where}.${language}: ${length} characters`);
    }
  };
  assert.ok(manifest.name.length >= 3 && manifest.name.length <= 30);
  within(manifest.description, 10, 100, 'description');
  for (const widget of manifest.widgets) {
    within(widget.label, 3, 30, `widget ${widget.key} label`);
    within(widget.description, 1, 100, `widget ${widget.key} description`);
  }
  for (const field of allFields().filter((entry) => entry.type === 'section')) {
    within(field.description, 1, 1000, `section ${field.key} description`);
  }
});
