import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
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

const FILL_MS = 700;
const LABEL_DELAY_MS = 250;
const LABEL_MS = 450;

export function ConfidenceBar({ confidence, fillPercent, errorDays }: Props) {
  const tone = CONFIDENCE[confidence];
  const pct = clamp(fillPercent ?? PERCENT_BY_LEVEL[confidence], 0, 100);
  const right =
    errorDays !== undefined ? `${tone.word} · ±${errorDays.toFixed(1)}d` : tone.word;

  const [trackWidth, setTrackWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  const fillPx = useSharedValue<number>(0);
  const labelOpacity = useSharedValue<number>(0);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((rm) => {
      if (!cancelled) setReduceMotion(rm);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Animate once we know the track width AND each time the target % changes.
  useEffect(() => {
    if (trackWidth === 0) return;
    const target = (trackWidth * pct) / 100;
    if (reduceMotion) {
      fillPx.value = target;
      labelOpacity.value = 1;
      return;
    }
    fillPx.value = withTiming(target, {
      duration: FILL_MS,
      easing: Easing.out(Easing.ease),
    });
    labelOpacity.value = withDelay(
      LABEL_DELAY_MS,
      withTiming(1, { duration: LABEL_MS, easing: Easing.inOut(Easing.ease) })
    );
  }, [pct, trackWidth, reduceMotion, fillPx, labelOpacity]);

  const fillStyle = useAnimatedStyle(() => ({ width: fillPx.value }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: labelOpacity.value }));

  function onTrackLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    if (w !== trackWidth) setTrackWidth(w);
  }

  return (
    <View style={styles.row}>
      <Text style={styles.eyebrow}>Confidence</Text>
      <View style={styles.track} onLayout={onTrackLayout}>
        <Animated.View
          style={[styles.fill, { backgroundColor: tone.bar }, fillStyle]}
        />
      </View>
      <Animated.Text style={[styles.label, { color: tone.label }, labelStyle]}>
        {right}
      </Animated.Text>
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
