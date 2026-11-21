const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function loadFeedback() {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync("src/lib/feedback.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  vm.runInNewContext(js, { exports });
  return exports;
}

function createClient(error = null) {
  const inserts = [];
  return {
    inserts,
    client: {
      from(table) {
        return {
          async insert(row) {
            inserts.push({ table, row });
            return { error };
          },
        };
      },
    },
  };
}

test("submits trimmed feedback with app context and no reviewer fields", async () => {
  const feedback = loadFeedback();
  const subject = createClient();

  await feedback.submitFeedback(subject.client, "user-1", {
    category: "idea",
    message: "  Show the first and latest photos together.  ",
    appVersion: " 1.0.0 ",
    platform: "ios",
    platformVersion: " 18.1 ",
  });

  assert.equal(subject.inserts.length, 1);
  assert.equal(subject.inserts[0].table, "feedback_submissions");
  assert.deepEqual({ ...subject.inserts[0].row }, {
    user_id: "user-1",
    category: "idea",
    message: "Show the first and latest photos together.",
    app_version: "1.0.0",
    platform: "ios",
    platform_version: "18.1",
  });
  assert.equal("status" in subject.inserts[0].row, false);
  assert.equal("review_note" in subject.inserts[0].row, false);
});

test("stores empty optional context as null", async () => {
  const feedback = loadFeedback();
  const subject = createClient();

  await feedback.submitFeedback(subject.client, "user-1", {
    category: "bug",
    message: "The save button did not respond.",
    appVersion: " ",
    platform: "android",
    platformVersion: null,
  });

  assert.equal(subject.inserts[0].row.app_version, null);
  assert.equal(subject.inserts[0].row.platform_version, null);
});

test("rejects unsupported categories before contacting Supabase", async () => {
  const feedback = loadFeedback();
  const subject = createClient();

  await assert.rejects(
    feedback.submitFeedback(subject.client, "user-1", {
      category: "question",
      message: "How does this work?",
      appVersion: "1.0.0",
      platform: "ios",
      platformVersion: "18.1",
    }),
    /Choose a feedback category/
  );
  assert.equal(subject.inserts.length, 0);
});

test("rejects blank and oversized messages before contacting Supabase", async () => {
  const feedback = loadFeedback();
  const subject = createClient();
  const base = {
    category: "ux",
    appVersion: "1.0.0",
    platform: "web",
    platformVersion: null,
  };

  await assert.rejects(
    feedback.submitFeedback(subject.client, "user-1", {
      ...base,
      message: "   ",
    }),
    /cannot be empty/
  );
  await assert.rejects(
    feedback.submitFeedback(subject.client, "user-1", {
      ...base,
      message: "x".repeat(feedback.FEEDBACK_MESSAGE_MAX_LENGTH + 1),
    }),
    /characters or fewer/
  );
  assert.equal(subject.inserts.length, 0);
});

test("counts user-visible characters instead of UTF-16 code units", async () => {
  const feedback = loadFeedback();
  const subject = createClient();

  await feedback.submitFeedback(subject.client, "user-1", {
    category: "idea",
    message: "🌱".repeat(feedback.FEEDBACK_MESSAGE_MAX_LENGTH),
    appVersion: null,
    platform: "ios",
    platformVersion: null,
  });

  assert.equal(subject.inserts.length, 1);
});

test("rejects unsupported platforms before contacting Supabase", async () => {
  const feedback = loadFeedback();
  const subject = createClient();

  await assert.rejects(
    feedback.submitFeedback(subject.client, "user-1", {
      category: "idea",
      message: "Desktop feedback.",
      appVersion: "1.0.0",
      platform: "windows",
      platformVersion: "11",
    }),
    /not supported on this platform/
  );
  assert.equal(subject.inserts.length, 0);
});

test("surfaces Supabase insert failures", async () => {
  const feedback = loadFeedback();
  const databaseError = new Error("network unavailable");
  const subject = createClient(databaseError);

  await assert.rejects(
    feedback.submitFeedback(subject.client, "user-1", {
      category: "bug",
      message: "The timeline did not load.",
      appVersion: "1.0.0",
      platform: "android",
      platformVersion: "16",
    }),
    databaseError
  );
  assert.equal(subject.inserts.length, 1);
});
