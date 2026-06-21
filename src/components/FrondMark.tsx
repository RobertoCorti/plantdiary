import React from "react";
import Svg, { G, Path } from "react-native-svg";
import { colors } from "../lib/theme";

// The brand mark as a single stroked polyline. Exported so motion components
// (SplashReveal in particular) can build their own animated Path against the
// same source of truth.
export const FROND_PATH =
  "M33.5 32 L34.03 33.17 L33.59 34.75 L32 36.01 L29.58 36.2 L27.07 34.85 " +
  "L25.47 32 L25.63 28.32 L27.9 24.9 L32 22.96 L36.94 23.45 L41.28 26.64 " +
  "L43.55 32 L42.73 38.2 L38.62 43.46 L32 46.07 L24.55 44.91 L18.36 39.87 " +
  "L15.42 32 L16.92 23.29 L22.87 16.19 L32 12.9 L41.97 14.73 L50 21.61 " +
  "L53.62 32 L61 32";

export const FROND_VIEWBOX = 64;

type Props = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function FrondMark({
  size = 64,
  color = colors.forest,
  strokeWidth = 5.4,
}: Props) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${FROND_VIEWBOX} ${FROND_VIEWBOX}`}>
      <G rotation={90} origin="32, 32">
        <Path
          d={FROND_PATH}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </G>
    </Svg>
  );
}
