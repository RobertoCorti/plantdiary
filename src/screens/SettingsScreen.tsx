import { useCallback, useEffect, useState } from "react";
import {
  Alert,
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
import { Host, Icon } from "@expo/ui";
import Constants from "expo-constants";
import Svg, { Circle, Path } from "react-native-svg";
import type { RootStackParamList } from "../../App";
import { supabase } from "../lib/supabase";
import {
  getNotificationSetupStatus,
  type NotificationSetupState,
} from "../lib/notifications";
import { colors, fonts, radius, spacing, typography } from "../lib/theme";

type Props = {
  session: Session;
  navigation: NativeStackNavigationProp<RootStackParamList, "Settings">;
};

const replayIcon = Icon.select({
  ios: "arrow.counterclockwise",
  android: import("@expo/material-symbols/restart_alt.xml"),
});

const STATUS_LABEL: Record<NotificationSetupState, string> = {
  not_enabled: "Not enabled",
  on: "On",
  blocked: "Blocked",
  needs_attention: "Needs attention",
  unavailable: "Unavailable",
};

function initials(email?: string): string {
  const local = email?.split("@")[0] ?? "P";
  const parts = local.split(/[._-]+/).filter(Boolean);
  return (parts.length > 1
    ? parts.slice(0, 2).map((part) => part[0]).join("")
    : local.slice(0, 2)
  ).toUpperCase();
}

export default function SettingsScreen({ session, navigation }: Props) {
  const isFocused = useIsFocused();
  const [notificationState, setNotificationState] =
    useState<NotificationSetupState | null>(null);

  const loadNotificationState = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("push_token")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error) {
      setNotificationState("unavailable");
      return;
    }

    const status = await getNotificationSetupStatus(!!data?.push_token);
    setNotificationState(status.state);
  }, [session.user.id]);

  useEffect(() => {
    if (isFocused) loadNotificationState();
  }, [isFocused, loadNotificationState]);

  function confirmLogout() {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => supabase.auth.signOut(),
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Settings" onBack={() => navigation.goBack()} />

        <SectionLabel>Account</SectionLabel>
        <View style={styles.group}>
          <View style={[styles.row, styles.accountRow]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(session.user.email)}</Text>
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Signed in as</Text>
              <Text style={styles.rowDetail}>{session.user.email ?? "Account email unavailable"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel>Preferences</SectionLabel>
          <View style={styles.group}>
            <SettingsRow
              icon="bell"
              title="Notifications"
              detail={notificationState ? STATUS_LABEL[notificationState] : "Checking…"}
              status={notificationState}
              onPress={() => navigation.navigate("NotificationSettings")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel>PlantDiary</SectionLabel>
          <View style={styles.group}>
            <SettingsRow
              icon="info"
              title="About PlantDiary"
              value={`Version ${Constants.expoConfig?.version ?? "1.0.0"}`}
            />
            <SettingsRow
              icon="replay"
              title="Replay onboarding"
              detail="See the introduction again"
              divided
              onPress={() => navigation.navigate("OnboardingReplay")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.group}>
            <Pressable
              style={styles.row}
              onPress={confirmLogout}
              accessibilityRole="button"
            >
              <Text style={styles.logoutText}>Log out</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable
        style={styles.backButton}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={4}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path d="M15 18l-6-6 6-6" stroke={colors.bark} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function SettingsRow({
  icon,
  title,
  detail,
  value,
  status,
  onPress,
  divided = false,
}: {
  icon: "bell" | "info" | "replay";
  title: string;
  detail?: string;
  value?: string;
  status?: NotificationSetupState | null;
  onPress?: () => void;
  divided?: boolean;
}) {
  const content = (
    <>
      <View style={styles.iconCircle}>
        {icon === "bell" ? (
          <BellIcon />
        ) : icon === "info" ? (
          <InfoIcon />
        ) : (
          <Host matchContents>
            <Icon name={replayIcon} size={19} color={colors.fern} />
          </Host>
        )}
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        {detail ? (
          <View style={styles.statusLine}>
            {status ? <View style={[styles.statusDot, statusDotStyle(status)]} /> : null}
            <Text style={[styles.rowDetail, status ? statusTextStyle(status) : null]}>{detail}</Text>
          </View>
        ) : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress ? <ChevronIcon /> : null}
    </>
  );

  const rowStyle = [styles.row, divided && styles.rowDivider];
  if (!onPress) return <View style={rowStyle}>{content}</View>;
  return (
    <Pressable style={rowStyle} onPress={onPress} accessibilityRole="button">
      {content}
    </Pressable>
  );
}

function statusDotStyle(state: NotificationSetupState) {
  if (state === "on") return { backgroundColor: colors.fern };
  if (state === "blocked") return { backgroundColor: colors.waterTodayDot };
  if (state === "needs_attention") return { backgroundColor: colors.checkDot };
  return { backgroundColor: colors.muted };
}

function statusTextStyle(state: NotificationSetupState) {
  if (state === "on") return { color: colors.thrivingText };
  if (state === "blocked") return { color: colors.waterTodayText };
  if (state === "needs_attention") return { color: colors.checkText };
  return { color: colors.muted };
}

function BellIcon() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Path d="M18 9a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" stroke={colors.fern} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function InfoIcon() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={colors.fern} strokeWidth={1.7} />
      <Path d="M12 11v6M12 7.5v.5" stroke={colors.fern} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

function ChevronIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 17 17" fill="none">
      <Path d="M6.5 3.5l5 5-5 5" stroke={colors.muted} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
  header: { minHeight: 64, flexDirection: "row", alignItems: "center", marginBottom: spacing.lg },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerSpacer: { width: 44 },
  title: { ...typography.display, flex: 1, textAlign: "center", color: colors.ink },
  section: { marginTop: spacing.gutter },
  sectionLabel: { ...typography.label, color: colors.fern, marginHorizontal: 2, marginBottom: 10 },
  group: { backgroundColor: colors.mist, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, overflow: "hidden" },
  row: { minHeight: 66, paddingHorizontal: spacing.base, flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  accountRow: { minHeight: 82 },
  avatar: { width: 48, height: 48, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.forest },
  avatarText: { fontFamily: fonts.spectralSemiBold, fontSize: 18, color: "#F1EFE4" },
  iconCircle: { width: 34, height: 34, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.wash },
  rowCopy: { flex: 1 },
  rowTitle: { fontFamily: fonts.hankenSemiBold, fontSize: 15, lineHeight: 20, color: colors.ink },
  rowDetail: { fontFamily: fonts.hankenRegular, fontSize: 12, lineHeight: 16, color: colors.muted },
  rowValue: { fontFamily: fonts.hankenRegular, fontSize: 12, color: colors.muted },
  statusLine: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: radius.full },
  logoutText: { fontFamily: fonts.hankenSemiBold, fontSize: 15, color: colors.waterTodayText },
});
