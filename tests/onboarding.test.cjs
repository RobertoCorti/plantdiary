const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function setup({ row = null, readError = null, writeError = null, local = null } = {}) {
  const values = new Map();
  const writes = [];
  if (local) values.set("plantdiary.onboarding.user-1", JSON.stringify(local));

  const storage = {
    async getItemAsync(key) {
      return values.get(key) ?? null;
    },
    async setItemAsync(key, value) {
      values.set(key, value);
    },
  };
  const client = {
    from(table) {
      assert.equal(table, "profiles");
      return {
        select() {
          return {
            eq() {
              return { maybeSingle: async () => ({ data: row, error: readError }) };
            },
          };
        },
        async upsert(value, options) {
          writes.push({ value, options });
          return { error: writeError };
        },
      };
    },
  };

  const exports = {};
  const js = ts.transpileModule(fs.readFileSync("src/lib/onboarding.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, {
    exports,
    Date,
    JSON,
    require(name) {
      if (name === "expo-secure-store") return storage;
      if (name === "./logger") return { log: { warn() {} } };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });

  return { ...exports, client, storage, values, writes };
}

function state(overrides = {}) {
  return {
    step: "welcome",
    completedAt: null,
    plantId: null,
    updatedAt: "2026-09-06T12:00:00.000Z",
    ...overrides,
  };
}

test("a returning account uses the completed server state", async () => {
  const subject = setup({
    row: {
      onboarding_step: "done",
      onboarding_completed_at: "2026-09-06T12:00:00.000Z",
      onboarding_plant_id: null,
      onboarding_updated_at: "2026-09-06T12:00:00.000Z",
    },
  });
  const result = await subject.loadOnboardingState(subject.client, "user-1", subject.storage);
  assert.equal(result.step, "done");
  assert.equal(result.completedAt, "2026-09-06T12:00:00.000Z");
  assert.equal(subject.writes.length, 0);
});

test("offline loading falls back to progress stored on this device", async () => {
  const local = state({ step: "diary", plantId: "plant-1" });
  const subject = setup({ local, readError: new Error("offline") });
  const result = await subject.loadOnboardingState(subject.client, "user-1", subject.storage);
  assert.equal(result.step, "diary");
  assert.equal(result.plantId, "plant-1");
});

test("loading fails safely when neither server nor device state is available", async () => {
  const subject = setup({ readError: new Error("offline") });
  await assert.rejects(
    subject.loadOnboardingState(subject.client, "user-1", subject.storage),
    /offline/
  );
});

test("offline completion is retained locally and syncs on a later load", async () => {
  const offline = setup({ writeError: new Error("offline") });
  const completed = await offline.completeOnboarding(
    offline.client,
    "user-1",
    "plant-1",
    offline.storage
  );
  assert.equal(completed.step, "done");
  assert.ok(completed.completedAt);

  const online = setup({
    local: completed,
    row: {
      onboarding_step: "plant",
      onboarding_completed_at: null,
      onboarding_plant_id: "stale-plant",
      onboarding_updated_at: "2026-09-06T11:00:00.000Z",
    },
  });
  const loaded = await online.loadOnboardingState(online.client, "user-1", online.storage);
  assert.equal(loaded.completedAt, completed.completedAt);
  assert.equal(loaded.plantId, "plant-1");
  assert.equal(online.writes.length, 1);
  assert.equal(online.writes[0].value.onboarding_completed_at, completed.completedAt);
});

test("saving progress records a recovered plant without clearing completion", async () => {
  const completed = state({
    step: "done",
    completedAt: "2026-09-06T12:00:00.000Z",
  });
  const subject = setup({ local: completed });
  const result = await subject.saveOnboardingProgress(
    subject.client,
    "user-1",
    "plant",
    "plant-1",
    subject.storage
  );
  assert.equal(result.step, "done");
  assert.equal(result.completedAt, completed.completedAt);
  assert.equal(result.plantId, "plant-1");
  assert.equal("onboarding_completed_at" in subject.writes[0].value, false);
});
