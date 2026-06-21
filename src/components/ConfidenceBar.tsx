import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { CONFIDENCE, colors, fonts, radius, type ConfidenceLevel } from "../lib/theme";

type Props = {
  confidence: ConfidenceLevel;
  fillPercent: number;
  errorDays?: number;
};

const PERCENT_BY_LEVEL: Record<ConfidenceLevel, number> = {
  low: 28,
  medium: 62,
  high: 92,
};

export function ConfidenceBar({ confidence, fillPercent, errorDays }: Props) {
  const tone = CONFIDENCE[confidence];
  const pct = clamp(fillPercent ?? PERCENT_BY_LEVEL[confidence], 0, 100);
  const right =
    errorDays !== undefined ? `${tone.word} · ±${errorDays.toFixed(1)}d` : tone.word;
  return (
    <View style={styles.row}>
      <Text style={styles.eyebrow}>Confidence</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: tone.bar }]} />
      </View>
      <Text style={[styles.label, { color: tone.label }]}>{right}</Text>
    </View>
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  eyebrow: {
    fontSize: 12,
    color: colors.fern,
    fontFamily: fonts.hankenSemiBold,
  },
  track: {
    flex: 1,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: colors.confidenceTrack,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.full,
  },
  label: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
  },
});
