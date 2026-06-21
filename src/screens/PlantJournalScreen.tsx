import { useCallback, useEffect, useMemo, useState } from "react";
import {
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
import type { Milestone, Plant, PlantEvent } from "../types";
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
      events
        .filter((e) => e.photo_url)
        .map((e) => ({
          id: e.id,
          uri: e.photo_url!,
          date: e.created_at,
        })),
    [events]
  );

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

        <View style={styles.narrativeCard}>
          <EyebrowLabel>This month</EyebrowLabel>
          <Text style={styles.narrativeBody}>
            Monthly narratives will appear here once {plant.name} has a full
            month of events to draw from. A short, calm summary — what changed,
            what stayed steady.
          </Text>
        </View>

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
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  narrativeBody: {
    fontFamily: fonts.spectralItalic,
    fontSize: 16,
    lineHeight: 24,
    color: colors.bark,
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
