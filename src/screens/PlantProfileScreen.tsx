import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
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
import {
  acceptFrequencyProposal,
  fetchPlantEvents,
  logEvent,
} from "../lib/events";
import { proposeFrequency } from "../lib/learning";
import {
  colors,
  fonts,
  radius,
  spacing,
  typography,
} from "../lib/theme";
import { StatusBadge } from "../components/StatusBadge";
import { ConfidenceBar } from "../components/ConfidenceBar";
import { EventIcon, iconForEvent } from "../components/EventIcon";
import { EyebrowLabel } from "../components/EyebrowLabel";
import { BreathingMark } from "../components/BreathingMark";
import type {
  AIPhotoAnalysisResult,
  FrequencyProposal,
  Plant,
  PlantEvent,
} from "../types";
import type { RootStackParamList } from "../../App";

type Props = {
  session: Session;
  plantId: string;
  navigation: NativeStackNavigationProp<RootStackParamList, "PlantProfile">;
};

type AnalysisStatus = AIPhotoAnalysisResult["status"];

const ANALYSIS_TONE: Record<
  AnalysisStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  healthy: {
    label: "Healthy",
    bg: colors.thrivingBg,
    text: colors.thrivingText,
    dot: colors.thrivingDot,
  },
  monitor: {
    label: "Monitor",
    bg: colors.checkBg,
    text: colors.checkText,
    dot: colors.checkDot,
  },
  concern: {
    label: "Concern",
    bg: colors.waterTodayBg,
    text: colors.waterTodayText,
    dot: colors.waterTodayDot,
  },
};

const EVENT_TYPES = ["watered", "fertilized", "repotted", "observation"] as const;
type LoggableEventType = (typeof EVENT_TYPES)[number];

const EVENT_LABELS: Record<PlantEvent["event_type"], string> = {
  watered: "Watered",
  fertilized: "Fertilized",
  repotted: "Repotted",
  observation: "Observation",
  photo: "Photo check-in",
  frequency_updated: "Schedule updated",
};

// proposeFrequency() doesn't yet return variance, so error-days come from the
// confidence tier rather than a computed IQR. Values match DESIGN.md §5.2.
const CONFIDENCE_TIER: Record<
  FrequencyProposal["confidence"],
  { fillPercent: number; errorDays: number }
> = {
  low: { fillPercent: 28, errorDays: 3.1 },
  medium: { fillPercent: 62, errorDays: 1.4 },
  high: { fillPercent: 92, errorDays: 0.6 },
};

const DAY_MS = 24 * 60 * 60 * 1000;
const RHYTHM_DAYS = 30;

function startOfDay(d: Date | number | string): number {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

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

function shortDateLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

type WeekGroup = { key: number; label: string; events: PlantEvent[] };

function groupByWeek(events: PlantEvent[]): WeekGroup[] {
  const today = startOfDay(Date.now());
  const buckets = new Map<number, PlantEvent[]>();
  for (const e of events) {
    const daysAgo = Math.floor((today - startOfDay(e.created_at)) / DAY_MS);
    const week = Math.max(0, Math.floor(daysAgo / 7));
    const arr = buckets.get(week);
    if (arr) arr.push(e);
    else buckets.set(week, [e]);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([key, list]) => ({
      key,
      label: key === 0 ? "This week" : key === 1 ? "Last week" : `${key} weeks ago`,
      events: list,
    }));
}

function parseAnalysis(raw: string | null): AIPhotoAnalysisResult | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.status && parsed.observations) return parsed;
  } catch {
    // not JSON
  }
  return null;
}

// One color per day for the 30-day rhythm strip. Highest-priority event wins
// when multiple events fall on the same day.
function rhythmDot(daysAgo: number, events: PlantEvent[]): string {
  const dayStart = startOfDay(Date.now() - daysAgo * DAY_MS);
  const dayEnd = dayStart + DAY_MS;
  const hits = events.filter((e) => {
    const t = new Date(e.created_at).getTime();
    return t >= dayStart && t < dayEnd;
  });
  if (hits.some((e) => e.event_type === "watered")) return colors.forest;
  if (hits.some((e) => e.event_type === "photo")) return colors.rain;
  if (hits.length > 0) return colors.sage;
  return colors.line;
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
  const [proposal, setProposal] = useState<FrequencyProposal | null>(null);
  const [proposalDismissed, setProposalDismissed] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const isFocused = useIsFocused();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [plantResult, eventsResult] = await Promise.all([
        supabase.from("plants").select("*").eq("id", plantId).single(),
        fetchPlantEvents(supabase, plantId),
      ]);
      if (plantResult.error) throw plantResult.error;
      if (plantResult.data) {
        const fetchedPlant = plantResult.data as Plant;
        setPlant(fetchedPlant);
        const prop = await proposeFrequency(supabase, fetchedPlant);
        setProposal(prop);
      }
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
    const thirtyDaysAgo = Date.now() - 30 * DAY_MS;
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
        totalDays += diff / DAY_MS;
      }
      avgInterval = Math.round(totalDays / (sorted.length - 1));
    }

    const daysWithPlant = plant
      ? Math.max(
          1,
          Math.floor((Date.now() - new Date(plant.created_at).getTime()) / DAY_MS)
        )
      : 0;

    return { avgInterval, recentCount, daysWithPlant };
  }, [events, plant]);

  // events arrive newest-first. The "Now" is the most recent photo event;
  // the "Day 1" is the oldest photo event. We need at least two to show the
  // pair — otherwise we either show a single photo or fall back to the plant
  // profile photo.
  const photoStrip = useMemo(() => {
    const photos = events
      .filter((e) => e.event_type === "photo" && e.photo_url)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    if (photos.length >= 2) {
      const first = photos[0];
      const last = photos[photos.length - 1];
      const span = Math.max(
        1,
        Math.floor(
          (new Date(last.created_at).getTime() -
            new Date(first.created_at).getTime()) /
            DAY_MS
        )
      );
      return {
        kind: "pair" as const,
        firstUrl: first.photo_url!,
        firstLabel: shortDateLabel(first.created_at),
        lastUrl: last.photo_url!,
        lastLabel: `Day ${span + 1}`,
      };
    }
    if (photos.length === 1) {
      return {
        kind: "single" as const,
        url: photos[0].photo_url!,
        label: shortDateLabel(photos[0].created_at),
      };
    }
    if (plant?.photo_url) {
      return { kind: "single" as const, url: plant.photo_url, label: "Profile" };
    }
    return null;
  }, [events, plant]);

  const weekGroups = useMemo(() => groupByWeek(events), [events]);

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

  async function handleAcceptProposal() {
    if (!proposal || !plant) return;
    setAccepting(true);
    try {
      await acceptFrequencyProposal(
        supabase,
        plantId,
        session.user.id,
        proposal
      );
      setPlant({ ...plant, watering_frequency_days: proposal.proposed_days });
      setProposal(null);
      const updated = await fetchPlantEvents(supabase, plantId);
      setEvents(updated);
    } catch {
      Alert.alert("Error", "Could not update schedule. Please try again.");
    } finally {
      setAccepting(false);
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
        xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
        xhr.setRequestHeader("apikey", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!);
        xhr.setRequestHeader("x-upsert", "false");
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.responseText}`));
        };
        xhr.onerror = () => reject(new Error("Upload network error"));
        xhr.send(formData);
      });

      const {
        data: { publicUrl },
      } = supabase.storage.from("plant-photos").getPublicUrl(fileName);

      const recentEvents = events.slice(0, 5).map((e) => ({
        event_type: e.event_type,
        created_at: e.created_at,
        notes: e.notes,
        ai_analysis: e.ai_analysis,
      }));

      const fnResp = await fetch(`${supabaseUrl}/functions/v1/analyze-plant`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          photo_url: publicUrl,
          plant: { species: plant?.species, name: plant?.name },
          previous_events: recentEvents,
        }),
      });

      if (!fnResp.ok) {
        const errText = await fnResp.text();
        throw new Error(`Analysis failed (${fnResp.status}): ${errText}`);
      }

      const analysis = (await fnResp.json()) as AIPhotoAnalysisResult;
      setAnalysisResult(analysis);
      setShowAnalysisModal(true);

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
        <BreathingMark size={64} color={colors.forest} />
      </View>
    );
  }

  if (analyzing) {
    return (
      <View style={styles.centered}>
        <BreathingMark size={64} color={colors.forest} />
        <Text style={styles.analyzingText}>Analyzing your plant…</Text>
      </View>
    );
  }

  const status = getWateringStatus(plant);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.iconButton}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <Text style={styles.iconButtonText}>←</Text>
        </Pressable>
        <Pressable
          style={styles.journalButton}
          onPress={() => navigation.navigate("PlantJournal", { plantId })}
          hitSlop={8}
        >
          <Text style={styles.journalButtonText}>Journal</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoSection}>
          <View style={styles.nameRow}>
            <Text style={styles.plantName} numberOfLines={2}>
              {plant.name}
            </Text>
            <StatusBadge status={status} />
          </View>
          {plant.species ? (
            <Text style={styles.species}>{plant.species}</Text>
          ) : null}
          {plant.location ? (
            <Text style={styles.location}>{plant.location}</Text>
          ) : null}
        </View>

        {photoStrip ? (
          <View style={styles.photoStripWrap}>
            {photoStrip.kind === "pair" ? (
              <View style={styles.photoStripRow}>
                <PhotoCell
                  uri={photoStrip.firstUrl}
                  overline="Day 1"
                  caption={photoStrip.firstLabel}
                />
                <PhotoCell
                  uri={photoStrip.lastUrl}
                  overline="Now"
                  caption={photoStrip.lastLabel}
                />
              </View>
            ) : (
              <Image
                source={{ uri: photoStrip.url }}
                style={styles.singlePhoto}
              />
            )}
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <StatCard
            value={
              careStats.avgInterval !== null ? `${careStats.avgInterval}d` : "—"
            }
            label="Avg. interval"
          />
          <StatCard
            value={`${careStats.recentCount}`}
            label="Events · 30d"
          />
          <StatCard
            value={`${careStats.daysWithPlant}`}
            label="Days together"
          />
        </View>

        {events.length > 0 && (
          <View style={styles.rhythmSection}>
            <EyebrowLabel>30-day rhythm</EyebrowLabel>
            <View style={styles.rhythmRow}>
              {Array.from({ length: RHYTHM_DAYS }).map((_, i) => {
                const daysAgo = RHYTHM_DAYS - 1 - i;
                return (
                  <View
                    key={daysAgo}
                    style={[
                      styles.rhythmDot,
                      { backgroundColor: rhythmDot(daysAgo, events) },
                    ]}
                  />
                );
              })}
            </View>
            <View style={styles.rhythmLegend}>
              <LegendDot color={colors.forest} label="watered" />
              <LegendDot color={colors.rain} label="photo" />
              <LegendDot color={colors.sage} label="other" />
            </View>
          </View>
        )}

        {proposal && !proposalDismissed ? (
          <View style={styles.proposalCard}>
            <EyebrowLabel>Schedule suggestion</EyebrowLabel>
            <Text style={styles.proposalLede}>
              Care guides say{" "}
              <Text style={styles.proposalEmphasis}>
                {proposal.current_days}
              </Text>
              ; you've found your own rhythm at{" "}
              <Text style={styles.proposalEmphasis}>
                {proposal.median_days.toFixed(1)} days
              </Text>
              .
            </Text>
            <Text style={styles.proposalMeta}>
              Median of {proposal.count} waterings · update to{" "}
              {proposal.proposed_days} days?
            </Text>
            <View style={styles.proposalConfidence}>
              <ConfidenceBar
                confidence={proposal.confidence}
                fillPercent={CONFIDENCE_TIER[proposal.confidence].fillPercent}
                errorDays={CONFIDENCE_TIER[proposal.confidence].errorDays}
              />
            </View>
            <View style={styles.proposalActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setProposalDismissed(true)}
                disabled={accepting}
              >
                <Text style={styles.secondaryButtonText}>Keep</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.primaryButton,
                  accepting && styles.buttonDisabled,
                ]}
                onPress={handleAcceptProposal}
                disabled={accepting}
              >
                {accepting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Update</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.timelineHeader}>
          <EyebrowLabel>Timeline</EyebrowLabel>
        </View>

        {events.length === 0 ? (
          <Text style={styles.emptyTimeline}>
            No events yet. Tap + Log event below to start.
          </Text>
        ) : (
          weekGroups.map((group) => (
            <View key={group.key} style={styles.weekBlock}>
              <Text style={styles.weekLabel}>{group.label}</Text>
              {group.events.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  onPressAnalysis={(a) => {
                    setAnalysisResult(a);
                    setShowAnalysisModal(true);
                  }}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable style={styles.secondaryBottom} onPress={handlePhotoCheckIn}>
          <Text style={styles.secondaryBottomText}>Photo check-in</Text>
        </Pressable>
        <Pressable
          style={styles.primaryBottom}
          onPress={() => setShowLogModal(true)}
        >
          <Text style={styles.primaryBottomText}>+ Log event</Text>
        </Pressable>
      </View>

      <Modal
        visible={showAnalysisModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAnalysisModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.analysisModalContent]}>
            {analysisResult && (
              <>
                <View style={styles.analysisModalHeader}>
                  <Text style={styles.modalTitle}>Photo analysis</Text>
                  <Pressable
                    style={styles.modalCloseButton}
                    onPress={() => setShowAnalysisModal(false)}
                    hitSlop={12}
                    accessibilityLabel="Close"
                    accessibilityRole="button"
                  >
                    <Text style={styles.modalCloseButtonText}>×</Text>
                  </Pressable>
                </View>
                <ScrollView
                  style={styles.analysisModalScroll}
                  showsVerticalScrollIndicator
                >
                  <AnalysisStatusPill status={analysisResult.status} large />
                  <Text style={styles.analysisModalObservations}>
                    {analysisResult.observations}
                  </Text>
                  {analysisResult.recommended_action ? (
                    <View style={styles.actionBox}>
                      <EyebrowLabel color={ANALYSIS_TONE.concern.text}>
                        Recommended action
                      </EyebrowLabel>
                      <Text style={styles.actionText}>
                        {analysisResult.recommended_action}
                      </Text>
                    </View>
                  ) : null}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showLogModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLogModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Log event</Text>

            <View style={styles.typePicker}>
              {EVENT_TYPES.map((type) => {
                const selected = selectedEventType === type;
                return (
                  <Pressable
                    key={type}
                    style={[
                      styles.typeOption,
                      selected && styles.typeOptionSelected,
                    ]}
                    onPress={() => setSelectedEventType(type)}
                  >
                    <EventIcon type={iconForEvent(type)} size={36} />
                    <Text
                      style={[
                        styles.typeOptionLabel,
                        selected && styles.typeOptionLabelSelected,
                      ]}
                    >
                      {EVENT_LABELS[type]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              style={styles.notesInput}
              placeholder="Notes (optional)"
              placeholderTextColor={colors.muted}
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            <View style={styles.modalActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => {
                  setShowLogModal(false);
                  setNotes("");
                  setSelectedEventType("watered");
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.primaryButton,
                  submitting && styles.buttonDisabled,
                ]}
                onPress={handleLogEvent}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PhotoCell({
  uri,
  overline,
  caption,
}: {
  uri: string;
  overline: string;
  caption: string;
}) {
  return (
    <View style={styles.photoCell}>
      <Image source={{ uri }} style={styles.photoCellImage} />
      <Text style={styles.photoOverline}>{overline}</Text>
      <Text style={styles.photoCaption}>{caption}</Text>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function AnalysisStatusPill({
  status,
  large,
}: {
  status: AnalysisStatus;
  large?: boolean;
}) {
  const tone = ANALYSIS_TONE[status];
  return (
    <View
      style={[
        styles.analysisPill,
        { backgroundColor: tone.bg },
        large && styles.analysisPillLarge,
      ]}
    >
      <View style={[styles.analysisPillDot, { backgroundColor: tone.dot }]} />
      <Text
        style={[
          styles.analysisPillText,
          { color: tone.text },
          large && styles.analysisPillTextLarge,
        ]}
      >
        {tone.label}
      </Text>
    </View>
  );
}

function EventRow({
  event,
  onPressAnalysis,
}: {
  event: PlantEvent;
  onPressAnalysis: (a: AIPhotoAnalysisResult) => void;
}) {
  const analysis = parseAnalysis(event.ai_analysis);
  return (
    <View style={styles.eventRow}>
      <EventIcon type={iconForEvent(event.event_type)} size={40} />
      <View style={styles.eventContent}>
        <View style={styles.eventHeader}>
          <Text style={styles.eventType}>{EVENT_LABELS[event.event_type]}</Text>
          <Text style={styles.eventTime}>{relativeTime(event.created_at)}</Text>
        </View>
        {event.notes ? (
          <Text style={styles.eventNotes} numberOfLines={2}>
            {event.notes}
          </Text>
        ) : null}
        {analysis ? (
          <Pressable
            style={styles.analysisInline}
            onPress={() => onPressAnalysis(analysis)}
          >
            <AnalysisStatusPill status={analysis.status} />
            <Text style={styles.analysisObservations} numberOfLines={3}>
              {analysis.observations}
            </Text>
            <Text style={styles.analysisExpandHint}>Tap to read more →</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.paper,
  },
  analyzingText: {
    fontFamily: fonts.hankenRegular,
    fontSize: 15,
    color: colors.bark,
    marginTop: spacing.base,
  },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.base,
    paddingTop: 54,
    paddingBottom: spacing.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonText: {
    fontFamily: fonts.hankenSemiBold,
    fontSize: 18,
    color: colors.forest,
    marginTop: -2,
  },
  journalButton: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  journalButtonText: {
    fontFamily: fonts.hankenSemiBold,
    fontSize: 13,
    color: colors.forest,
  },

  scroll: {
    paddingHorizontal: spacing.gutter,
    paddingBottom: 120,
  },

  infoSection: {
    marginTop: spacing.sm,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  plantName: {
    fontFamily: fonts.spectralSemiBold,
    fontSize: 26,
    lineHeight: 32,
    color: colors.ink,
    flexShrink: 1,
  },
  species: {
    fontFamily: fonts.hankenRegular,
    fontSize: 15,
    color: colors.bark,
    marginTop: 4,
  },
  location: {
    fontFamily: fonts.hankenRegular,
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },

  photoStripWrap: {
    marginTop: spacing.lg,
  },
  photoStripRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  photoCell: {
    flex: 1,
  },
  photoCellImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  photoOverline: {
    ...typography.label,
    color: colors.fern,
    marginTop: spacing.sm,
  },
  photoCaption: {
    fontFamily: fonts.monoRegular,
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  singlePhoto: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },

  statsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.gutter,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    alignItems: "center",
  },
  statValue: {
    fontFamily: fonts.monoMedium,
    fontSize: 22,
    color: colors.ink,
  },
  statLabel: {
    fontFamily: fonts.hankenRegular,
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
    textAlign: "center",
  },

  rhythmSection: {
    marginTop: spacing.gutter,
  },
  rhythmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.md,
  },
  rhythmDot: {
    flex: 1,
    height: 8,
    borderRadius: radius.full,
    maxWidth: 10,
  },
  rhythmLegend: {
    flexDirection: "row",
    gap: spacing.base,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  legendLabel: {
    fontFamily: fonts.hankenRegular,
    fontSize: 11,
    color: colors.muted,
  },

  proposalCard: {
    marginTop: spacing.gutter,
    backgroundColor: colors.eventBgFrequency,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.sageBorder,
    padding: spacing.base,
  },
  proposalLede: {
    fontFamily: fonts.spectralRegular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
    marginTop: spacing.sm,
  },
  proposalEmphasis: {
    fontFamily: fonts.spectralSemiBold,
    color: colors.forest,
  },
  proposalMeta: {
    fontFamily: fonts.hankenRegular,
    fontSize: 13,
    color: colors.bark,
    marginTop: spacing.sm,
  },
  proposalConfidence: {
    marginTop: spacing.md,
  },
  proposalActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.base,
  },

  primaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.forest,
    alignItems: "center",
  },
  primaryButtonText: {
    fontFamily: fonts.hankenSemiBold,
    fontSize: 14,
    color: "#fff",
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.sageBorder,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontFamily: fonts.hankenSemiBold,
    fontSize: 14,
    color: colors.forest,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  timelineHeader: {
    marginTop: spacing.gutter,
    marginBottom: spacing.sm,
  },
  emptyTimeline: {
    fontFamily: fonts.hankenRegular,
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    paddingVertical: spacing.xl,
  },
  weekBlock: {
    marginTop: spacing.base,
  },
  weekLabel: {
    ...typography.label,
    color: colors.bark,
    marginBottom: spacing.sm,
  },

  eventRow: {
    flexDirection: "row",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: spacing.md,
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
    fontFamily: fonts.hankenSemiBold,
    fontSize: 15,
    color: colors.ink,
  },
  eventTime: {
    fontFamily: fonts.monoRegular,
    fontSize: 11,
    color: colors.muted,
  },
  eventNotes: {
    fontFamily: fonts.hankenRegular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.bark,
    marginTop: 4,
  },

  analysisInline: {
    marginTop: spacing.sm,
    backgroundColor: colors.mist,
    borderRadius: radius.md,
    padding: spacing.md - 2,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 6,
  },
  analysisObservations: {
    fontFamily: fonts.hankenRegular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.bark,
  },
  analysisExpandHint: {
    fontFamily: fonts.hankenSemiBold,
    fontSize: 11,
    color: colors.fern,
    textAlign: "right",
  },

  analysisPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },
  analysisPillLarge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: spacing.md,
  },
  analysisPillDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
  },
  analysisPillText: {
    fontFamily: fonts.hankenSemiBold,
    fontSize: 11,
  },
  analysisPillTextLarge: {
    fontSize: 13,
  },

  bottomBar: {
    position: "absolute",
    bottom: 32,
    left: spacing.gutter,
    right: spacing.gutter,
    flexDirection: "row",
    gap: spacing.md,
  },
  secondaryBottom: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.sageBorder,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryBottomText: {
    fontFamily: fonts.hankenSemiBold,
    fontSize: 14,
    color: colors.forest,
  },
  primaryBottom: {
    flex: 1,
    backgroundColor: colors.forest,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBottomText: {
    fontFamily: fonts.hankenSemiBold,
    fontSize: 14,
    color: "#fff",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(38,39,32,0.45)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.gutter,
    paddingBottom: spacing.xxl,
  },
  modalTitle: {
    fontFamily: fonts.spectralSemiBold,
    fontSize: 20,
    color: colors.ink,
  },

  analysisModalContent: {
    maxHeight: "80%",
  },
  analysisModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.wash,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseButtonText: {
    fontFamily: fonts.hankenSemiBold,
    fontSize: 22,
    color: colors.forest,
    marginTop: -2,
  },
  analysisModalScroll: {
    flexGrow: 0,
  },
  analysisModalObservations: {
    fontFamily: fonts.hankenRegular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
    marginBottom: spacing.base,
  },
  actionBox: {
    backgroundColor: colors.waterTodayBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: 4,
  },
  actionText: {
    fontFamily: fonts.hankenRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.waterTodayText,
  },

  typePicker: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.base,
  },
  typeOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    gap: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  typeOptionSelected: {
    backgroundColor: colors.wash,
    borderColor: colors.sageBorder,
  },
  typeOptionLabel: {
    fontFamily: fonts.hankenRegular,
    fontSize: 11,
    color: colors.bark,
  },
  typeOptionLabelSelected: {
    fontFamily: fonts.hankenSemiBold,
    color: colors.forest,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: fonts.hankenRegular,
    fontSize: 15,
    color: colors.ink,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: spacing.base,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
});
