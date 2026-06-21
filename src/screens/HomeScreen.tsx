import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
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
import { careBridgeSentence, fetchWeather } from "../lib/weather";
import { logWatering } from "../lib/events";
import { log } from "../lib/logger";
import {
  colors,
  fonts,
  radius,
  spacing,
  STATUS,
  typography,
} from "../lib/theme";
import { StatusBadge } from "../components/StatusBadge";
import { EyebrowLabel } from "../components/EyebrowLabel";
import { BreathingMark } from "../components/BreathingMark";
import type { Plant, WateringStatus, WeatherData } from "../types";

type Props = {
  session: Session;
  navigation: NativeStackNavigationProp<RootStackParamList, "Home">;
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
  const [wateringIds, setWateringIds] = useState<Set<string>>(new Set());
  const [fetchError, setFetchError] = useState<string | null>(null);
  const isFocused = useIsFocused();

  const fetchPlants = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const { data, error } = await supabase
        .from("plants")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPlants(data ?? []);
    } catch {
      setFetchError("Could not load your plants. Pull down to retry.");
    } finally {
      setLoading(false);
    }
  }, [session.user.id]);

  const loadWeather = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setWeatherError("Location access needed for weather data");
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      supabase
        .from("profiles")
        .upsert({
          id: session.user.id,
          latitude,
          longitude,
          coords_updated_at: new Date().toISOString(),
        })
        .then(({ error }) => {
          if (error) log.warn("weather", "Failed to persist coords", error.message);
        });
      const data = await fetchWeather(latitude, longitude);
      setWeather(data);
      setWeatherError(null);
    } catch {
      setWeatherError("Could not load weather");
    }
  }, [session.user.id]);

  useEffect(() => {
    if (isFocused) {
      fetchPlants();
      loadWeather();
    }
  }, [isFocused, fetchPlants, loadWeather]);

  const grouped = useMemo(() => {
    const buckets: Record<WateringStatus, Plant[]> = {
      water_today: [],
      check: [],
      ok: [],
    };
    for (const p of plants) {
      buckets[getWateringStatus(p)].push(p);
    }
    return buckets;
  }, [plants]);

  const attentionPlants = useMemo(
    () => [...grouped.water_today, ...grouped.check],
    [grouped]
  );
  const thrivingPlants = grouped.ok;
  const waterTodayCount = grouped.water_today.length;

  async function handleWater(plant: Plant) {
    setWateringIds((prev) => new Set(prev).add(plant.id));
    const now = new Date().toISOString();
    setPlants((prev) =>
      prev.map((p) => (p.id === plant.id ? { ...p, last_watered_at: now } : p))
    );
    try {
      await logWatering(supabase, plant.id, session.user.id);
    } catch {
      Alert.alert("Watering Failed", "Could not log watering. Please try again.");
      fetchPlants();
    } finally {
      setWateringIds((prev) => {
        const next = new Set(prev);
        next.delete(plant.id);
        return next;
      });
    }
  }

  async function handleWaterAll() {
    const targets = grouped.water_today;
    if (targets.length === 0) return;
    const ids = new Set(targets.map((p) => p.id));
    setWateringIds((prev) => new Set([...prev, ...ids]));
    const now = new Date().toISOString();
    setPlants((prev) =>
      prev.map((p) => (ids.has(p.id) ? { ...p, last_watered_at: now } : p))
    );
    const results = await Promise.allSettled(
      targets.map((p) => logWatering(supabase, p.id, session.user.id))
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    setWateringIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
    if (failed > 0) {
      Alert.alert(
        "Some waterings failed",
        `${failed} of ${targets.length} could not be logged. Refreshing.`
      );
      fetchPlants();
    }
  }

  function renderCareBridge() {
    if (weatherError) {
      return (
        <View style={styles.bridgeCard}>
          <Text style={styles.bridgeMuted}>{weatherError}</Text>
        </View>
      );
    }
    if (!weather) {
      return (
        <View style={[styles.bridgeCard, styles.bridgeCardLoading]}>
          <BreathingMark size={32} color={colors.fern} />
        </View>
      );
    }
    return (
      <View style={styles.bridgeCard}>
        <Text style={styles.bridgeSentence}>{careBridgeSentence(weather)}</Text>
        <View style={styles.bridgeStatsRow}>
          <BridgeStat value={`${Math.round(weather.temperature)}°`} label="temp" />
          <BridgeStat value={`${Math.round(weather.humidity)}%`} label="humidity" />
          <BridgeStat value={`${weather.precipitation} mm`} label="rain" />
        </View>
      </View>
    );
  }

  function renderSummaryStrip() {
    if (plants.length === 0) return null;
    const pills: Array<{ status: WateringStatus; label: string }> = [];
    if (grouped.water_today.length > 0)
      pills.push({
        status: "water_today",
        label: `${grouped.water_today.length} to water`,
      });
    if (grouped.check.length > 0)
      pills.push({
        status: "check",
        label: `${grouped.check.length} to check`,
      });
    if (thrivingPlants.length > 0)
      pills.push({
        status: "ok",
        label: `${thrivingPlants.length} thriving`,
      });
    if (pills.length === 0) return null;
    return (
      <View style={styles.summaryStrip}>
        {pills.map((p) => (
          <StatusBadge key={p.status} status={p.status} label={p.label} />
        ))}
      </View>
    );
  }

  function renderAttentionCard(plant: Plant) {
    const status = getWateringStatus(plant);
    const tone = STATUS[status];
    const days = daysSinceWatered(plant);
    const isWatering = wateringIds.has(plant.id);

    return (
      <Pressable
        key={plant.id}
        style={[styles.attentionCard, { borderLeftColor: tone.dot }]}
        onPress={() => navigation.navigate("PlantProfile", { plantId: plant.id })}
      >
        {plant.photo_url ? (
          <Image source={{ uri: plant.photo_url }} style={styles.attentionImage} />
        ) : (
          <View style={[styles.attentionImage, styles.imagePlaceholder]}>
            <Text style={styles.imagePlaceholderText}>🌱</Text>
          </View>
        )}
        <View style={styles.attentionInfo}>
          <View style={styles.attentionTopRow}>
            <Text style={styles.cardName} numberOfLines={1}>
              {plant.name}
            </Text>
            <StatusBadge status={status} />
          </View>
          {plant.species && (
            <Text style={styles.cardSpecies} numberOfLines={1}>
              {plant.species}
            </Text>
          )}
          <Text style={styles.cardWatered}>
            {days !== null ? `Last watered ${days}d ago` : "Never watered"}
          </Text>
        </View>
        <Pressable
          style={[styles.waterButton, isWatering && styles.waterButtonDisabled]}
          onPress={() => !isWatering && handleWater(plant)}
          disabled={isWatering}
          hitSlop={8}
        >
          {isWatering ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.waterButtonText}>Water</Text>
          )}
        </Pressable>
      </Pressable>
    );
  }

  function renderThrivingCard(plant: Plant) {
    const days = daysSinceWatered(plant);
    return (
      <Pressable
        key={plant.id}
        style={styles.thrivingCard}
        onPress={() => navigation.navigate("PlantProfile", { plantId: plant.id })}
      >
        {plant.photo_url ? (
          <Image source={{ uri: plant.photo_url }} style={styles.thrivingImage} />
        ) : (
          <View style={[styles.thrivingImage, styles.imagePlaceholder]}>
            <Text style={styles.imagePlaceholderText}>🌱</Text>
          </View>
        )}
        <View style={styles.thrivingInfo}>
          <Text style={styles.thrivingName} numberOfLines={1}>
            {plant.name}
          </Text>
          {plant.species && (
            <Text style={styles.cardSpecies} numberOfLines={1}>
              {plant.species}
            </Text>
          )}
          <Text style={styles.cardWatered}>
            {days !== null ? `Watered ${days}d ago` : "Never watered"}
          </Text>
        </View>
      </Pressable>
    );
  }

  const showEmpty = plants.length === 0 && !loading && !fetchError;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Today</Text>
            <Text style={styles.dateSubtitle}>{formatTodayHeader()}</Text>
          </View>
          <Pressable
            style={styles.addButton}
            onPress={() => navigation.navigate("AddPlant")}
          >
            <Text style={styles.addButtonText}>+ Plant</Text>
          </Pressable>
        </View>

        {renderCareBridge()}
        {renderSummaryStrip()}

        {fetchError ? (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>{fetchError}</Text>
            <Pressable style={styles.retryButton} onPress={fetchPlants}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : showEmpty ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Welcome to PlantDiary</Text>
            <Text style={styles.emptyText}>
              Take a photo of a plant and we'll identify it for you.
            </Text>
            <Pressable
              style={styles.emptyAddButton}
              onPress={() => navigation.navigate("AddPlant")}
            >
              <Text style={styles.emptyAddButtonText}>Add your first plant</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {attentionPlants.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <EyebrowLabel>Needs attention</EyebrowLabel>
                  {waterTodayCount >= 2 && (
                    <Pressable onPress={handleWaterAll} hitSlop={8}>
                      <Text style={styles.sectionAction}>
                        Water all ({waterTodayCount})
                      </Text>
                    </Pressable>
                  )}
                </View>
                {attentionPlants.map(renderAttentionCard)}
              </>
            )}
            {thrivingPlants.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <EyebrowLabel>All good</EyebrowLabel>
                </View>
                {thrivingPlants.map(renderThrivingCard)}
              </>
            )}
          </>
        )}

        <Pressable
          style={styles.logoutButton}
          onPress={() =>
            Alert.alert("Log out", "Are you sure you want to log out?", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Log out",
                style: "destructive",
                onPress: () => supabase.auth.signOut(),
              },
            ])
          }
        >
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function BridgeStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.bridgeStat}>
      <Text style={styles.bridgeStatValue}>{value}</Text>
      <Text style={styles.bridgeStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  scroll: {
    paddingHorizontal: spacing.gutter,
    paddingTop: 72,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.lg,
  },
  greeting: {
    ...typography.display,
    color: colors.ink,
  },
  dateSubtitle: {
    fontFamily: fonts.hankenRegular,
    fontSize: 14,
    color: colors.muted,
    marginTop: 2,
  },
  addButton: {
    backgroundColor: colors.forest,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: 10,
  },
  addButtonText: {
    color: "#fff",
    fontFamily: fonts.hankenSemiBold,
    fontSize: 13,
  },

  bridgeCard: {
    backgroundColor: colors.mist,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  bridgeCardLoading: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 72,
  },
  bridgeSentence: {
    fontFamily: fonts.spectralRegular,
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
  },
  bridgeMuted: {
    fontFamily: fonts.hankenRegular,
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
  },
  bridgeStatsRow: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  bridgeStat: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  bridgeStatValue: {
    fontFamily: fonts.monoMedium,
    fontSize: 14,
    color: colors.ink,
  },
  bridgeStatLabel: {
    fontFamily: fonts.hankenRegular,
    fontSize: 11,
    color: colors.muted,
  },

  summaryStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionAction: {
    fontFamily: fonts.hankenSemiBold,
    fontSize: 13,
    color: colors.forest,
  },

  attentionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 3,
    borderRadius: radius.lg,
    flexDirection: "row",
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: "center",
  },
  attentionImage: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
  },
  attentionInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: "center",
    gap: 2,
  },
  attentionTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 2,
  },
  cardName: {
    fontFamily: fonts.spectralSemiBold,
    fontSize: 18,
    color: colors.ink,
    flexShrink: 1,
  },
  cardSpecies: {
    fontFamily: fonts.hankenRegular,
    fontSize: 13,
    color: colors.bark,
  },
  cardWatered: {
    fontFamily: fonts.monoRegular,
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  waterButton: {
    backgroundColor: colors.rain,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginLeft: spacing.sm,
  },
  waterButtonDisabled: {
    opacity: 0.6,
  },
  waterButtonText: {
    color: "#fff",
    fontFamily: fonts.hankenSemiBold,
    fontSize: 13,
  },

  thrivingCard: {
    backgroundColor: colors.mist,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    flexDirection: "row",
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
    alignItems: "center",
  },
  thrivingImage: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
  },
  thrivingInfo: {
    flex: 1,
    marginLeft: spacing.md,
    gap: 1,
  },
  thrivingName: {
    fontFamily: fonts.spectralSemiBold,
    fontSize: 16,
    color: colors.ink,
  },

  imagePlaceholder: {
    backgroundColor: colors.wash,
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderText: {
    fontSize: 24,
  },

  placeholder: {
    paddingVertical: spacing.xxl,
    alignItems: "center",
  },
  placeholderText: {
    fontFamily: fonts.hankenRegular,
    fontSize: 14,
    color: colors.bark,
    textAlign: "center",
    marginBottom: spacing.base,
  },
  retryButton: {
    backgroundColor: colors.forest,
    borderRadius: radius.md,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: "#fff",
    fontFamily: fonts.hankenSemiBold,
    fontSize: 13,
  },

  emptyState: {
    paddingVertical: spacing.xxl,
    alignItems: "center",
  },
  emptyTitle: {
    ...typography.title,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontFamily: fonts.hankenRegular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.bark,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.gutter,
  },
  emptyAddButton: {
    backgroundColor: colors.forest,
    borderRadius: radius.md,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  emptyAddButtonText: {
    color: "#fff",
    fontFamily: fonts.hankenSemiBold,
    fontSize: 15,
  },

  logoutButton: {
    paddingVertical: spacing.base,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  logoutText: {
    fontFamily: fonts.hankenRegular,
    fontSize: 14,
    color: colors.muted,
  },
});
