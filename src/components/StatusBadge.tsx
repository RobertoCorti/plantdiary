import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, radius, STATUS } from "../lib/theme";
import type { WateringStatus } from "../types";

type Props = {
  status: WateringStatus;
  label?: string;
};

export function StatusBadge({ status, label }: Props) {
  const tone = STATUS[status];
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <View style={[styles.dot, { backgroundColor: tone.dot }]} />
      <Text style={[styles.label, { color: tone.text }]}>{label ?? tone.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
  },
  label: {
    fontSize: 11,
    fontFamily: fonts.hankenSemiBold,
  },
});
