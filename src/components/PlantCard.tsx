import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { getWateringStatus, daysSinceWatered } from "../lib/watering";
import { colors, fonts, radius, spacing, STATUS } from "../lib/theme";
import type { Plant } from "../types";
import { StatusBadge } from "./StatusBadge";

type Props = {
  plant: Plant;
  onPress?: () => void;
  onWater?: () => void;
  watering?: boolean;
};

export function PlantCard({ plant, onPress, onWater, watering = false }: Props) {
  const status = getWateringStatus(plant);
  const tone = STATUS[status];
  const days = daysSinceWatered(plant);
  const wateringLabel =
    days === null
      ? "Last watering unknown"
      : days === 0
        ? "Watered today"
        : `Last watered ${days}d ago`;

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      style={[styles.card, { borderLeftColor: tone.dot }]}
      onPress={onPress}
      disabled={!onPress}
    >
      {plant.photo_url ? (
        <Image source={{ uri: plant.photo_url }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Text style={styles.imagePlaceholderText}>🌱</Text>
        </View>
      )}
      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={styles.name}>{plant.name}</Text>
          <StatusBadge status={status} />
        </View>
        {plant.species && <Text style={styles.species}>{plant.species}</Text>}
        <Text style={styles.watered}>{wateringLabel}</Text>
      </View>
      {onWater && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Water ${plant.name}`}
          style={[styles.waterButton, watering && styles.waterButtonDisabled]}
          onPress={onWater}
          disabled={watering}
          hitSlop={8}
        >
          {watering ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.waterButtonText}>Water</Text>
          )}
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 3,
    borderRadius: radius.lg,
    flexDirection: "row",
    padding: spacing.md,
    alignItems: "center",
  },
  image: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
  },
  imagePlaceholder: {
    backgroundColor: colors.wash,
    alignItems: "center",
    justifyContent: "center",
  },
  imagePlaceholderText: { fontSize: 28 },
  info: {
    flex: 1,
    marginLeft: 14,
    justifyContent: "center",
    gap: 2,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: 2,
  },
  name: {
    fontFamily: fonts.spectralSemiBold,
    fontSize: 18,
    color: colors.ink,
    flexShrink: 1,
  },
  species: {
    fontFamily: fonts.hankenRegular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.bark,
  },
  watered: {
    fontFamily: fonts.monoRegular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
    marginTop: 2,
  },
  waterButton: {
    minWidth: 58,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.rain,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.sm,
  },
  waterButtonDisabled: { opacity: 0.6 },
  waterButtonText: {
    color: "#fff",
    fontFamily: fonts.hankenSemiBold,
    fontSize: 13,
  },
});
