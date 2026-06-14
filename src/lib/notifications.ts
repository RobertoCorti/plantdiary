import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { log } from "./logger";

const isExpoGo = Constants.appOwnership === "expo";

/**
 * Request notification permissions and return the Expo push token.
 * Returns null if permissions denied, on a simulator, or in Expo Go
 * (which dropped remote push support in SDK 53 — use a dev build).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (isExpoGo) {
      log.warn("push", "Skipped: Expo Go does not support remote push since SDK 53. Use a dev build.");
      return null;
    }

    if (!Device.isDevice) {
      log.warn("push", "Skipped: physical device required");
      return null;
    }

    log.info("push", "Registering for push notifications…");

    const Notifications = require("expo-notifications");

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

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      log.warn("push", "Permission denied by user");
      return null;
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
