import React, { useEffect, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors, radius } from "../lib/theme";

const DROP_SIZE = 16;
const RIPPLE_SIZE = 22;

const FALL_FROM = -13;
const FALL_TO = 9;
const FALL_MS = 700;

const RIPPLE_DELAY_MS = 400;
const RIPPLE_MS = 900;
const RIPPLE_FROM_SCALE = 0.3;
const RIPPLE_TO_SCALE = 1.9;
const RIPPLE_PEAK_OPACITY = 0.55;

type Props = {
  // Incrementing counter — each new value plays the animation once.
  signal: number;
};

// One-shot feedback for the Water button: a droplet falls, a ripple emanates.
// Overlay the parent of the tapped Pressable; pointer-events disabled so taps
// pass through.
export function WaterTap({ signal }: Props) {
  const dropY = useSharedValue<number>(FALL_FROM);
  const dropOpacity = useSharedValue<number>(0);
  const rippleScale = useSharedValue<number>(RIPPLE_FROM_SCALE);
  const rippleOpacity = useSharedValue<number>(0);

  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((rm) => {
      if (!cancelled) setReduceMotion(rm);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (signal === 0) return; // initial mount — don't play
    if (reduceMotion) return; // honor preference

    dropY.value = FALL_FROM;
    dropOpacity.value = 0;
    rippleScale.value = RIPPLE_FROM_SCALE;
    rippleOpacity.value = 0;

    dropY.value = withTiming(FALL_TO, {
      duration: FALL_MS,
      easing: Easing.in(Easing.ease),
    });
    dropOpacity.value = withSequence(
      withTiming(1, { duration: 200, easing: Easing.inOut(Easing.ease) }),
      withDelay(
        300,
        withTiming(0, { duration: 200, easing: Easing.inOut(Easing.ease) })
      )
    );

    rippleScale.value = withDelay(
      RIPPLE_DELAY_MS,
      withTiming(RIPPLE_TO_SCALE, {
        duration: RIPPLE_MS,
        easing: Easing.out(Easing.ease),
      })
    );
    rippleOpacity.value = withDelay(
      RIPPLE_DELAY_MS,
      withSequence(
        withTiming(RIPPLE_PEAK_OPACITY, { duration: 0 }),
        withTiming(0, { duration: RIPPLE_MS, easing: Easing.out(Easing.ease) })
      )
    );
  }, [signal, reduceMotion, dropY, dropOpacity, rippleScale, rippleOpacity]);

  const dropStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dropY.value }],
    opacity: dropOpacity.value,
  }));
  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rippleScale.value }],
    opacity: rippleOpacity.value,
  }));

  return (
    <View pointerEvents="none" style={styles.layer}>
      <Animated.View style={[styles.ripple, rippleStyle]} />
      <Animated.View style={[styles.drop, dropStyle]}>
        <Svg width={DROP_SIZE} height={DROP_SIZE} viewBox="0 0 24 24">
          <Path
            d="M12 3C12 3 6 9.5 6 14a6 6 0 0012 0c0-4.5-6-11-6-11z"
            fill={colors.rain}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  drop: {
    position: "absolute",
  },
  ripple: {
    position: "absolute",
    width: RIPPLE_SIZE,
    height: RIPPLE_SIZE,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.rain,
  },
});
