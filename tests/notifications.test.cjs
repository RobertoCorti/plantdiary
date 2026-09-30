const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadNotifications({
  existingStatus = "undetermined",
  requestedStatus = "granted",
  platform = "android",
  isDevice = true,
  appOwnership = "standalone",
  iosStatus,
} = {}) {
  const calls = [];
  const notifications = {
    AndroidImportance: { MAX: 5 },
    IosAuthorizationStatus: {
      NOT_DETERMINED: 0,
      DENIED: 1,
      AUTHORIZED: 2,
      PROVISIONAL: 3,
      EPHEMERAL: 4,
    },
    getPermissionsAsync: async () => {
      calls.push("read");
      return {
        status: existingStatus,
        ...(iosStatus === undefined ? {} : { ios: { status: iosStatus } }),
      };
    },
    requestPermissionsAsync: async () => {
      calls.push("request");
      return { status: requestedStatus };
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
      if (name === "react-native") return { Platform: { OS: platform } };
      if (name === "expo-device") return { isDevice };
      if (name === "expo-constants") {
        return { __esModule: true, default: { appOwnership, expoConfig: { extra: { eas: { projectId: "project" } } } } };
      }
      if (name === "./logger") return { log: { info() {}, warn() {}, error() {} } };
      if (name === "expo-notifications") return notifications;
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });

  return { ...exports, calls };
}

test("silent push sync never requests permission", async () => {
  const subject = loadNotifications({ existingStatus: "undetermined" });
  assert.equal(await subject.syncPushTokenIfAuthorized(), null);
  assert.deepEqual(subject.calls, ["read"]);
  assert.equal(subject.calls.includes("request"), false);
});

test("silent push sync refreshes a token when already authorized", async () => {
  const subject = loadNotifications({ existingStatus: "granted" });
  assert.equal(await subject.syncPushTokenIfAuthorized(), "ExponentPushToken[test]");
  assert.equal(subject.calls.includes("request"), false);
  assert.equal(subject.calls.includes("token"), true);
});

test("explicit reminder enablement may request permission", async () => {
  const subject = loadNotifications({ existingStatus: "undetermined" });
  assert.equal(await subject.enablePushNotifications(), "ExponentPushToken[test]");
  assert.equal(subject.calls.includes("request"), true);
});

test("status inspection reports not enabled without requesting permission", async () => {
  const subject = loadNotifications({ existingStatus: "undetermined" });
  assert.deepEqual(
    plain(await subject.getNotificationSetupStatus(false)),
    { state: "not_enabled", permission: "undetermined", registered: false }
  );
  assert.equal(subject.calls.includes("request"), false);
});

test("status inspection reports blocked when permission is denied", async () => {
  const subject = loadNotifications({ existingStatus: "denied" });
  assert.deepEqual(
    plain(await subject.getNotificationSetupStatus(true)),
    { state: "blocked", permission: "denied", registered: true }
  );
});

test("status inspection reports on when permission and registration exist", async () => {
  const subject = loadNotifications({ existingStatus: "granted" });
  assert.deepEqual(
    plain(await subject.getNotificationSetupStatus(true)),
    { state: "on", permission: "granted", registered: true }
  );
});

test("status inspection reports attention when permission exists without registration", async () => {
  const subject = loadNotifications({ existingStatus: "granted" });
  assert.deepEqual(
    plain(await subject.getNotificationSetupStatus(false)),
    { state: "needs_attention", permission: "granted", registered: false }
  );
});

test("status inspection reports unavailable without loading native notifications", async () => {
  const subject = loadNotifications({ appOwnership: "expo" });
  assert.deepEqual(
    plain(await subject.getNotificationSetupStatus(false)),
    {
      state: "unavailable",
      permission: "unavailable",
      registered: false,
      unavailableReason: "expo_go",
    }
  );
  assert.deepEqual(subject.calls, []);
});

test("iOS uses granular authorization status", async () => {
  const subject = loadNotifications({
    platform: "ios",
    existingStatus: "denied",
    iosStatus: 3,
  });
  assert.deepEqual(
    plain(await subject.getNotificationSetupStatus(true)),
    { state: "on", permission: "granted", registered: true }
  );
});
