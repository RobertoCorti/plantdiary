const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function loadNotifications(existingStatus) {
  const calls = [];
  const notifications = {
    AndroidImportance: { MAX: 5 },
    getPermissionsAsync: async () => ({ status: existingStatus }),
    requestPermissionsAsync: async () => {
      calls.push("request");
      return { status: "granted" };
    },
    setNotificationChannelAsync: async () => calls.push("channel"),
    setNotificationHandler: () => calls.push("handler"),
    getExpoPushTokenAsync: async () => {
      calls.push("token");
      return { data: "ExponentPushToken[test]" };
    },
  };
  const exports = {};
  const js = ts.transpileModule(
    fs.readFileSync("src/lib/notifications.ts", "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  ).outputText;

  vm.runInNewContext(js, {
    exports,
    require(name) {
      if (name === "react-native") return { Platform: { OS: "android" } };
      if (name === "expo-device") return { isDevice: true };
      if (name === "expo-constants") {
        return { __esModule: true, default: { appOwnership: "standalone", expoConfig: { extra: { eas: { projectId: "project" } } } } };
      }
      if (name === "./logger") return { log: { info() {}, warn() {}, error() {} } };
      if (name === "expo-notifications") return notifications;
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });

  return { ...exports, calls };
}

test("silent push sync never requests permission", async () => {
  const subject = loadNotifications("undetermined");
  assert.equal(await subject.syncPushTokenIfAuthorized(), null);
  assert.deepEqual(subject.calls, []);
});

test("silent push sync refreshes a token when already authorized", async () => {
  const subject = loadNotifications("granted");
  assert.equal(await subject.syncPushTokenIfAuthorized(), "ExponentPushToken[test]");
  assert.equal(subject.calls.includes("request"), false);
  assert.equal(subject.calls.includes("token"), true);
});

test("explicit reminder enablement may request permission", async () => {
  const subject = loadNotifications("undetermined");
  assert.equal(await subject.enablePushNotifications(), "ExponentPushToken[test]");
  assert.equal(subject.calls.includes("request"), true);
});
