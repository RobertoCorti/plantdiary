import type { TextStyle } from "react-native";
import type { WateringStatus } from "../types";

export const colors = {
  paper: "#EFEDE4",
  mist: "#FBFAF4",
  surface: "#FFFFFF",
  line: "#E3E2D5",
  bark: "#5E5D50",
  ink: "#262720",
  muted: "#908E7E",

  forest: "#33442E",
  fern: "#5A6E45",
  sage: "#9DAE85",
  wash: "#EAEDE0",
  sageBorder: "#CFD8BC",

  rain: "#4E6E76",
  slate: "#516A72",

  waterTodayText: "#9A5235",
  waterTodayBg: "#F1E3D9",
  waterTodayDot: "#B5613E",
  checkText: "#8A6A2D",
  checkBg: "#F0E8D4",
  checkDot: "#C0913E",
  thrivingText: "#46603A",
  thrivingBg: "#E6EBDA",
  thrivingDot: "#5A6E45",

  confidenceLowFill: "#C0913E",
  confidenceLowLabel: "#8A6A2D",
  confidenceModFill: "#516A72",
  confidenceModLabel: "#516A72",
  confidenceHighFill: "#46603A",
  confidenceHighLabel: "#46603A",
  confidenceTrack: "#DDE3CE",

  eventBgWatered: "#E0EAF0",
  eventBgFertilized: "#F0E8D4",
  eventBgPhoto: "#EAEDE0",
  eventBgObservation: "#EAEDE0",
  eventBgRepotted: "#F1E3D9",
  eventBgFrequency: "#F1F3E8",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  gutter: 24,
  xl: 32,
  xxl: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const fonts = {
  spectralRegular: "Spectral_400Regular",
  spectralMedium: "Spectral_500Medium",
  spectralSemiBold: "Spectral_600SemiBold",
  spectralItalic: "Spectral_400Regular_Italic",
  hankenRegular: "HankenGrotesk_400Regular",
  hankenMedium: "HankenGrotesk_500Medium",
  hankenSemiBold: "HankenGrotesk_600SemiBold",
  hankenBold: "HankenGrotesk_700Bold",
  monoRegular: "IBMPlexMono_400Regular",
  monoMedium: "IBMPlexMono_500Medium",
} as const;

type TypeToken = Pick<TextStyle, "fontFamily" | "fontSize" | "lineHeight" | "letterSpacing"> & {
  textTransform?: TextStyle["textTransform"];
};

export const typography: Record<
  | "display"
  | "title"
  | "heading"
  | "subhead"
  | "body"
  | "small"
  | "label"
  | "metric"
  | "metricSm",
  TypeToken
> = {
  display: { fontFamily: fonts.spectralMedium, fontSize: 30, lineHeight: 36 },
  title: { fontFamily: fonts.spectralSemiBold, fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: fonts.hankenSemiBold, fontSize: 19, lineHeight: 26 },
  subhead: { fontFamily: fonts.hankenSemiBold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.hankenRegular, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.hankenRegular, fontSize: 13, lineHeight: 18 },
  label: {
    fontFamily: fonts.hankenBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  metric: { fontFamily: fonts.monoMedium, fontSize: 22, lineHeight: 26 },
  metricSm: { fontFamily: fonts.monoMedium, fontSize: 13, lineHeight: 16 },
};

export const elevation = {
  flatBorder: { borderWidth: 1, borderColor: colors.line },
  raised: {
    shadowColor: "#26272014",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;

export type StatusTone = {
  label: string;
  text: string;
  bg: string;
  dot: string;
};

export const STATUS: Record<WateringStatus, StatusTone> = {
  water_today: {
    label: "Water today",
    text: colors.waterTodayText,
    bg: colors.waterTodayBg,
    dot: colors.waterTodayDot,
  },
  check: {
    label: "Check soon",
    text: colors.checkText,
    bg: colors.checkBg,
    dot: colors.checkDot,
  },
  ok: {
    label: "Thriving",
    text: colors.thrivingText,
    bg: colors.thrivingBg,
    dot: colors.thrivingDot,
  },
};

export type ConfidenceLevel = "low" | "medium" | "high";

export type ConfidenceTone = {
  bar: string;
  label: string;
  word: string;
};

export const CONFIDENCE: Record<ConfidenceLevel, ConfidenceTone> = {
  low: { bar: colors.confidenceLowFill, label: colors.confidenceLowLabel, word: "low" },
  medium: { bar: colors.confidenceModFill, label: colors.confidenceModLabel, word: "moderate" },
  high: { bar: colors.confidenceHighFill, label: colors.confidenceHighLabel, word: "high" },
};

// Loam event-icon palette. Each icon = a stroked glyph on a tinted circle,
// keyed by semantic name (not PlantEvent.event_type — events.watered maps to
// "water", events.frequency_updated to "schedule", etc). milestone and note
// aren't real event types — they're used by the journal milestone list and
// generic note markers.
export type EventIconName =
  | "water"
  | "photo"
  | "fertilize"
  | "observation"
  | "repot"
  | "schedule"
  | "milestone"
  | "note";

export type EventIconTone = { bg: string; stroke: string };

export const EVENT_ICON: Record<EventIconName, EventIconTone> = {
  water: { bg: colors.eventBgWatered, stroke: colors.rain },
  photo: { bg: colors.eventBgPhoto, stroke: colors.fern },
  fertilize: { bg: colors.eventBgFertilized, stroke: colors.checkDot },
  observation: { bg: colors.eventBgObservation, stroke: colors.fern },
  repot: { bg: colors.eventBgRepotted, stroke: colors.waterTodayDot },
  schedule: { bg: colors.eventBgFrequency, stroke: colors.forest },
  milestone: { bg: colors.thrivingBg, stroke: colors.fern },
  note: { bg: colors.eventBgObservation, stroke: colors.fern },
};
