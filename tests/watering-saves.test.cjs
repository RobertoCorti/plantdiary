const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { randomUUID } = require("node:crypto");
const ts = require("typescript");

function setup({ storage = new Map(), platform = "ios", coords = { lat: 1, lon: 2 },
  locationFails = false, weatherFails = false, storageFails = false, cleanupFails = false,
  rpc = async (_name, args) => ({ data: args.p_watered_at, error: null }) } = {}) {
  let weatherCalls = 0;
  const calls = [];
  const writes = [];
  const exports = {};
  const get = (key) => storage.get(key) ?? null;
  const put = (key, value) => {
    if (storageFails) throw new Error("Storage unavailable");
    storage.set(key, value);
  };
  const remove = (key) => {
    if (cleanupFails) throw new Error("Cleanup unavailable");
    storage.delete(key);
  };
  const js = ts.transpileModule(fs.readFileSync("src/lib/events.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, { exports, localStorage: { getItem: get, setItem: put, removeItem: remove },
    require(name) {
      if (name === "expo-secure-store") return {
        getItemAsync: async (key) => get(key),
        setItemAsync: async (key, value) => put(key, value),
        deleteItemAsync: async (key) => remove(key),
      };
      if (name === "expo-crypto") return { randomUUID };
      if (name === "react-native") return { Platform: { OS: platform } };
      if (name === "./location") return { getHomeCoords: async () => {
        if (locationFails) throw new Error("Location unavailable");
        return coords;
      } };
      if (name === "./weather") return { fetchWeather: async () => {
        weatherCalls++;
        if (weatherFails) throw new Error("Weather unavailable");
        return { temperature: 20, humidity: 60, precipitation: 0 };
      } };
      if (name === "./logger") return { log: { info() {}, warn() {} } };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  const db = {
    async rpc(name, args) {
      calls.push({ name, args });
      assert.ok(storage.size, "action must be durable before submission");
      return rpc(name, args);
    },
    from(table) { return { async insert(row) { writes.push({ table, row }); return { error: null }; } }; },
  };
  return { ...exports, db, calls, storage, writes, weatherCalls: () => weatherCalls };
}

test("watering uses one RPC with the original date, notes, weather, and a unique ID", async () => {
  const s = setup();
  const result = await s.logWatering(s.db, "plant", "user", "  Soil was dry  ");
  assert.equal(s.calls.length, 1);
  const { name, args } = s.calls[0];
  assert.equal(name, "record_watering");
  assert.match(args.p_event_id, /^[0-9a-f-]{36}$/);
  assert.equal(args.p_plant_id, "plant");
  assert.equal(args.p_notes, "Soil was dry");
  assert.equal(args.p_weather.temperature, 20);
  assert.equal(result.lastWateredAt, args.p_watered_at);
  assert.equal(result.wateredAt, args.p_watered_at);
  assert.equal(result.wasRetry, false);
  assert.equal(s.storage.size, 0);
  assert.equal(s.writes.length, 0);
});

test("lost response retries the identical payload without capturing new weather", async () => {
  let attempts = 0;
  const s = setup({ rpc: async (_name, args) => {
    if (++attempts === 1) throw new Error("Response lost after commit");
    return { data: args.p_watered_at, error: null };
  } });
  await assert.rejects(s.logWatering(s.db, "plant", "user", "Dry"), /Response lost/);
  assert.equal(s.storage.size, 1);
  const result = await s.logWatering(s.db, "plant", "user", "Dry");
  assert.equal(JSON.stringify(s.calls[1].args), JSON.stringify(s.calls[0].args));
  assert.equal(result.wasRetry, true);
  assert.equal(s.weatherCalls(), 1);
  assert.equal(s.storage.size, 0);
});

test("pending watering survives a module restart and can be retried from another entry point", async () => {
  const first = setup({ rpc: async () => ({ data: null, error: { message: "Offline" } }) });
  await assert.rejects(first.logWatering(first.db, "plant", "user", "Dry"));
  const restarted = setup({ storage: first.storage });
  const result = await restarted.logWatering(restarted.db, "plant", "user");
  assert.equal(JSON.stringify(restarted.calls[0].args), JSON.stringify(first.calls[0].args));
  assert.equal(restarted.weatherCalls(), 0);
  assert.equal(result.wasRetry, true);
});

test("an in-flight double tap shares the same request", async () => {
  const s = setup();
  const first = s.logWatering(s.db, "plant", "user");
  const second = s.logWatering(s.db, "plant", "user");
  assert.equal(first, second);
  await Promise.all([first, second]);
  assert.equal(s.calls.length, 1);
});

test("a confirmed subsequent watering gets a new ID", async () => {
  const s = setup();
  await s.logWatering(s.db, "plant", "user");
  await s.logWatering(s.db, "plant", "user");
  assert.notEqual(s.calls[0].args.p_event_id, s.calls[1].args.p_event_id);
});

test("another screen cannot attach different notes to an in-flight action", async () => {
  const s = setup();
  const first = s.logWatering(s.db, "plant", "user", "Original");
  await assert.rejects(s.logWatering(s.db, "plant", "user", "Different"), /earlier watering/);
  await first;
  assert.equal(s.calls.length, 1);
  assert.equal(s.calls[0].args.p_notes, "Original");
});

test("pending actions are isolated by account and plant", async () => {
  const s = setup({ rpc: async () => ({ data: null, error: { message: "Offline" } }) });
  await Promise.allSettled([
    s.logWatering(s.db, "plant", "user-a"),
    s.logWatering(s.db, "plant", "user-b"),
    s.logWatering(s.db, "other-plant", "user-a"),
  ]);
  assert.equal(s.calls.length, 3);
  assert.equal(s.storage.size, 3);
  assert.equal(new Set(s.calls.map((c) => c.args.p_event_id)).size, 3);
});

test("batch failures retain only failed actions for safe individual retries", async () => {
  const s = setup({ rpc: async (_name, args) => args.p_plant_id === "failed"
    ? { data: null, error: { message: "Offline" } }
    : { data: args.p_watered_at, error: null } });
  const results = await Promise.allSettled([
    s.logWatering(s.db, "saved", "user"), s.logWatering(s.db, "failed", "user"),
  ]);
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.equal(s.storage.size, 1);
  assert.ok(s.storage.has("plantdiary.watering.user.failed"));
});

test("watering from logEvent uses the same RPC and retains its notes", async () => {
  const s = setup();
  await s.logEvent(s.db, "plant", "user", "watered", "Dry");
  assert.equal(s.calls[0].args.p_notes, "Dry");
  assert.equal(s.writes.length, 0);
});

test("missing location or failed context capture still submits watering with null weather", async () => {
  for (const options of [{ coords: null }, { locationFails: true }, { weatherFails: true }]) {
    const s = setup(options);
    await s.logWatering(s.db, "plant", "user");
    assert.equal(s.calls[0].args.p_weather, null);
  }
});

test("failure to persist the retry ID prevents submission", async () => {
  const s = setup({ storageFails: true });
  await assert.rejects(s.logWatering(s.db, "plant", "user"), /Storage unavailable/);
  assert.equal(s.calls.length, 0);
});

test("a failed local cleanup can retry the confirmed server action safely", async () => {
  const s = setup({ cleanupFails: true });
  await assert.rejects(s.logWatering(s.db, "plant", "user"), /Cleanup unavailable/);
  const retry = setup({ storage: s.storage });
  await retry.logWatering(retry.db, "plant", "user");
  assert.equal(retry.calls[0].args.p_event_id, s.calls[0].args.p_event_id);
});

test("malformed success does not discard the pending action", async () => {
  const s = setup({ rpc: async () => ({ data: null, error: null }) });
  await assert.rejects(s.logWatering(s.db, "plant", "user"), /Could not confirm/);
  assert.equal(s.storage.size, 1);
});

test("different notes cannot silently replace an unresolved watering", async () => {
  const s = setup({ rpc: async () => ({ data: null, error: { message: "Offline" } }) });
  await assert.rejects(s.logWatering(s.db, "plant", "user", "Original"));
  await assert.rejects(s.logWatering(s.db, "plant", "user", "Different"), /earlier watering/);
  assert.equal(s.calls.length, 1);
});

test("web retains the same retry behavior using localStorage", async () => {
  const first = setup({ platform: "web", rpc: async () => { throw new Error("Offline"); } });
  await assert.rejects(first.logWatering(first.db, "plant", "user"));
  const retry = setup({ platform: "web", storage: first.storage });
  await retry.logWatering(retry.db, "plant", "user");
  assert.equal(retry.calls[0].args.p_event_id, first.calls[0].args.p_event_id);
  assert.equal(retry.storage.size, 0);
});
