import { Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "../lib/supabase";
import { Session } from "@supabase/supabase-js";

type Props = {
  session: Session;
};

export default function HomeScreen({ session }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Welcome to PlantDiary</Text>
      <Text style={styles.email}>{session.user.email}</Text>

      <View style={styles.placeholder}>
        <Text style={styles.placeholderEmoji}>🌿</Text>
        <Text style={styles.placeholderText}>
          No plants yet. Add your first plant to get started!
        </Text>
      </View>

      <Pressable
        style={styles.logoutButton}
        onPress={() => supabase.auth.signOut()}
      >
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8faf5",
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2d5016",
  },
  email: {
    fontSize: 14,
    color: "#888",
    marginTop: 4,
  },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  placeholderText: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  logoutButton: {
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 40,
  },
  logoutText: {
    color: "#c0392b",
    fontSize: 16,
  },
});
