import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

// Show notifications when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions and return the Expo push token.
 * Returns null if permissions denied or running on a simulator without support.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Push tokens only work on physical devices (and Android emulators with Play Services)
    if (!Device.isDevice) {
      console.log("Push notifications require a physical device");
      return null;
    }

    // Android 13+ requires a notification channel before requesting permissions
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
