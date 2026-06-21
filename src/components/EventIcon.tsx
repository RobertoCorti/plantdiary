import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors, radius } from "../lib/theme";
import type { PlantEvent } from "../types";

type EventType = PlantEvent["event_type"];

type Props = {
  type: EventType;
  size?: number;
};

type IconStyle = { bg: string; fg: string };

const ICON_STYLE: Record<EventType, IconStyle> = {
  watered: { bg: colors.eventBgWatered, fg: colors.rain },
  fertilized: { bg: colors.eventBgFertilized, fg: colors.checkText },
  photo: { bg: colors.eventBgPhoto, fg: colors.fern },
  observation: { bg: colors.eventBgObservation, fg: colors.fern },
  repotted: { bg: colors.eventBgRepotted, fg: colors.waterTodayText },
  frequency_updated: { bg: colors.eventBgFrequency, fg: colors.fern },
};

export function EventIcon({ type, size = 36 }: Props) {
  const style = ICON_STYLE[type];
  const inner = Math.round(size * 0.55);
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: radius.full, backgroundColor: style.bg },
      ]}
    >
      <Svg width={inner} height={inner} viewBox="0 0 24 24" fill="none">
        {renderGlyph(type, style.fg)}
      </Svg>
    </View>
  );
}

function renderGlyph(type: EventType, color: string) {
  const stroke = { stroke: color, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (type) {
    case "watered":
      return (
        <Path
          d="M12 3 C 8 9, 6 12, 6 15 a 6 6 0 0 0 12 0 C 18 12, 16 9, 12 3 Z"
          fill={color}
          fillOpacity={0.15}
          {...stroke}
        />
      );
    case "fertilized":
      return (
        <>
          <Path
            d="M5 19 C 5 11, 11 5, 19 5 C 19 13, 13 19, 5 19 Z"
            fill={color}
            fillOpacity={0.15}
            {...stroke}
          />
          <Path d="M19 5 L 8 16" {...stroke} />
        </>
      );
    case "photo":
      return (
        <>
          <Rect
            x="3"
            y="6.5"
            width="18"
            height="13"
            rx="2"
            fill={color}
            fillOpacity={0.1}
            {...stroke}
          />
          <Path d="M8 6.5 L 9.5 4 L 14.5 4 L 16 6.5" {...stroke} />
          <Circle cx="12" cy="13" r="3.5" {...stroke} />
        </>
      );
    case "observation":
      return (
        <>
          <Path
            d="M2 12 C 5 7, 8.5 5, 12 5 C 15.5 5, 19 7, 22 12 C 19 17, 15.5 19, 12 19 C 8.5 19, 5 17, 2 12 Z"
            fill={color}
            fillOpacity={0.1}
            {...stroke}
          />
          <Circle cx="12" cy="12" r="3" fill={color} fillOpacity={0.4} {...stroke} />
        </>
      );
    case "repotted":
      return (
        <>
          <Path d="M12 11 C 9 9, 8 6, 9 4 C 11 5, 12 7, 12 11" fill={color} fillOpacity={0.2} {...stroke} />
          <Path d="M12 11 C 15 9.5, 16 7, 15.5 5 C 13.5 6, 12 8, 12 11" fill={color} fillOpacity={0.2} {...stroke} />
          <Path d="M5 11 L 19 11 L 17 20 L 7 20 Z" fill={color} fillOpacity={0.1} {...stroke} />
        </>
      );
    case "frequency_updated":
      return (
        <>
          <Path d="M4 18 L 4 6" {...stroke} />
          <Path d="M4 18 L 20 18" {...stroke} />
          <Rect x="7" y="12" width="3" height="6" fill={color} fillOpacity={0.25} {...stroke} />
          <Rect x="12" y="9" width="3" height="9" fill={color} fillOpacity={0.25} {...stroke} />
          <Rect x="17" y="14" width="3" height="4" fill={color} fillOpacity={0.25} {...stroke} />
        </>
      );
  }
}

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
  },
});
