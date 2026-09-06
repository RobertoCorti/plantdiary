const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function loadEvents(homeCoords) {
  const inserts = [];
  let weatherCalls = 0;
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync("src/lib/events.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  vm.runInNewContext(js, {
    exports,
    require(name) {
      if (name === "./location") return { getHomeCoords: async () => homeCoords };
      if (name === "./weather") return { fetchWeather: async () => {
        weatherCalls += 1;
        return { temperature: 20, humidity: 60, precipitation: 0 };
      } };
      if (name === "./logger") return { log: { info() {}, warn() {} } };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });

  const db = {
    from(table) {
      return {
        async insert(row) {
          inserts.push({ table, row });
          return { error: null };
        },
      };
    },
  };
  return { ...exports, db, inserts, weatherCalls: () => weatherCalls };
}

test("event saves without weather when no home location exists", async () => {
  const subject = loadEvents(null);
  await subject.logEvent(subject.db, "plant", "user", "observation", "New leaf");
  assert.equal(subject.weatherCalls(), 0);
  assert.equal(subject.inserts[0].row.weather, null);
});

test("event silently attaches weather from the saved home location", async () => {
  const subject = loadEvents({ lat: 52.37, lon: 4.9 });
  await subject.logEvent(subject.db, "plant", "user", "observation", "New leaf");
  assert.equal(subject.weatherCalls(), 1);
  assert.equal(subject.inserts[0].row.weather.temperature, 20);
});
