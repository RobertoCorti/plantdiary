import { useCallback, useEffect, useMemo, useState } from "react";
import {
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
import { supabase } from "../lib/supabase";
import { fetchPlantEvents } from "../lib/events";
import { computeJournalStats, computeMilestones } from "../lib/journal";
import {
  colors,
  fonts,
  radius,
  spacing,
  typography,
} from "../lib/theme";
import { EyebrowLabel } from "../components/EyebrowLabel";
import { EventIcon, iconForMilestone } from "../components/EventIcon";
import { BreathingMark } from "../components/BreathingMark";
import type { JournalEntry, Milestone, Plant, PlantEvent } from "../types";
import type { RootStackParamList } from "../../App";

type Props = {
  session: Session;
  plantId: string;
  navigation: NativeStackNavigationProp<RootStackParamList, "PlantJournal">;
};

const THUMB_SIZE = 132;
const THUMB_GAP = 10;

function shortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function fullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Period keys ('YYYY-MM') are UTC-based (from the ISO timestamp prefix), so
// label them in UTC too — keeps the client and the edge function in agreement
// about which month an event belongs to.
function monthLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function PlantJournalScreen({
  session,
  plantId,
  navigation,
}: Props) {
  const [plant, setPlant] = useState<Plant | null>(null);
  const [events, setEvents] = useState<PlantEvent[]>([]);
  const [entries, setEntries] = useState<Record<string, JournalEntry>>({});
  const [generatingPeriod, setGeneratingPeriod] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [plantResult, eventsResult, entriesResult] = await Promise.all([
        supabase.from("plants").select("*").eq("id", plantId).single(),
        fetchPlantEvents(supabase, plantId),
        supabase
          .from("journal_entries")
          .select("period, narrative, created_at")
          .eq("plant_id", plantId),
      ]);
      if (plantResult.data) setPlant(plantResult.data as Plant);
      setEvents(eventsResult);
      const entryMap: Record<string, JournalEntry> = {};
      for (const row of (entriesResult.data ?? []) as JournalEntry[]) {
        entryMap[row.period] = row;
      }
      setEntries(entryMap);
    } finally {
      setLoading(false);
    }
  }, [plantId]);

  const handleGenerate = useCallback(
    async (period: string) => {
      setGeneratingPeriod(period);
      try {
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
        const resp = await fetch(`${supabaseUrl}/functions/v1/generate-journal`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ plant_id: plantId, period }),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`Generation failed (${resp.status}): ${errText}`);
        }
        const entry = (await resp.json()) as JournalEntry;
        setEntries((prev) => ({ ...prev, [period]: entry }));
      } catch (err) {
        Alert.alert(
          "Couldn't write this entry",
          err instanceof Error ? err.message : "Please try again."
        );
      } finally {
        setGeneratingPeriod(null);
      }
    },
    [plantId, session.access_token]
  );

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
      events
        .filter((e) => e.photo_url)
        .map((e) => ({
          id: e.id,
          uri: e.photo_url!,
          date: e.created_at,
        })),
    [events]
  );
  // Months that actually have events, newest first. The 'YYYY-MM' key comes
  // straight from the UTC ISO prefix so it lines up with the edge function.
  const periods = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) set.add(e.created_at.slice(0, 7));
    return Array.from(set).sort().reverse();
  }, [events]);

  if (loading || !plant || !stats) {
    return (
      <View style={styles.centered}>
        <BreathingMark size={64} color={colors.forest} />
      </View>
    );
  }

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
        <Text style={styles.topTitle}>Journal</Text>
        <View style={styles.iconButtonSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.plantName}>{plant.name}</Text>
        <Text style={styles.tenureLine}>
          {stats.daysWithPlant} {stats.daysWithPlant === 1 ? "day" : "days"}{" "}
          together · since {fullDate(plant.created_at)}
        </Text>

        <View style={styles.sectionHeaderFirst}>
          <EyebrowLabel>Story</EyebrowLabel>
        </View>
        {periods.length === 0 ? (
          <Text style={styles.emptyText}>
            Monthly stories appear here once {plant.name} has logged events to
            draw from — a short, calm summary of what changed and what stayed
            steady.
          </Text>
        ) : (
          periods.map((period) => (
            <View key={period} style={styles.narrativeCard}>
              <Text style={styles.monthLabel}>{monthLabel(period)}</Text>
              {entries[period] ? (
                <>
                  <Text style={styles.narrativeBody}>
                    {entries[period].narrative}
                  </Text>
                  <Text style={styles.writtenLine}>
                    Written {fullDate(entries[period].created_at)}
                  </Text>
                </>
              ) : generatingPeriod === period ? (
                <View style={styles.generatingRow}>
                  <BreathingMark size={28} color={colors.forest} />
                  <Text style={styles.generatingText}>
                    Writing this month's story…
                  </Text>
                </View>
              ) : (
                <Pressable
                  style={styles.generateButton}
                  onPress={() => handleGenerate(period)}
                  disabled={generatingPeriod !== null}
                >
                  <Text style={styles.generateButtonText}>
                    Generate this month's story
                  </Text>
                </Pressable>
              )}
            </View>
          ))
        )}

        <View style={styles.statsRow}>
          <StatCell value={stats.waterings} label="waterings" />
          <Divider />
          <StatCell value={stats.fertilizings} label="feedings" />
          <Divider />
          <StatCell value={stats.photos} label="photos" />
          <Divider />
          <StatCell
            value={stats.scaresSurvived}
            label={stats.scaresSurvived === 1 ? "recovery" : "recoveries"}
          />
        </View>

        <View style={styles.sectionHeader}>
          <EyebrowLabel>Photos</EyebrowLabel>
        </View>
        {photos.length === 0 ? (
          <Text style={styles.emptyText}>
            No photos yet. Check-ins from the profile show up here.
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoStrip}
          >
            {photos.map((p) => (
              <View key={p.id} style={styles.photoTile}>
                <Image source={{ uri: p.uri }} style={styles.photoImage} />
                <View style={styles.photoDateBadge}>
                  <Text style={styles.photoDateText}>{shortDate(p.date)}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.sectionHeader}>
          <EyebrowLabel>Milestones</EyebrowLabel>
        </View>
        {milestones.length === 0 ? (
          <Text style={styles.emptyText}>
            Milestones appear as {plant.name} grows — anniversaries, watering
            counts, learned schedules, and more.
          </Text>
        ) : (
          milestones.map((m) => <MilestoneRow key={m.id} milestone={m} />)
        )}
      </ScrollView>
    </View>
  );
}

function StatCell({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.statDivider} />;
}

function MilestoneRow({ milestone }: { milestone: Milestone }) {
  return (
    <View style={styles.milestoneRow}>
      <EventIcon type={iconForMilestone(milestone.kind)} size={40} />
      <View style={styles.milestoneBody}>
        <Text style={styles.milestoneTitle}>{milestone.title}</Text>
        {milestone.detail ? (
          <Text style={styles.milestoneDetail}>{milestone.detail}</Text>
        ) : null}
        <Text style={styles.milestoneDate}>{fullDate(milestone.date)}</Text>
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

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 54,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.base,
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
  iconButtonSpacer: {
    width: 36,
    height: 36,
  },
  topTitle: {
    fontFamily: fonts.hankenSemiBold,
    fontSize: 15,
    color: colors.bark,
  },

  content: {
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.xxl,
  },

  plantName: {
    fontFamily: fonts.spectralSemiBold,
    fontSize: 26,
    lineHeight: 32,
    color: colors.ink,
    marginTop: spacing.sm,
  },
  tenureLine: {
    fontFamily: fonts.monoRegular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },

  narrativeCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  monthLabel: {
    fontFamily: fonts.spectralSemiBold,
    fontSize: 17,
    lineHeight: 22,
    color: colors.ink,
  },
  narrativeBody: {
    fontFamily: fonts.spectralItalic,
    fontSize: 16,
    lineHeight: 24,
    color: colors.bark,
  },
  writtenLine: {
    fontFamily: fonts.monoRegular,
    fontSize: 11,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  generateButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.sageBorder,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.gutter,
    alignItems: "center",
  },
  generateButtonText: {
    fontFamily: fonts.hankenSemiBold,
    fontSize: 15,
    color: colors.forest,
  },
  generatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  generatingText: {
    fontFamily: fonts.hankenRegular,
    fontSize: 13,
    color: colors.muted,
  },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.mist,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginTop: spacing.base,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    gap: 2,
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
    textAlign: "center",
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.line,
  },

  sectionHeader: {
    marginTop: spacing.gutter,
    marginBottom: spacing.md,
  },
  sectionHeaderFirst: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },

  emptyText: {
    fontFamily: fonts.hankenRegular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.bark,
  },

  photoStrip: {
    gap: THUMB_GAP,
    paddingRight: spacing.gutter,
  },
  photoTile: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.wash,
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  photoDateBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(38,39,32,0.72)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  photoDateText: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    color: colors.paper,
  },

  milestoneRow: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.base - 2,
    marginBottom: spacing.sm,
  },
  milestoneBody: {
    flex: 1,
    gap: 4,
  },
  milestoneTitle: {
    fontFamily: fonts.hankenBold,
    fontSize: 15,
    color: colors.ink,
  },
  milestoneDetail: {
    fontFamily: fonts.hankenRegular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.bark,
  },
  milestoneDate: {
    ...typography.metricSm,
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
});
