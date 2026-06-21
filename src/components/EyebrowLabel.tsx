import React from "react";
import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { colors, typography } from "../lib/theme";

type Props = {
  children: string;
  color?: string;
  style?: StyleProp<TextStyle>;
};

export function EyebrowLabel({ children, color = colors.fern, style }: Props) {
  return <Text style={[styles.label, { color }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: typography.label,
});
