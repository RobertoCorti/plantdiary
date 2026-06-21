import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../lib/theme";
import type { PlantEvent } from "../types";

type EventType = PlantEvent["event_type"];

type Props = {
  type: EventType;
  size?: number;
};

// Emoji fallback — the design system asks for SVG glyphs, but react-native-svg
// requires a native rebuild of the dev client. The colored circle + glyph
// pattern still reads cleanly. Swap renderGlyph() back to <Svg> when the dev
// client is rebuilt with react-native-svg compiled in.
const ICON_STYLE: Record<EventType, { bg: string; glyph: string }> = {
  watered: { bg: colors.eventBgWatered, glyph: "💧" },
  fertilized: { bg: colors.eventBgFertilized, glyph: "🌿" },
  photo: { bg: colors.eventBgPhoto, glyph: "📷" },
  observation: { bg: colors.eventBgObservation, glyph: "👁" },
  repotted: { bg: colors.eventBgRepotted, glyph: "🪴" },
  frequency_updated: { bg: colors.eventBgFrequency, glyph: "📊" },
};

export function EventIcon({ type, size = 36 }: Props) {
  const style = ICON_STYLE[type];
  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: radius.full,
          backgroundColor: style.bg,
        },
      ]}
    >
      <Text style={[styles.glyph, { fontSize: Math.round(size * 0.5) }]}>
        {style.glyph}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
  },
  glyph: {
    lineHeight: undefined,
  },
});
