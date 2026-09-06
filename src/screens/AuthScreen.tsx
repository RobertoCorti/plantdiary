import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { AUTH_CALLBACK_URL } from "../lib/auth";
import { colors, fonts, radius, spacing, typography } from "../lib/theme";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  async function handleAuth() {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in both fields.");
      return;
    }

    setLoading(true);

    const normalizedEmail = email.trim();
    const { data, error } = isSignUp
      ? await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { emailRedirectTo: AUTH_CALLBACK_URL },
        })
      : await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

    setLoading(false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    if (isSignUp && !data.session) {
      setPendingEmail(normalizedEmail);
    }
  }

  async function resendConfirmation() {
    if (!pendingEmail || resending) return;
    setResending(true);
    setResendMessage(null);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: { emailRedirectTo: AUTH_CALLBACK_URL },
    });
    setResending(false);
    if (error) {
      Alert.alert("Could not resend", error.message);
      return;
    }
    setResendMessage("A new confirmation email is on its way.");
  }

  if (pendingEmail) {
    return (
      <View style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a confirmation link to
          </Text>
          <Text style={styles.pendingEmail}>{pendingEmail}</Text>
          <Text style={styles.pendingCopy}>
            Open the link on this device. PlantDiary will reopen and finish signing you in.
          </Text>
          {resendMessage && <Text style={styles.successText}>{resendMessage}</Text>}
          <Pressable
            style={[styles.button, resending && styles.buttonDisabled]}
            onPress={resendConfirmation}
            disabled={resending}
          >
            <Text style={styles.buttonText}>
              {resending ? "Sending…" : "Resend confirmation email"}
            </Text>
          </Pressable>
          <Pressable
            style={styles.secondaryAction}
            onPress={() => {
              setPendingEmail(null);
              setResendMessage(null);
            }}
          >
            <Text style={styles.switchText}>Use a different email</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>PlantDiary</Text>
        <Text style={styles.subtitle}>
          {isSignUp ? "Create an account" : "Welcome back"}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleAuth}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Loading…" : isSignUp ? "Sign up" : "Log in"}
          </Text>
        </Pressable>

        <Pressable onPress={() => setIsSignUp(!isSignUp)}>
          <Text style={styles.switchText}>
            {isSignUp
              ? "Already have an account? Log in"
              : "Don't have an account? Sign up"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  title: {
    ...typography.display,
    color: colors.ink,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: fonts.hankenRegular,
    fontSize: 16,
    lineHeight: 22,
    color: colors.bark,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: 14,
    fontFamily: fonts.hankenRegular,
    fontSize: 15,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.forest,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontFamily: fonts.hankenSemiBold,
    fontSize: 15,
  },
  switchText: {
    fontFamily: fonts.hankenRegular,
    fontSize: 14,
    color: colors.fern,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  pendingEmail: {
    fontFamily: fonts.hankenSemiBold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
    textAlign: "center",
  },
  pendingCopy: {
    fontFamily: fonts.hankenRegular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.bark,
    textAlign: "center",
    marginTop: spacing.base,
    marginBottom: spacing.lg,
  },
  successText: {
    fontFamily: fonts.hankenMedium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.fern,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  secondaryAction: {
    minHeight: 44,
    justifyContent: "center",
  },
});
