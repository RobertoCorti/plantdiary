import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { EVENT_ICON, radius, type EventIconName } from "../lib/theme";
import type { MilestoneKind, PlantEvent } from "../types";

type Props = {
  type: EventIconName;
  size?: number;
};

const VIEWBOX = 24;
const REF_CIRCLE = 56;
const REF_GLYPH = 24;
const REF_STROKE = 1.8;

// Map PlantEvent.event_type → icon name. Schedule updates (frequency_updated)
// share a single semantic icon.
export function iconForEvent(t: PlantEvent["event_type"]): EventIconName {
  switch (t) {
    case "watered":
      return "water";
    case "fertilized":
      return "fertilize";
    case "repotted":
      return "repot";
    case "frequency_updated":
      return "schedule";
    case "photo":
      return "photo";
    case "observation":
      return "observation";
  }
}

// Map journal MilestoneKind → icon name. Anniversaries and recoveries both
// read as "milestone" (the star).
export function iconForMilestone(k: MilestoneKind): EventIconName {
  switch (k) {
    case "watering":
      return "water";
    case "feeding":
      return "fertilize";
    case "repot":
      return "repot";
    case "photo":
      return "photo";
    case "schedule":
      return "schedule";
    case "anniversary":
    case "scare":
      return "milestone";
  }
}

export function EventIcon({ type, size = REF_CIRCLE }: Props) {
  const tone = EVENT_ICON[type];
  const glyphSize = Math.round((size * REF_GLYPH) / REF_CIRCLE);
  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: radius.full,
          backgroundColor: tone.bg,
        },
      ]}
    >
      <Svg width={glyphSize} height={glyphSize} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
        <Glyph type={type} stroke={tone.stroke} />
      </Svg>
    </View>
  );
}

function Glyph({ type, stroke }: { type: EventIconName; stroke: string }) {
  const props = {
    stroke,
    strokeWidth: REF_STROKE,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };
  switch (type) {
    case "water":
      return (
        <Path
          d="M12 3C12 3 6 9.5 6 14a6 6 0 0012 0c0-4.5-6-11-6-11z"
          fill={stroke}
          stroke="none"
        />
      );
    case "photo":
      return (
        <>
          <Rect x={3} y={6} width={18} height={13} rx={2} {...props} />
          <Circle cx={12} cy={12.5} r={3.2} {...props} />
          <Path d="M8 6l1.5-2h5L16 6" {...props} />
        </>
      );
    case "fertilize":
      return (
        <Path
          d="M12 4v8M12 12c0-3 2-5 5-5 0 3-2 5-5 5zM12 12c0-3-2-5-5-5 0 3 2 5 5 5zM9 20h6"
          {...props}
        />
      );
    case "observation":
      return (
        <>
          <Path
            d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"
            {...props}
          />
          <Circle cx={12} cy={12} r={2.6} {...props} />
        </>
      );
    case "repot":
      return (
        <>
          <Path
            d="M5 9h14l-1.5 9.5a1 1 0 01-1 .85H7.5a1 1 0 01-1-.85L5 9z"
            {...props}
          />
          <Path d="M4 9h16" {...props} />
          <Path d="M12 9V5.5" {...props} />
        </>
      );
    case "schedule":
      return (
        <>
          <Circle cx={12} cy={12} r={8.2} {...props} />
          <Path d="M12 7.5V12l3 2" {...props} />
        </>
      );
    case "milestone":
      return (
        <Path
          d="M12 3l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L12 16.8 7 18.2l1.2-5.6L4 8.8l5.6-.6z"
          {...props}
        />
      );
    case "note":
      return (
        <>
          <Path d="M5 4h14v16l-3-2-2 2-2-2-2 2-3-2z" {...props} />
          <Path d="M9 9h6M9 12.5h4" {...props} strokeWidth={1.6} />
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
