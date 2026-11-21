import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { Session } from "@supabase/supabase-js";
import Constants from "expo-constants";
import Svg, { Path } from "react-native-svg";
import type { RootStackParamList } from "../../App";
import {
  FEEDBACK_MESSAGE_MAX_LENGTH,
  submitFeedback,
  type FeedbackCategory,
  type FeedbackPlatform,
} from "../lib/feedback";
import { supabase } from "../lib/supabase";
import { colors, fonts, radius, spacing, typography } from "../lib/theme";
import { ScreenHeader } from "./SettingsScreen";

type Props = {
  session: Session;
  navigation: NativeStackNavigationProp<RootStackParamList, "Feedback">;
};

const CATEGORY_OPTIONS: ReadonlyArray<{
  value: FeedbackCategory;
  label: string;
}> = [
  { value: "bug", label: "Something isn’t working" },
  { value: "ux", label: "Something is confusing" },
  { value: "idea", label: "I have an idea" },
];

function currentPlatform(): FeedbackPlatform | null {
  if (Platform.OS === "ios" || Platform.OS === "android" || Platform.OS === "web") {
    return Platform.OS;
  }
  return null;
}

export default function FeedbackScreen({ session, navigation }: Props) {
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messageLength = Array.from(message).length;
  const canSubmit = !!category && !!message.trim() && !submitting;

  function updateMessage(value: string) {
    setMessage(Array.from(value).slice(0, FEEDBACK_MESSAGE_MAX_LENGTH).join(""));
    setErrorMessage(null);
  }

  async function handleSubmit() {
    if (!category || !message.trim() || submitting) return;

    const platform = currentPlatform();
    if (!platform) {
      setErrorMessage("Feedback is not supported on this platform yet.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      await submitFeedback(supabase, session.user.id, {
        category,
        message,
        appVersion: Constants.expoConfig?.version ?? null,
        platform,
        platformVersion: String(Platform.Version),
      });
      setSubmitted(true);
    } catch {
      setErrorMessage(
        "Your message is still here. Check your connection and try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenHeader title="Send feedback" onBack={() => navigation.goBack()} />

          {submitted ? (
            <View style={styles.successCard}>
              <View style={styles.successIcon}>
                <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M5 12.5l4.2 4L19 7"
                    stroke={colors.fern}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <Text style={styles.successTitle}>Thank you</Text>
              <Text style={styles.successBody}>
                Your feedback helps PlantDiary grow.
              </Text>
              <Pressable
                style={styles.primaryButton}
                onPress={() => navigation.goBack()}
                accessibilityRole="button"
              >
                <Text style={styles.primaryButtonText}>Back to settings</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.intro}>
                Tell us what happened or what would make PlantDiary more useful to you.
              </Text>

              <Text style={styles.sectionLabel}>What kind of feedback?</Text>
              <View style={styles.categoryGroup} accessibilityRole="radiogroup">
                {CATEGORY_OPTIONS.map((option, index) => {
                  const selected = category === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      style={[
                        styles.categoryRow,
                        index > 0 && styles.categoryDivider,
                      ]}
                      onPress={() => {
                        setCategory(option.value);
                        setErrorMessage(null);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                    >
                      <View style={[styles.radio, selected && styles.radioSelected]}>
                        {selected ? <View style={styles.radioDot} /> : null}
                      </View>
                      <Text style={styles.categoryLabel}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.messageHeader}>
                <Text style={styles.sectionLabel}>Your message</Text>
                <Text style={styles.counter}>
                  {messageLength.toLocaleString()} / {FEEDBACK_MESSAGE_MAX_LENGTH.toLocaleString()}
                </Text>
              </View>
              <TextInput
                style={styles.messageInput}
                value={message}
                onChangeText={updateMessage}
                placeholder="Share as much detail as you can…"
                placeholderTextColor={colors.muted}
                multiline
                textAlignVertical="top"
                accessibilityLabel="Feedback message"
              />
              <Text style={styles.privacyNote}>
                Please don’t include passwords or other sensitive information.
              </Text>

              {errorMessage ? (
                <View style={styles.errorBox} accessibilityRole="alert">
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              <Pressable
                style={[
                  styles.primaryButton,
                  !canSubmit && styles.primaryButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!canSubmit}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSubmit, busy: submitting }}
              >
                <Text style={styles.primaryButtonText}>
                  {submitting ? "Sending…" : "Send feedback"}
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.paper },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.xxl,
  },
  intro: {
    ...typography.body,
    color: colors.bark,
    marginBottom: spacing.gutter,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.fern,
    marginHorizontal: 2,
    marginBottom: 10,
  },
  categoryGroup: {
    backgroundColor: colors.mist,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: spacing.gutter,
  },
  categoryRow: {
    minHeight: 58,
    paddingHorizontal: spacing.base,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  categoryDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  categoryLabel: {
    fontFamily: fonts.hankenSemiBold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.ink,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: colors.fern },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.fern,
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  counter: {
    fontFamily: fonts.monoRegular,
    fontSize: 11,
    lineHeight: 14,
    color: colors.muted,
  },
  messageInput: {
    minHeight: 156,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.mist,
    paddingHorizontal: spacing.base,
    paddingVertical: 14,
    fontFamily: fonts.hankenRegular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
  },
  privacyNote: {
    fontFamily: fonts.hankenRegular,
    fontSize: 11,
    lineHeight: 15,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  errorBox: {
    borderRadius: radius.md,
    backgroundColor: colors.waterTodayBg,
    padding: spacing.md,
    marginTop: spacing.base,
  },
  errorText: {
    ...typography.small,
    color: colors.waterTodayText,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.forest,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.base,
    marginTop: spacing.gutter,
  },
  primaryButtonDisabled: { opacity: 0.45 },
  primaryButtonText: {
    fontFamily: fonts.hankenSemiBold,
    fontSize: 15,
    color: "#F1EFE4",
  },
  successCard: {
    backgroundColor: colors.mist,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.gutter,
    alignItems: "center",
    marginTop: spacing.xl,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.thrivingBg,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    ...typography.title,
    color: colors.ink,
    marginTop: spacing.base,
  },
  successBody: {
    ...typography.body,
    color: colors.bark,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
