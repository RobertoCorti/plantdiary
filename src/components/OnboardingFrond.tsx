import { StyleSheet } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";
import { FROND_PATH, FROND_PATH_LENGTH, FROND_VIEWBOX } from "./FrondMark";

const AnimatedPath = Animated.createAnimatedComponent(Path);

type Props = { size?: number; color?: string };

export function OnboardingFrond({ size = 104, color = "#F1EFE4" }: Props) {
  const reduceMotion = useReducedMotion();
  const dashOffset = useSharedValue(reduceMotion ? 0 : FROND_PATH_LENGTH);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      dashOffset.value = 0;
      scale.value = 1;
      return;
    }
    dashOffset.value = withTiming(0, {
      duration: 2400,
      easing: Easing.out(Easing.ease),
    });
    scale.value = withDelay(
      2400,
      withRepeat(
        withTiming(1.045, {
          duration: 2100,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      )
    );
  }, [dashOffset, reduceMotion, scale]);

  const pathProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));
  const markStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.mark, markStyle]} accessible={false}>
      <Svg width={size} height={size} viewBox={`0 0 ${FROND_VIEWBOX} ${FROND_VIEWBOX}`}>
        <G rotation={90} origin="32, 32">
          <AnimatedPath
            d={FROND_PATH}
            stroke={color}
            strokeWidth={5.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={`${FROND_PATH_LENGTH} ${FROND_PATH_LENGTH}`}
            animatedProps={pathProps}
          />
        </G>
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({ mark: { alignItems: "center", justifyContent: "center" } });
