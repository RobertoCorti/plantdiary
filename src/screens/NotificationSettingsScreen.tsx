import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AppState,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { Session } from "@supabase/supabase-js";
import Svg, { Path } from "react-native-svg";
import type { RootStackParamList } from "../../App";
import { supabase } from "../lib/supabase";
import {
  enablePushNotifications,
  getNotificationSetupStatus,
  type NotificationSetupStatus,
} from "../lib/notifications";
import { colors, fonts, radius, spacing, typography } from "../lib/theme";
import { ScreenHeader } from "./SettingsScreen";

type Props = {
  session: Session;
  navigation: NativeStackNavigationProp<RootStackParamList, "NotificationSettings">;
};

const CONTENT = {
  not_enabled: {
    label: "Not enabled",
    body: "Get timely notes shaped by your plants’ own watering history and the conditions at home.",
    action: "Enable watering reminders",
    note: "PlantDiary asks only after you tap Enable.",
  },
  on: {
    label: "On",
    body: "This device is ready for reminders based on what you log about your plants.",
    action: "Manage in system settings",
    note: "Permission granted · Device registered",
  },
  blocked: {
    label: "Blocked",
    body: "Notifications are blocked for PlantDiary. You can allow them from your device settings.",
    action: "Open system settings",
    note: "Permission denied · Reminders inactive",
  },
  needs_attention: {
    label: "Needs attention",
    body: "Notifications are allowed, but this device could not finish registering for reminders.",
    action: "Retry setup",
    note: "Permission granted · Registration incomplete",
  },
  unavailable: {
    label: "Unavailable",
    body: "Watering reminders are not available in this environment.",
    action: null,
    note: "Try again from a supported app build on your device.",
  },
} as const;

export default function NotificationSettingsScreen({ session, navigation }: Props) {
  const isFocused = useIsFocused();
  const [status, setStatus] = useState<NotificationSetupStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("push_token")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error) {
      setStatus({
        state: "unavailable",
        permission: "unavailable",
        registered: false,
        unavailableReason: "status_error",
      });
      return;
    }

    setStatus(await getNotificationSetupStatus(!!data?.push_token));
  }, [session.user.id]);

  useEffect(() => {
    if (isFocused) loadStatus();
  }, [isFocused, loadStatus]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && isFocused) loadStatus();
    });
    return () => subscription.remove();
  }, [isFocused, loadStatus]);

  async function registerDevice() {
    if (busy) return;
    setBusy(true);
    try {
      const token = await enablePushNotifications();
      if (token) {
        const { error } = await supabase.from("profiles").upsert(
          { id: session.user.id, push_token: token },
          { onConflict: "id" }
        );
        if (error) {
          Alert.alert("Setup incomplete", "Permission was granted, but this device could not be registered. Please try again.");
        }
      }
      await loadStatus();
    } finally {
      setBusy(false);
    }
  }

  async function handleAction() {
    if (!status) return;
    if (status.state === "on" || status.state === "blocked") {
      try {
        await Linking.openSettings();
      } catch {
        Alert.alert("Could not open settings", "Open your device settings and choose PlantDiary > Notifications.");
      }
      return;
    }
    if (status.state === "not_enabled" || status.state === "needs_attention") {
      await registerDevice();
      return;
    }
    if (status.state === "unavailable" && status.unavailableReason === "status_error") {
      await loadStatus();
    }
  }

  const content = status ? CONTENT[status.state] : null;
  const unavailableFromError =
    status?.state === "unavailable" && status.unavailableReason === "status_error";

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Notifications" onBack={() => navigation.goBack()} />
        <Text style={styles.sectionLabel}>Notification permission</Text>
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={styles.bellCircle}>
              <Svg width={23} height={23} viewBox="0 0 24 24" fill="none">
                <Path d="M18 9a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" stroke={colors.fern} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <View style={[styles.pill, status ? pillStyle(status.state) : null]}>
              <Text style={[styles.pillText, status ? pillTextStyle(status.state) : null]}>
                {content?.label ?? "Checking…"}
              </Text>
            </View>
          </View>
          <Text style={styles.title}>Watering reminders</Text>
          <Text style={styles.body}>
            {unavailableFromError
              ? "PlantDiary could not check notification permission and registration."
              : content?.body ?? "Checking notification permission and device registration."}
          </Text>
          {content?.action || unavailableFromError ? (
            <Pressable
              style={[styles.action, busy && styles.actionDisabled]}
              onPress={handleAction}
              disabled={busy}
              accessibilityRole="button"
            >
              <Text style={styles.actionText}>
                {busy ? "Checking…" : unavailableFromError ? "Try again" : content?.action}
              </Text>
            </Pressable>
          ) : null}
          {content?.note ? (
            <Text style={styles.note}>
              {unavailableFromError ? "Check your connection and try again." : content.note}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function pillStyle(state: NotificationSetupStatus["state"]) {
  if (state === "on") return { backgroundColor: colors.thrivingBg };
  if (state === "blocked") return { backgroundColor: colors.waterTodayBg };
  if (state === "needs_attention") return { backgroundColor: colors.checkBg };
  return { backgroundColor: colors.wash };
}

function pillTextStyle(state: NotificationSetupStatus["state"]) {
  if (state === "on") return { color: colors.thrivingText };
  if (state === "blocked") return { color: colors.waterTodayText };
  if (state === "needs_attention") return { color: colors.checkText };
  return { color: colors.bark };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
  sectionLabel: { ...typography.label, color: colors.fern, marginHorizontal: 2, marginBottom: 10 },
  card: { backgroundColor: colors.mist, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  bellCircle: { width: 44, height: 44, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.wash },
  pill: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.wash },
  pillText: { fontFamily: fonts.hankenSemiBold, fontSize: 11, color: colors.bark },
  title: { fontFamily: fonts.spectralSemiBold, fontSize: 22, lineHeight: 28, color: colors.ink, marginTop: spacing.base },
  body: { ...typography.small, color: colors.bark, marginTop: 6 },
  action: { minHeight: 50, borderRadius: radius.md, backgroundColor: colors.forest, alignItems: "center", justifyContent: "center", marginTop: spacing.lg, paddingHorizontal: spacing.base },
  actionDisabled: { opacity: 0.6 },
  actionText: { fontFamily: fonts.hankenSemiBold, fontSize: 14, color: "#F1EFE4", textAlign: "center" },
  note: { fontFamily: fonts.hankenRegular, fontSize: 11, lineHeight: 15, color: colors.muted, textAlign: "center", marginTop: 11 },
});
