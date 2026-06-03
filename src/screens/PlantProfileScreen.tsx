import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { getWateringStatus } from "../lib/watering";
import { logEvent, fetchPlantEvents } from "../lib/events";
import type { Plant, PlantEvent, WateringStatus } from "../types";
import type { RootStackParamList } from "../../App";

type Props = {
  session: Session;
  plantId: string;
  navigation: NativeStackNavigationProp<RootStackParamList, "PlantProfile">;
};

const STATUS_CONFIG: Record<
  WateringStatus,
  { label: string; bg: string; text: string }
> = {
  water_today: { label: "Water today", bg: "#fdecea", text: "#c0392b" },
  check: { label: "Check", bg: "#fff8e1", text: "#f39c12" },
  ok: { label: "OK", bg: "#e8f5e9", text: "#2d5016" },
};

const EVENT_TYPES = ["watered", "fertilized", "repotted", "observation"] as const;
type LoggableEventType = (typeof EVENT_TYPES)[number];

const EVENT_ICONS: Record<PlantEvent["event_type"], string> = {
  watered: "💧",
  fertilized: "🧪",
  repotted: "🪴",
  observation: "👁",
  photo: "📷",
};

const EVENT_LABELS: Record<PlantEvent["event_type"], string> = {
  watered: "Watered",
  fertilized: "Fertilized",
  repotted: "Repotted",
  observation: "Observation",
  photo: "Photo",
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function PlantProfileScreen({
  session,
  plantId,
  navigation,
}: Props) {
  const [plant, setPlant] = useState<Plant | null>(null);
  const [events, setEvents] = useState<PlantEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedEventType, setSelectedEventType] =
    useState<LoggableEventType>("watered");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isFocused = useIsFocused();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [plantResult, eventsResult] = await Promise.all([
      supabase.from("plants").select("*").eq("id", plantId).single(),
      fetchPlantEvents(supabase, plantId),
    ]);
    if (plantResult.data) setPlant(plantResult.data as Plant);
    setEvents(eventsResult);
    setLoading(false);
  }, [plantId]);

  useEffect(() => {
    if (isFocused) fetchData();
  }, [isFocused, fetchData]);

  const careStats = useMemo(() => {
    const wateredEvents = events.filter((e) => e.event_type === "watered");
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentCount = events.filter(
      (e) => new Date(e.created_at).getTime() > thirtyDaysAgo
    ).length;

    let avgInterval: number | null = null;
    if (wateredEvents.length >= 2) {
      const sorted = [...wateredEvents].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      let totalDays = 0;
      for (let i = 1; i < sorted.length; i++) {
        const diff =
          new Date(sorted[i].created_at).getTime() -
          new Date(sorted[i - 1].created_at).getTime();
        totalDays += diff / (1000 * 60 * 60 * 24);
      }
      avgInterval = Math.round(totalDays / (sorted.length - 1));
    }

    return { avgInterval, recentCount };
  }, [events]);

  async function handleLogEvent() {
    setSubmitting(true);
    try {
      await logEvent(
        supabase,
        plantId,
        session.user.id,
        selectedEventType,
        notes.trim() || undefined
      );
      if (selectedEventType === "watered" && plant) {
        setPlant({ ...plant, last_watered_at: new Date().toISOString() });
      }
      const updated = await fetchPlantEvents(supabase, plantId);
      setEvents(updated);
      setShowLogModal(false);
      setNotes("");
      setSelectedEventType("watered");
    } catch {
      // stay on modal so user can retry
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !plant) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2d5016" />
      </View>
    );
  }

  const status = getWateringStatus(plant);
  const config = STATUS_CONFIG[status];

  function renderEvent({ item }: { item: PlantEvent }) {
    return (
      <View style={styles.eventRow}>
        <Text style={styles.eventIcon}>
          {EVENT_ICONS[item.event_type] ?? "📝"}
        </Text>
        <View style={styles.eventContent}>
          <View style={styles.eventHeader}>
            <Text style={styles.eventType}>
              {EVENT_LABELS[item.event_type] ?? item.event_type}
            </Text>
            <Text style={styles.eventTime}>{relativeTime(item.created_at)}</Text>
          </View>
          {item.notes ? (
            <Text style={styles.eventNotes} numberOfLines={2}>
              {item.notes}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Back button */}
      <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>← Back</Text>
      </Pressable>

      <FlatList
        data={events}
        renderItem={renderEvent}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Plant header */}
            {plant.photo_url ? (
              <Image
                source={{ uri: plant.photo_url }}
                style={styles.heroImage}
              />
            ) : (
              <View style={[styles.heroImage, styles.heroPlaceholder]}>
                <Text style={styles.heroPlaceholderText}>🌱</Text>
              </View>
            )}

            <View style={styles.infoSection}>
              <View style={styles.nameRow}>
                <Text style={styles.plantName}>{plant.name}</Text>
                <View
                  style={[styles.statusBadge, { backgroundColor: config.bg }]}
                >
                  <Text style={[styles.statusText, { color: config.text }]}>
                    {config.label}
                  </Text>
                </View>
              </View>
              {plant.species ? (
                <Text style={styles.species}>{plant.species}</Text>
              ) : null}
              {plant.location ? (
                <Text style={styles.location}>{plant.location}</Text>
              ) : null}
            </View>

            {/* Care stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {careStats.avgInterval !== null
                    ? `${careStats.avgInterval}d`
                    : "—"}
                </Text>
                <Text style={styles.statLabel}>Avg. watering interval</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{careStats.recentCount}</Text>
                <Text style={styles.statLabel}>Events (30 days)</Text>
              </View>
            </View>

            {/* Timeline header */}
            <Text style={styles.sectionTitle}>Timeline</Text>
            {events.length === 0 && (
              <Text style={styles.emptyTimeline}>
                No events yet. Tap the button below to log one.
              </Text>
            )}
          </>
        }
      />

      {/* Log event button */}
      <Pressable
        style={styles.logButton}
        onPress={() => setShowLogModal(true)}
      >
        <Text style={styles.logButtonText}>+ Log Event</Text>
      </Pressable>

      {/* Log event modal */}
      <Modal
        visible={showLogModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLogModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Log Event</Text>

            <View style={styles.typePicker}>
              {EVENT_TYPES.map((type) => (
                <Pressable
                  key={type}
                  style={[
                    styles.typeOption,
                    selectedEventType === type && styles.typeOptionSelected,
                  ]}
                  onPress={() => setSelectedEventType(type)}
                >
                  <Text style={styles.typeOptionIcon}>
                    {EVENT_ICONS[type]}
                  </Text>
                  <Text
                    style={[
                      styles.typeOptionLabel,
                      selectedEventType === type &&
                        styles.typeOptionLabelSelected,
                    ]}
                  >
                    {EVENT_LABELS[type]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.notesInput}
              placeholder="Notes (optional)"
              placeholderTextColor="#999"
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => {
                  setShowLogModal(false);
                  setNotes("");
                  setSelectedEventType("watered");
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.submitButton,
                  submitting && styles.submitButtonDisabled,
                ]}
                onPress={handleLogEvent}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  backButton: {
    position: "absolute",
    top: 54,
    left: 16,
    zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2d5016",
  },
  listContent: {
    paddingBottom: 100,
  },
  heroImage: {
    width: "100%",
    height: 280,
  },
  heroPlaceholder: {
    backgroundColor: "#e8f0e0",
    justifyContent: "center",
    alignItems: "center",
  },
  heroPlaceholderText: {
    fontSize: 64,
  },
  infoSection: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  plantName: {
    fontSize: 26,
    fontWeight: "700",
    color: "#2d5016",
    flexShrink: 1,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  species: {
    fontSize: 15,
    color: "#666",
    marginTop: 4,
  },
  location: {
    fontSize: 13,
    color: "#999",
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 24,
    marginTop: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e0e8d8",
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2d5016",
  },
  statLabel: {
    fontSize: 11,
    color: "#888",
    marginTop: 4,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2d5016",
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 12,
  },
  emptyTimeline: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  eventRow: {
    flexDirection: "row",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  eventIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  eventContent: {
    flex: 1,
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eventType: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  eventTime: {
    fontSize: 12,
    color: "#999",
  },
  eventNotes: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
  },
  logButton: {
    position: "absolute",
    bottom: 36,
    left: 24,
    right: 24,
    backgroundColor: "#2d5016",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  logButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2d5016",
    marginBottom: 20,
  },
  typePicker: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  typeOption: {
    flex: 1,
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e8d8",
    backgroundColor: "#fff",
  },
  typeOptionSelected: {
    backgroundColor: "#e8f5e9",
    borderColor: "#2d5016",
  },
  typeOptionIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  typeOptionLabel: {
    fontSize: 11,
    color: "#666",
    fontWeight: "500",
  },
  typeOptionLabelSelected: {
    color: "#2d5016",
    fontWeight: "700",
  },
  notesInput: {
    borderWidth: 1,
    borderColor: "#e0e8d8",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 16,
    color: "#333",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e8d8",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#2d5016",
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
});
