import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useIsFocused } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { getWateringStatus } from "../lib/watering";
import { logEvent, fetchPlantEvents } from "../lib/events";
import type {
  Plant,
  PlantEvent,
  WateringStatus,
  AIPhotoAnalysisResult,
} from "../types";
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

const ANALYSIS_STATUS_CONFIG: Record<
  AIPhotoAnalysisResult["status"],
  { label: string; bg: string; text: string }
> = {
  healthy: { label: "Healthy", bg: "#e8f5e9", text: "#2d5016" },
  monitor: { label: "Monitor", bg: "#fff8e1", text: "#f39c12" },
  concern: { label: "Concern", bg: "#fdecea", text: "#c0392b" },
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
  photo: "Photo Check-In",
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

function parseAnalysis(raw: string | null): AIPhotoAnalysisResult | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.status && parsed.observations) return parsed;
  } catch {
    // not JSON, ignore
  }
  return null;
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
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] =
    useState<AIPhotoAnalysisResult | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const isFocused = useIsFocused();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [plantResult, eventsResult] = await Promise.all([
        supabase.from("plants").select("*").eq("id", plantId).single(),
        fetchPlantEvents(supabase, plantId),
      ]);
      if (plantResult.error) throw plantResult.error;
      if (plantResult.data) setPlant(plantResult.data as Plant);
      setEvents(eventsResult);
    } catch {
      Alert.alert("Error", "Could not load plant data. Please go back and try again.");
    } finally {
      setLoading(false);
    }
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
      Alert.alert("Error", "Could not save event. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePhotoCheckIn() {
    const pickerResult = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (pickerResult.canceled || !pickerResult.assets[0]) return;

    const uri = pickerResult.assets[0].uri;
    setAnalyzing(true);

    try {
      // Upload photo to Supabase Storage
      const fileExt = uri.split(".").pop() ?? "jpg";
      const fileName = `${session.user.id}/${Date.now()}.${fileExt}`;
      const contentType = `image/${fileExt === "jpg" ? "jpeg" : fileExt}`;
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;

      const formData = new FormData();
      formData.append("file", {
        uri,
        name: fileName.split("/").pop(),
        type: contentType,
      } as unknown as Blob);

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(
          "POST",
          `${supabaseUrl}/storage/v1/object/plant-photos/${fileName}`
        );
        xhr.setRequestHeader(
          "Authorization",
          `Bearer ${session.access_token}`
        );
        xhr.setRequestHeader(
          "apikey",
          process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
        );
        xhr.setRequestHeader("x-upsert", "false");
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.responseText}`));
          }
        };
        xhr.onerror = () => reject(new Error("Upload network error"));
        xhr.send(formData);
      });

      const {
        data: { publicUrl },
      } = supabase.storage.from("plant-photos").getPublicUrl(fileName);

      // Build previous events context (last 5)
      const recentEvents = events.slice(0, 5).map((e) => ({
        event_type: e.event_type,
        created_at: e.created_at,
        notes: e.notes,
        ai_analysis: e.ai_analysis,
      }));

      // Call analyze-plant edge function
      const fnResp = await fetch(
        `${supabaseUrl}/functions/v1/analyze-plant`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            photo_url: publicUrl,
            plant: {
              species: plant?.species,
              name: plant?.name,
            },
            previous_events: recentEvents,
          }),
        }
      );

      if (!fnResp.ok) {
        const errText = await fnResp.text();
        throw new Error(`Analysis failed (${fnResp.status}): ${errText}`);
      }

      const analysis = (await fnResp.json()) as AIPhotoAnalysisResult;
      setAnalysisResult(analysis);
      setShowAnalysisModal(true);

      // Save event with photo and analysis
      await logEvent(
        supabase,
        plantId,
        session.user.id,
        "photo",
        undefined,
        publicUrl,
        JSON.stringify(analysis)
      );

      const updated = await fetchPlantEvents(supabase, plantId);
      setEvents(updated);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      Alert.alert("Photo Check-In Failed", message);
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading || !plant) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2d5016" />
      </View>
    );
  }

  if (analyzing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2d5016" />
        <Text style={styles.analyzingText}>Analyzing your plant...</Text>
      </View>
    );
  }

  const status = getWateringStatus(plant);
  const config = STATUS_CONFIG[status];

  function renderEvent({ item }: { item: PlantEvent }) {
    const analysis = parseAnalysis(item.ai_analysis);

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
            <Text style={styles.eventTime}>
              {relativeTime(item.created_at)}
            </Text>
          </View>
          {item.notes ? (
            <Text style={styles.eventNotes} numberOfLines={2}>
              {item.notes}
            </Text>
          ) : null}
          {analysis ? (
            <View style={styles.analysisInline}>
              <View
                style={[
                  styles.analysisBadgeSmall,
                  { backgroundColor: ANALYSIS_STATUS_CONFIG[analysis.status].bg },
                ]}
              >
                <Text
                  style={[
                    styles.analysisBadgeText,
                    { color: ANALYSIS_STATUS_CONFIG[analysis.status].text },
                  ]}
                >
                  {ANALYSIS_STATUS_CONFIG[analysis.status].label}
                </Text>
              </View>
              <Text style={styles.analysisObservations} numberOfLines={3}>
                {analysis.observations}
              </Text>
              {analysis.recommended_action ? (
                <Text style={styles.analysisAction} numberOfLines={2}>
                  {analysis.recommended_action}
                </Text>
              ) : null}
            </View>
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

      {/* Bottom buttons */}
      <View style={styles.bottomButtons}>
        <Pressable
          style={styles.photoCheckInButton}
          onPress={handlePhotoCheckIn}
        >
          <Text style={styles.photoCheckInButtonText}>📷 Photo Check-In</Text>
        </Pressable>
        <Pressable
          style={styles.logButton}
          onPress={() => setShowLogModal(true)}
        >
          <Text style={styles.logButtonText}>+ Log Event</Text>
        </Pressable>
      </View>

      {/* Analysis result modal */}
      <Modal
        visible={showAnalysisModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAnalysisModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {analysisResult && (
              <>
                <Text style={styles.modalTitle}>Photo Analysis</Text>
                <View
                  style={[
                    styles.analysisBadge,
                    {
                      backgroundColor:
                        ANALYSIS_STATUS_CONFIG[analysisResult.status].bg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.analysisBadgeLabelText,
                      {
                        color:
                          ANALYSIS_STATUS_CONFIG[analysisResult.status].text,
                      },
                    ]}
                  >
                    {ANALYSIS_STATUS_CONFIG[analysisResult.status].label}
                  </Text>
                </View>
                <Text style={styles.analysisModalObservations}>
                  {analysisResult.observations}
                </Text>
                {analysisResult.recommended_action ? (
                  <View style={styles.actionBox}>
                    <Text style={styles.actionLabel}>Recommended Action</Text>
                    <Text style={styles.actionText}>
                      {analysisResult.recommended_action}
                    </Text>
                  </View>
                ) : null}
                <Pressable
                  style={styles.submitButton}
                  onPress={() => setShowAnalysisModal(false)}
                >
                  <Text style={styles.submitButtonText}>Done</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

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
  analyzingText: {
    fontSize: 16,
    color: "#2d5016",
    marginTop: 16,
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
    paddingBottom: 120,
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
  analysisInline: {
    marginTop: 8,
    backgroundColor: "#f8f9f5",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e8ece2",
  },
  analysisBadgeSmall: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  analysisBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  analysisObservations: {
    fontSize: 13,
    color: "#555",
    lineHeight: 18,
  },
  analysisAction: {
    fontSize: 12,
    color: "#c0392b",
    marginTop: 4,
    fontStyle: "italic",
  },
  bottomButtons: {
    position: "absolute",
    bottom: 36,
    left: 24,
    right: 24,
    flexDirection: "row",
    gap: 12,
  },
  photoCheckInButton: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#2d5016",
  },
  photoCheckInButtonText: {
    color: "#2d5016",
    fontSize: 15,
    fontWeight: "700",
  },
  logButton: {
    flex: 1,
    backgroundColor: "#2d5016",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  logButtonText: {
    color: "#fff",
    fontSize: 15,
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
  analysisBadge: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
  },
  analysisBadgeLabelText: {
    fontSize: 16,
    fontWeight: "700",
  },
  analysisModalObservations: {
    fontSize: 16,
    color: "#333",
    lineHeight: 24,
    marginBottom: 16,
  },
  actionBox: {
    backgroundColor: "#fef3f0",
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#fde0d8",
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#c0392b",
    marginBottom: 4,
  },
  actionText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
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
