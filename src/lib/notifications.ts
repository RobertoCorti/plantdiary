import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { log } from "./logger";

const isExpoGo = Constants.appOwnership === "expo";

export type NotificationSetupState =
  | "not_enabled"
  | "on"
  | "blocked"
  | "needs_attention"
  | "unavailable";

export type NotificationSetupStatus = {
  state: NotificationSetupState;
  permission: "undetermined" | "granted" | "denied" | "unavailable";
  registered: boolean;
  unavailableReason?: "expo_go" | "physical_device_required" | "status_error";
};

type PermissionStatus = {
  status: string;
  ios?: { status: number };
};

type NotificationsModule = {
  IosAuthorizationStatus?: {
    NOT_DETERMINED: number;
    DENIED: number;
    AUTHORIZED: number;
    PROVISIONAL: number;
    EPHEMERAL: number;
  };
  getPermissionsAsync(): Promise<PermissionStatus>;
};

function permissionState(
  Notifications: NotificationsModule,
  status: PermissionStatus
): "undetermined" | "granted" | "denied" {
  const iosStatus = status.ios?.status;
  const iosAuthorization = Notifications.IosAuthorizationStatus;

  if (Platform.OS === "ios" && iosStatus !== undefined && iosAuthorization) {
    if (iosStatus === iosAuthorization.NOT_DETERMINED) return "undetermined";
    if (iosStatus === iosAuthorization.DENIED) return "denied";
    return "granted";
  }

  if (status.status === "granted") return "granted";
  if (status.status === "denied") return "denied";
  return "undetermined";
}

/** Read the current reminder setup without ever opening a system prompt. */
export async function getNotificationSetupStatus(
  registered: boolean
): Promise<NotificationSetupStatus> {
  if (isExpoGo) {
    return {
      state: "unavailable",
      permission: "unavailable",
      registered,
      unavailableReason: "expo_go",
    };
  }

  if (!Device.isDevice) {
    return {
      state: "unavailable",
      permission: "unavailable",
      registered,
      unavailableReason: "physical_device_required",
    };
  }

  try {
    const Notifications = require("expo-notifications") as NotificationsModule;
    const permission = permissionState(
      Notifications,
      await Notifications.getPermissionsAsync()
    );

    if (permission === "undetermined") {
      return { state: "not_enabled", permission, registered };
    }
    if (permission === "denied") {
      return { state: "blocked", permission, registered };
    }
    return {
      state: registered ? "on" : "needs_attention",
      permission,
      registered,
    };
  } catch (error) {
    log.error("push", "Could not read notification status", error);
    return {
      state: "unavailable",
      permission: "unavailable",
      registered,
      unavailableReason: "status_error",
    };
  }
}

async function getPushToken(requestPermission: boolean): Promise<string | null> {
  try {
    if (isExpoGo) {
      log.warn("push", "Skipped: Expo Go does not support remote push since SDK 53. Use a dev build.");
      return null;
    }

    if (!Device.isDevice) {
      log.warn("push", "Skipped: physical device required");
      return null;
    }

    const Notifications = require("expo-notifications");

    const existingPermission = await Notifications.getPermissionsAsync();
    let finalPermission = permissionState(Notifications, existingPermission);

    if (finalPermission !== "granted") {
      if (!requestPermission) {
        log.info("push", "Permission not granted; waiting for user action");
        return null;
      }
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Default",
          importance: Notifications.AndroidImportance.MAX,
        });
      }
      const requestedPermission = await Notifications.requestPermissionsAsync();
      finalPermission = permissionState(Notifications, requestedPermission);
    }

    if (finalPermission !== "granted") {
      log.warn("push", "Permission denied by user");
      return null;
    }

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      log.warn("push", "No EAS projectId — run 'eas init'");
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    log.info("push", "Got Expo push token", tokenData.data);
    return tokenData.data;
  } catch (err) {
    log.error("push", "Registration failed", err);
    return null;
  }
}

/** Refresh an existing authorization without ever opening a system prompt. */
export function syncPushTokenIfAuthorized(): Promise<string | null> {
  return getPushToken(false);
}

/** Request authorization after the user explicitly enables reminders. */
export function enablePushNotifications(): Promise<string | null> {
  return getPushToken(true);
}
