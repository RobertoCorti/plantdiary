import React, { useEffect } from "react";
import { AccessibilityInfo } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { FrondMark } from "./FrondMark";

type Props = {
  size?: number;
  color?: string;
};

const PERIOD_MS = 4200;
const TARGET_SCALE = 1.045;

// Idle / loading ambient. Scales the brand mark on a slow inhale-exhale loop.
// Honors reduce-motion by rendering a static FrondMark.
export function BreathingMark({ size, color }: Props) {
  const scale = useSharedValue(1);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return;
      scale.value = withRepeat(
        withTiming(TARGET_SCALE, {
          duration: PERIOD_MS / 2,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      );
    });
    return () => {
      cancelled = true;
    };
  }, [scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={style}>
      <FrondMark size={size} color={color} />
    </Animated.View>
  );
}
