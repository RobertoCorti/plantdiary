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
import { colors, fonts, radius, spacing, typography } from "../lib/theme";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleAuth() {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in both fields.");
      return;
    }

    setLoading(true);

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
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
});
