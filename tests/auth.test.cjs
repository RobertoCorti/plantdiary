const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function loadAuth() {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync("src/lib/auth.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, { exports, URLSearchParams });
  return exports;
}

function client() {
  const calls = [];
  return {
    calls,
    auth: {
      async setSession(tokens) {
        calls.push({ type: "tokens", tokens });
        return { error: null };
      },
      async exchangeCodeForSession(code) {
        calls.push({ type: "code", code });
        return { error: null };
      },
    },
  };
}

test("ignores links that are not PlantDiary auth callbacks", async () => {
  const auth = loadAuth();
  const supabase = client();
  assert.equal(await auth.completeAuthCallback(supabase, "https://example.com"), false);
  assert.equal(supabase.calls.length, 0);
});

test("sets the session from an implicit-flow email callback", async () => {
  const auth = loadAuth();
  const supabase = client();
  const handled = await auth.completeAuthCallback(
    supabase,
    "plantdiary://auth/callback#access_token=access%20token&refresh_token=refresh%20token&type=signup"
  );
  assert.equal(handled, true);
  assert.equal(supabase.calls[0].type, "tokens");
  assert.equal(supabase.calls[0].tokens.access_token, "access token");
  assert.equal(supabase.calls[0].tokens.refresh_token, "refresh token");
});

test("exchanges a PKCE code when the callback contains one", async () => {
  const auth = loadAuth();
  const supabase = client();
  assert.equal(
    await auth.completeAuthCallback(supabase, "plantdiary://auth/callback?code=abc123"),
    true
  );
  assert.equal(supabase.calls[0].type, "code");
  assert.equal(supabase.calls[0].code, "abc123");
});

test("surfaces callback errors and malformed confirmation links", async () => {
  const auth = loadAuth();
  const supabase = client();
  await assert.rejects(
    auth.completeAuthCallback(
      supabase,
      "plantdiary://auth/callback#error_description=Email+link+is+invalid"
    ),
    /Email link is invalid/
  );
  await assert.rejects(
    auth.completeAuthCallback(supabase, "plantdiary://auth/callback"),
    /valid session/
  );
});
