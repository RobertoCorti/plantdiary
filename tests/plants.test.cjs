const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the actual TypeScript helper without loading React Native in Node.
function setup({ coords = null, weatherFails = false, insertError = null, eventError = null } = {}) {
  const writes = [];
  const stored = new Map();
  const weather = { temperature: 20, humidity: 60, precipitation: 0 };
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync('src/lib/plants.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, { exports, require(name) {
    if (name === './logger') return { log: { warn() {} } };
    if (name === './location') return { getHomeCoords: async () => coords };
    if (name === './weather') return { fetchWeather: async () => {
      if (weatherFails) throw new Error('offline');
      return weather;
    } };
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  const db = { from(table) { return {
    insert(row) {
      writes.push({ table, row });
      return { select() { return { single: async () => ({
        data: { id: 'plant-1', created_at: '2026-09-06T12:00:00Z', ...row }, error: insertError,
      }) }; } };
    },
    async upsert(row, options) {
      writes.push({ table, row, options });
      if (!eventError && (!stored.has(row.id) || !options.ignoreDuplicates)) stored.set(row.id, row);
      return { error: eventError };
    },
  }; } };
  return { ...exports, db, writes, stored, weather };
}

test('name-only plant trims the name and leaves unknown care information null', async () => {
  const s = setup();
  const plant = await s.createPlant(s.db, { user_id: 'user-1', name: '  Giorgio  ' });
  assert.equal(plant.name, 'Giorgio');
  for (const field of ['species', 'location', 'photo_url', 'watering_frequency_days']) assert.equal(plant[field], null);
  await s.saveInitialPlantPhoto(s.db, plant, null);
  assert.equal(s.writes.length, 1);
});

test('blank names and failed plant inserts propagate errors', async () => {
  const s = setup({ insertError: new Error('insert failed') });
  await assert.rejects(s.createPlant(s.db, { user_id: 'u', name: '  ' }), /name/);
  assert.equal(s.writes.length, 0);
  await assert.rejects(s.createPlant(s.db, { user_id: 'u', name: 'G' }), /insert failed/);
});

test('manual species does not invent a schedule', async () => {
  const s = setup();
  const plant = await s.createPlant(s.db, { user_id: 'u', name: 'G', species: ' Pothos ' });
  assert.equal(plant.species, 'Pothos');
  assert.equal(plant.watering_frequency_days, null);
});

test('first photo persists analysis and home weather, and retry does not duplicate it', async () => {
  const s = setup({ coords: { lat: 1, lon: 2 } });
  const plant = await s.createPlant(s.db, { user_id: 'u', name: 'G', photo_url: 'photo.jpg', watering_frequency_days: 7 });
  await s.saveInitialPlantPhoto(s.db, plant, '{"species":"Pothos"}');
  await s.saveInitialPlantPhoto(s.db, plant, '{"species":"Pothos"}');
  assert.equal(s.stored.size, 1);
  const event = s.stored.get(plant.id);
  assert.equal(event.event_type, 'photo');
  assert.equal(event.created_at, plant.created_at);
  assert.equal(event.ai_analysis, '{"species":"Pothos"}');
  assert.equal(event.weather, s.weather);
  assert.equal(plant.watering_frequency_days, 7);
});

test('missing home location or weather failure still saves the photo without weather', async () => {
  for (const options of [{}, { coords: { lat: 1, lon: 2 }, weatherFails: true }]) {
    const s = setup(options);
    const plant = await s.createPlant(s.db, { user_id: 'u', name: 'G', photo_url: 'photo.jpg' });
    await s.saveInitialPlantPhoto(s.db, plant, null);
    assert.equal(s.stored.get(plant.id).weather, null);
  }
});

test('photo-event failure is surfaced so the form can offer retry', async () => {
  const s = setup({ eventError: new Error('event failed') });
  const plant = await s.createPlant(s.db, { user_id: 'u', name: 'G', photo_url: 'photo.jpg' });
  await assert.rejects(s.saveInitialPlantPhoto(s.db, plant, null), /event failed/);
});
