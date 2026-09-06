import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { log } from "./logger";

const isExpoGo = Constants.appOwnership === "expo";

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

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
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
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
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
