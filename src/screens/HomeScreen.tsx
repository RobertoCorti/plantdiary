import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Session } from "@supabase/supabase-js";
import type { RootStackParamList } from "../../App";
import * as Location from "expo-location";
import { supabase } from "../lib/supabase";
import { getWateringStatus, daysSinceWatered } from "../lib/watering";
import { fetchWeather } from "../lib/weather";
import { logWatering } from "../lib/events";
import type { Plant, WateringStatus, WeatherData } from "../types";

type Props = {
  session: Session;
  navigation: NativeStackNavigationProp<RootStackParamList, "Home">;
};

const STATUS_ORDER: Record<WateringStatus, number> = {
  water_today: 0,
  check: 1,
  ok: 2,
};

const STATUS_CONFIG: Record<
  WateringStatus,
  { label: string; bg: string; text: string }
> = {
  water_today: { label: "Water today", bg: "#fdecea", text: "#c0392b" },
  check: { label: "Check", bg: "#fff8e1", text: "#f39c12" },
  ok: { label: "OK", bg: "#e8f5e9", text: "#2d5016" },
};

function formatTodayHeader(): string {
  const now = new Date();
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function HomeScreen({ session, navigation }: Props) {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [wateringPlantId, setWateringPlantId] = useState<string | null>(null);
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

  const loadWeather = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setWeatherError("Location access needed for weather data");
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      const data = await fetchWeather(
        location.coords.latitude,
        location.coords.longitude
      );
      setWeather(data);
      setWeatherError(null);
    } catch {
      setWeatherError("Could not load weather");
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      fetchPlants();
      loadWeather();
    }
  }, [isFocused, fetchPlants, loadWeather]);

  const sortedPlants = useMemo(() => {
    return [...plants].sort((a, b) => {
      const statusA = getWateringStatus(a);
      const statusB = getWateringStatus(b);
      return STATUS_ORDER[statusA] - STATUS_ORDER[statusB];
    });
  }, [plants]);

  async function handleWater(plant: Plant) {
    setWateringPlantId(plant.id);
    // Optimistic update
    const now = new Date().toISOString();
    setPlants((prev) =>
      prev.map((p) => (p.id === plant.id ? { ...p, last_watered_at: now } : p))
    );
    try {
      await logWatering(supabase, plant.id, session.user.id);
    } catch {
      // Revert on failure
      fetchPlants();
    } finally {
      setWateringPlantId(null);
    }
  }

  function renderWeatherWidget() {
    if (weatherError) {
      return (
        <View style={styles.weatherWidget}>
          <Text style={styles.weatherErrorText}>{weatherError}</Text>
        </View>
      );
    }
    if (!weather) {
      return (
        <View style={styles.weatherWidget}>
          <ActivityIndicator size="small" color="#2d5016" />
        </View>
      );
    }
    return (
      <View style={styles.weatherWidget}>
        <View style={styles.weatherRow}>
          <View style={styles.weatherItem}>
            <Text style={styles.weatherValue}>
              {Math.round(weather.temperature)}°C
            </Text>
            <Text style={styles.weatherLabel}>Temperature</Text>
          </View>
          <View style={styles.weatherItem}>
            <Text style={styles.weatherValue}>{weather.humidity}%</Text>
            <Text style={styles.weatherLabel}>Humidity</Text>
          </View>
          <View style={styles.weatherItem}>
            <Text style={styles.weatherValue}>
              {weather.precipitation} mm
            </Text>
            <Text style={styles.weatherLabel}>Precipitation</Text>
          </View>
        </View>
      </View>
    );
  }

  function renderPlantCard({ item }: { item: Plant }) {
    const status = getWateringStatus(item);
    const config = STATUS_CONFIG[status];
    const days = daysSinceWatered(item);
    const isWatering = wateringPlantId === item.id;

    return (
      <Pressable
        style={styles.card}
        onPress={() =>
          navigation.navigate("PlantProfile", { plantId: item.id })
        }
      >
        {item.photo_url ? (
          <Image source={{ uri: item.photo_url }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
            <Text style={styles.cardImagePlaceholderText}>🌱</Text>
          </View>
        )}
        <View style={styles.cardInfo}>
          <View style={styles.cardTopRow}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
              <Text style={[styles.statusText, { color: config.text }]}>
                {config.label}
              </Text>
            </View>
          </View>
          {item.species && (
            <Text style={styles.cardSpecies} numberOfLines={1}>
              {item.species}
            </Text>
          )}
          <Text style={styles.cardWatered}>
            {days !== null ? `Last watered ${days}d ago` : "Never watered"}
          </Text>
        </View>
        {status !== "ok" && (
          <Pressable
            style={[styles.waterButton, isWatering && styles.waterButtonDisabled]}
            onPress={() => !isWatering && handleWater(item)}
            disabled={isWatering}
          >
            {isWatering ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.waterButtonText}>Water</Text>
            )}
          </Pressable>
        )}
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Today</Text>
          <Text style={styles.dateSubtitle}>{formatTodayHeader()}</Text>
        </View>
        <Pressable
          style={styles.addButton}
          onPress={() => navigation.navigate("AddPlant")}
        >
          <Text style={styles.addButtonText}>+ Add Plant</Text>
        </Pressable>
      </View>

      {renderWeatherWidget()}

      {plants.length === 0 && !loading ? (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderEmoji}>🌿</Text>
          <Text style={styles.placeholderText}>
            No plants yet. Add your first plant to get started!
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedPlants}
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
    marginBottom: 16,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2d5016",
  },
  dateSubtitle: {
    fontSize: 14,
    color: "#888",
    marginTop: 2,
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
  weatherWidget: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e0e8d8",
  },
  weatherRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  weatherItem: {
    alignItems: "center",
  },
  weatherValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2d5016",
  },
  weatherLabel: {
    fontSize: 11,
    color: "#888",
    marginTop: 2,
  },
  weatherErrorText: {
    fontSize: 13,
    color: "#888",
    textAlign: "center",
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
    alignItems: "center",
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
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2d5016",
    flexShrink: 1,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  cardSpecies: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  cardWatered: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  waterButton: {
    backgroundColor: "#4a90d9",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginLeft: 8,
  },
  waterButtonDisabled: {
    opacity: 0.6,
  },
  waterButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
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
