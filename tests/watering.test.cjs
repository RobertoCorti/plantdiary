const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Load only each production status function; never start the reminder server.
function loadStatus(path) {
  const source = ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'getWateringStatus');
  const js = ts.transpileModule(declaration.getText(source).replace(/^export /, ''), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const now = new Date(2026, 8, 6, 12).getTime();
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
  }
  return vm.runInNewContext(js + '\ngetWateringStatus;', { Date: FixedDate });
}

for (const path of ['src/lib/watering.ts', 'supabase/functions/send-watering-reminders/index.ts']) {
  const status = loadStatus(path);
  test(`${path}: unknown dates or schedules never imply watering/check reminders`, () => {
    for (const watering_frequency_days of [null, 7]) {
      assert.equal(status({ watering_frequency_days, last_watered_at: null }), 'unknown');
    }
    assert.equal(status({ watering_frequency_days: null, last_watered_at: new Date(2026, 8, 1, 12).toISOString() }), 'unknown');
  });
  test(`${path}: known schedules retain overdue, due, tomorrow, and later behavior`, () => {
    for (const [day, expected] of [[29, 'water_today'], [30, 'water_today'], [31, 'check']]) {
      assert.equal(status({ watering_frequency_days: 7, last_watered_at: new Date(2026, 7, day, 12).toISOString() }), expected);
    }
    assert.equal(status({ watering_frequency_days: 7, last_watered_at: new Date(2026, 8, 6, 12).toISOString() }), 'ok');
  });
}
