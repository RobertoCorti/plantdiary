import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
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
import { supabase } from "../lib/supabase";
import { fetchPlantEvents } from "../lib/events";
import { computeJournalStats, computeMilestones } from "../lib/journal";
import type { Plant, PlantEvent } from "../types";
import type { RootStackParamList } from "../../App";

type Props = {
  session: Session;
  plantId: string;
  navigation: NativeStackNavigationProp<RootStackParamList, "PlantJournal">;
};

const GUTTER = 24;
const GALLERY_GAP = 6;
const GALLERY_COLS = 3;
const thumbSize =
  (Dimensions.get("window").width - GUTTER * 2 - GALLERY_GAP * (GALLERY_COLS - 1)) /
  GALLERY_COLS;

function formatMonthDay(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PlantJournalScreen({
  session: _session,
  plantId,
  navigation,
}: Props) {
  const [plant, setPlant] = useState<Plant | null>(null);
  const [events, setEvents] = useState<PlantEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [plantResult, eventsResult] = await Promise.all([
        supabase.from("plants").select("*").eq("id", plantId).single(),
        fetchPlantEvents(supabase, plantId),
      ]);
      if (plantResult.data) setPlant(plantResult.data as Plant);
      setEvents(eventsResult);
    } finally {
      setLoading(false);
    }
  }, [plantId]);

  useEffect(() => {
    if (isFocused) fetchData();
  }, [isFocused, fetchData]);

  const stats = useMemo(
    () => (plant ? computeJournalStats(plant, events) : null),
    [plant, events]
  );
  const milestones = useMemo(
    () => (plant ? computeMilestones(plant, events) : []),
    [plant, events]
  );
  const photos = useMemo(
    () =>
      events.filter((e) => e.photo_url).map((e) => ({ id: e.id, uri: e.photo_url! })),
    [events]
  );

  if (loading || !plant || !stats) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2d5016" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
        <Text style={styles.topTitle}>Journal</Text>
        <View style={styles.backButtonSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.plantName}>{plant.name}</Text>

        {/* Stats summary */}
        <View style={styles.statsCard}>
          <Text style={styles.statsHeadline}>
            {stats.daysWithPlant} {stats.daysWithPlant === 1 ? "day" : "days"} with{" "}
            {plant.name}
          </Text>
          <View style={styles.statsRow}>
            <Stat value={stats.waterings} label="waterings" />
            <Stat value={stats.fertilizings} label="feedings" />
            <Stat value={stats.photos} label="photos" />
            {stats.scaresSurvived > 0 ? (
              <Stat
                value={stats.scaresSurvived}
                label={stats.scaresSurvived === 1 ? "scare survived" : "scares survived"}
              />
            ) : null}
          </View>
        </View>

        {/* Photo gallery */}
        <Text style={styles.sectionTitle}>Photos</Text>
        {photos.length === 0 ? (
          <Text style={styles.emptyText}>
            No photos yet. Photo check-ins from the profile show up here.
          </Text>
        ) : (
          <View style={styles.gallery}>
            {photos.map((p) => (
              <Image
                key={p.id}
                source={{ uri: p.uri }}
                style={[styles.thumb, { width: thumbSize, height: thumbSize }]}
              />
            ))}
          </View>
        )}

        {/* Milestone feed */}
        <Text style={styles.sectionTitle}>Milestones</Text>
        {milestones.length === 0 ? (
          <Text style={styles.emptyText}>
            Milestones appear as {plant.name} grows — anniversaries, watering
            counts, learned schedules and more.
          </Text>
        ) : (
          milestones.map((m) => (
            <View key={m.id} style={styles.milestoneRow}>
              <Text style={styles.milestoneIcon}>{m.icon}</Text>
              <View style={styles.milestoneBody}>
                <Text style={styles.milestoneTitle}>{m.title}</Text>
                {m.detail ? (
                  <Text style={styles.milestoneDetail}>{m.detail}</Text>
                ) : null}
                <Text style={styles.milestoneDate}>{formatMonthDay(m.date)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8faf5",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8faf5",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 54,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  backButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  backButtonSpacer: {
    width: 60,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2d5016",
  },
  topTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#2d5016",
  },
  content: {
    paddingHorizontal: GUTTER,
    paddingBottom: 48,
  },
  plantName: {
    fontSize: 26,
    fontWeight: "700",
    color: "#2d5016",
    marginTop: 4,
    marginBottom: 16,
  },
  statsCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e0e8d8",
  },
  statsHeadline: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2d5016",
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stat: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2d5016",
  },
  statLabel: {
    fontSize: 11,
    color: "#888",
    marginTop: 2,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2d5016",
    marginTop: 28,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    lineHeight: 20,
  },
  gallery: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GALLERY_GAP,
  },
  thumb: {
    borderRadius: 10,
    backgroundColor: "#e8f0e0",
  },
  milestoneRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e0e8d8",
  },
  milestoneIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  milestoneBody: {
    flex: 1,
  },
  milestoneTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2d5016",
  },
  milestoneDetail: {
    fontSize: 13,
    color: "#666",
    marginTop: 3,
    lineHeight: 18,
  },
  milestoneDate: {
    fontSize: 12,
    color: "#999",
    marginTop: 6,
  },
});
