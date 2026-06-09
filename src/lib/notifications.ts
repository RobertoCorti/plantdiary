import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";

const isExpoGo = Constants.appOwnership === "expo";

/**
 * Request notification permissions and return the Expo push token.
 * Returns null if permissions denied, on a simulator, or in Expo Go
 * (which dropped remote push support in SDK 53 — use a dev build).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (isExpoGo) {
      console.log(
        "Push notifications skipped: Expo Go does not support remote push since SDK 53. Use a development build to test."
      );
      return null;
    }

    if (!Device.isDevice) {
      console.log("Push notifications require a physical device");
      return null;
    }

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
      console.log("Notification permission denied");
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn(
        "No EAS projectId found. Run 'eas init' to configure your project for push notifications."
      );
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    return tokenData.data;
  } catch (err) {
    console.error("Failed to register for push notifications:", err);
    return null;
  }
}
