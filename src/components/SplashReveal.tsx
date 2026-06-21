import React, { useEffect } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { FROND_PATH, FROND_VIEWBOX } from "./FrondMark";
import { fonts } from "../lib/theme";

const FOREST = "#2B3926";
const CREAM = "#F1EFE4";

const MARK_SIZE = 132;
const STROKE = 5.4;
const PATH_LENGTH = 100;

const DRAW_MS = 1800;
const WORD_DELAY_MS = 1400;
const WORD_MS = 600;
const HOLD_MS = 600;
const TOTAL_MS = WORD_DELAY_MS + WORD_MS + HOLD_MS;
const REDUCE_MOTION_HOLD_MS = 500;

const EASE = Easing.inOut(Easing.ease);

const AnimatedPath = Animated.createAnimatedComponent(Path);

type Props = {
  onDone: () => void;
};

// Single-play app-launch reveal: the frond strokes on, then "PlantDiary"
// settles up beneath it, ~3s total. Calls onDone when finished so App.tsx can
// flip to the navigator.
export function SplashReveal({ onDone }: Props) {
  const dashOffset = useSharedValue<number>(PATH_LENGTH);
  const wordOpacity = useSharedValue<number>(0);
  const wordY = useSharedValue<number>(7);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        dashOffset.value = 0;
        wordOpacity.value = 1;
        wordY.value = 0;
        timer = setTimeout(onDone, REDUCE_MOTION_HOLD_MS);
        return;
      }
      dashOffset.value = withTiming(0, { duration: DRAW_MS, easing: EASE });
      wordOpacity.value = withDelay(
        WORD_DELAY_MS,
        withTiming(1, { duration: WORD_MS, easing: EASE })
      );
      wordY.value = withDelay(
        WORD_DELAY_MS,
        withTiming(0, { duration: WORD_MS, easing: EASE })
      );
      timer = setTimeout(onDone, TOTAL_MS);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [dashOffset, wordOpacity, wordY, onDone]);

  const pathProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  const wordStyle = useAnimatedStyle(() => ({
    opacity: wordOpacity.value,
    transform: [{ translateY: wordY.value }],
  }));

  return (
    <View style={styles.container}>
      <Svg
        width={MARK_SIZE}
        height={MARK_SIZE}
        viewBox={`0 0 ${FROND_VIEWBOX} ${FROND_VIEWBOX}`}
      >
        <G rotation={90} origin="32, 32">
          {/* pathLength normalizes total path to 100 units so dashoffset can
              animate 100→0 over a single percentage scale. The prop is
              SVG-spec but missing from react-native-svg's type defs. */}
          <AnimatedPath
            d={FROND_PATH}
            stroke={CREAM}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={`${PATH_LENGTH} ${PATH_LENGTH}`}
            animatedProps={pathProps}
            {...({ pathLength: PATH_LENGTH } as object)}
          />
        </G>
      </Svg>
      <Animated.Text style={[styles.wordmark, wordStyle]}>
        PlantDiary
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FOREST,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    marginTop: 24,
    fontFamily: fonts.spectralSemiBold,
    fontSize: 30,
    color: CREAM,
    letterSpacing: 0.5,
  },
});
