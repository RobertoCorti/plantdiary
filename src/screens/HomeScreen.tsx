import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Plant } from "../types";

type Props = {
  session: Session;
  navigation: { navigate: (screen: string) => void };
};

export default function HomeScreen({ session, navigation }: Props) {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  const fetchPlants = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("plants")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    setPlants(data ?? []);
    setLoading(false);
  }, [session.user.id]);

  useEffect(() => {
    if (isFocused) {
      fetchPlants();
    }
  }, [isFocused, fetchPlants]);

  function renderPlantCard({ item }: { item: Plant }) {
    return (
      <View style={styles.card}>
        {item.photo_url ? (
          <Image source={{ uri: item.photo_url }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
            <Text style={styles.cardImagePlaceholderText}>🌱</Text>
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.name}</Text>
          {item.species && (
            <Text style={styles.cardSpecies} numberOfLines={1}>
              {item.species}
            </Text>
          )}
          {item.location && (
            <Text style={styles.cardLocation}>{item.location}</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>PlantDiary</Text>
          <Text style={styles.email}>{session.user.email}</Text>
        </View>
        <Pressable
          style={styles.addButton}
          onPress={() => navigation.navigate("AddPlant")}
        >
          <Text style={styles.addButtonText}>+ Add Plant</Text>
        </Pressable>
      </View>

      {plants.length === 0 && !loading ? (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderEmoji}>🌿</Text>
          <Text style={styles.placeholderText}>
            No plants yet. Add your first plant to get started!
          </Text>
        </View>
      ) : (
        <FlatList
          data={plants}
          renderItem={renderPlantCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
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
  addButton: {
    backgroundColor: "#2d5016",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
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
  list: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    flexDirection: "row",
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e8d8",
  },
  cardImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  cardImagePlaceholder: {
    backgroundColor: "#f0f5eb",
    justifyContent: "center",
    alignItems: "center",
  },
  cardImagePlaceholderText: {
    fontSize: 28,
  },
  cardInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: "center",
  },
  cardName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2d5016",
  },
  cardSpecies: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  cardLocation: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
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
