import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated as NativeAnimated,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Reanimated, {
  Easing as ReanimatedEasing,
  FadeInUp,
  FadeOut,
  useReducedMotion,
} from "react-native-reanimated";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import {
  completeOnboarding,
  saveOnboardingProgress,
  type OnboardingState,
  type OnboardingStep,
} from "../lib/onboarding";
import { colors, fonts, radius, spacing } from "../lib/theme";
import type { Plant } from "../types";
import { OnboardingFrond } from "../components/OnboardingFrond";
import { EventIcon } from "../components/EventIcon";
import { EyebrowLabel } from "../components/EyebrowLabel";
import { PlantCard } from "../components/PlantCard";
import AddPlantScreen from "./AddPlantScreen";

type Props = {
  session: Session;
  initialState: OnboardingState;
  onFinished: () => void;
};

const INTRO_STEPS = ["premise", "schedule", "diary"] as const;

export default function OnboardingScreen({ session, initialState, onFinished }: Props) {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState<OnboardingStep>(initialState.step);
  const [plant, setPlant] = useState<Plant | null>(null);
  const [recoveryError, setRecoveryError] = useState(false);
  const [recoveryAttempt, setRecoveryAttempt] = useState(0);
  const [addingAnother, setAddingAnother] = useState(false);

  useEffect(() => {
    if (step !== "done" || !initialState.plantId || plant) return;
    let active = true;
    supabase
      .from("plants")
      .select("*")
      .eq("id", initialState.plantId)
      .single()
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) setRecoveryError(true);
        else setPlant(data as Plant);
      });
    return () => {
      active = false;
    };
  }, [initialState.plantId, plant, recoveryAttempt, step]);

  useEffect(() => {
    if (step === "done" && !initialState.plantId && !plant) setStep("plant");
  }, [initialState.plantId, plant, step]);

  async function advance(next: OnboardingStep) {
    setStep(next);
    await saveOnboardingProgress(supabase, session.user.id, next, plant?.id ?? null);
  }

  async function finish(plantId: string | null = plant?.id ?? null) {
    await completeOnboarding(supabase, session.user.id, plantId);
    onFinished();
  }

  if (addingAnother) {
    return (
      <PhaseTransition phase="add-another" reduceMotion={reduceMotion}>
        <AddPlantScreen
          session={session}
          onPlantAdded={() => onFinished()}
          onClose={() => onFinished()}
        />
      </PhaseTransition>
    );
  }

  if (step === "welcome") {
    return (
      <PhaseTransition phase="welcome" reduceMotion={reduceMotion}>
        <WelcomeScreen onStart={() => advance("premise")} onSkip={() => finish(null)} />
      </PhaseTransition>
    );
  }

  if (INTRO_STEPS.includes(step as (typeof INTRO_STEPS)[number])) {
    return (
      <PhaseTransition phase="intro" reduceMotion={reduceMotion}>
        <IntroPager
          initialIndex={INTRO_STEPS.indexOf(step as (typeof INTRO_STEPS)[number])}
          onStep={(next) => advance(next)}
          onFinished={() => advance("plant")}
          onSkip={() => finish(null)}
        />
      </PhaseTransition>
    );
  }

  if (step === "plant") {
    return (
      <PhaseTransition phase="plant" reduceMotion={reduceMotion}>
        <AddPlantScreen
          session={session}
          mode="onboarding"
          onPlantAdded={async (savedPlant) => {
            setPlant(savedPlant);
            await saveOnboardingProgress(
              supabase,
              session.user.id,
              "done",
              savedPlant.id
            );
            setStep("done");
          }}
          onClose={(savedPlant) => finish(savedPlant?.id ?? null)}
        />
      </PhaseTransition>
    );
  }

  if (!plant) {
    return (
      <PhaseTransition phase="done" reduceMotion={reduceMotion}>
        <SafeAreaView style={styles.screen}>
          <View style={styles.recovery}>
            {recoveryError ? (
              <>
                <Text style={styles.title}>Your plant is saved.</Text>
                <Text style={styles.body}>
                  We couldn't reload it just now. You can continue to Today safely.
                </Text>
                <View style={styles.recoveryAction}>
                  <PrimaryButton
                    label="Try again"
                    onPress={() => {
                      setRecoveryError(false);
                      setRecoveryAttempt((value) => value + 1);
                    }}
                  />
                </View>
                <PrimaryButton label="Go to Today" onPress={() => finish(initialState.plantId)} />
              </>
            ) : (
              <ActivityIndicator color={colors.forest} />
            )}
          </View>
        </SafeAreaView>
      </PhaseTransition>
    );
  }

  return (
    <PhaseTransition phase="done" reduceMotion={reduceMotion}>
      <DoneScreen
        plant={plant}
        onToday={() => finish(plant.id)}
        onAddAnother={async () => {
          await completeOnboarding(supabase, session.user.id, plant.id);
          setAddingAnother(true);
        }}
      />
    </PhaseTransition>
  );
}

function PhaseTransition({
  phase,
  reduceMotion,
  children,
}: {
  phase: string;
  reduceMotion: boolean;
  children: ReactNode;
}) {
  const hasMounted = useRef(false);
  const shouldAnimate = hasMounted.current && !reduceMotion;

  useEffect(() => {
    hasMounted.current = true;
  }, []);

  const entering = shouldAnimate
    ? FadeInUp.duration(1040)
        .delay(150)
        .easing(ReanimatedEasing.bezier(0.22, 1, 0.36, 1))
        .withInitialValues({ opacity: 0, transform: [{ translateY: 3 }] })
    : undefined;
  const exiting = reduceMotion
    ? undefined
    : FadeOut.duration(450).easing(ReanimatedEasing.bezier(0.22, 1, 0.36, 1));

  return (
    <View style={styles.phaseHost}>
      <Reanimated.View
        key={phase}
        entering={entering}
        exiting={exiting}
        style={styles.phaseScreen}
      >
        {children}
      </Reanimated.View>
    </View>
  );
}

function WelcomeScreen({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  const reduceMotion = useReducedMotion();
  const wordEntrance = reduceMotion ? undefined : FadeInUp.delay(1500).duration(600);
  const taglineEntrance = reduceMotion ? undefined : FadeInUp.delay(1750).duration(600);
  return (
    <SafeAreaView style={styles.welcome}>
      <StatusBar style="light" />
      <View style={styles.welcomeCenter}>
        <OnboardingFrond />
        <Reanimated.Text entering={wordEntrance} style={styles.wordmark}>PlantDiary</Reanimated.Text>
        <Reanimated.Text entering={taglineEntrance} style={styles.tagline}>
          GROW · OBSERVE · LEARN
        </Reanimated.Text>
      </View>
      <View>
        <Text style={styles.welcomeCopy}>
          Your account is ready.{"\n"}Here's what it does.
        </Text>
        <PrimaryButton label="Get started" onPress={onStart} light />
        <GhostButton label="Skip the tour" onPress={onSkip} dark />
      </View>
    </SafeAreaView>
  );
}

function IntroPager({
  initialIndex,
  onStep,
  onFinished,
  onSkip,
}: {
  initialIndex: number;
  onStep: (step: OnboardingStep) => void;
  onFinished: () => void;
  onSkip: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(initialIndex);
  const [incomingIndex, setIncomingIndex] = useState<number | null>(null);
  const transitioning = useRef(false);
  const outgoingOpacity = useRef(new NativeAnimated.Value(1)).current;
  const incomingOpacity = useRef(new NativeAnimated.Value(0)).current;
  const incomingOffset = useRef(new NativeAnimated.Value(3)).current;
  const titleOpacity = useRef(new NativeAnimated.Value(0)).current;
  const titleOffset = useRef(new NativeAnimated.Value(7)).current;
  const bodyOpacity = useRef(new NativeAnimated.Value(0)).current;
  const bodyOffset = useRef(new NativeAnimated.Value(7)).current;
  const transitionAnimation = useRef<NativeAnimated.CompositeAnimation | null>(null);
  const calmEase = Easing.bezier(0.22, 1, 0.36, 1);

  useEffect(() => {
    return () => transitionAnimation.current?.stop();
  }, []);

  function goTo(next: number) {
    if (transitioning.current || next < 0) return;
    if (next >= INTRO_STEPS.length) {
      onFinished();
      return;
    }
    if (reduceMotion) {
      setIndex(next);
      onStep(INTRO_STEPS[next]);
      return;
    }

    transitioning.current = true;
    outgoingOpacity.setValue(1);
    incomingOpacity.setValue(0);
    incomingOffset.setValue(3);
    titleOpacity.setValue(0);
    titleOffset.setValue(7);
    bodyOpacity.setValue(0);
    bodyOffset.setValue(7);
    setIncomingIndex(next);

    requestAnimationFrame(() => {
      transitionAnimation.current = NativeAnimated.parallel([
        NativeAnimated.timing(outgoingOpacity, {
          toValue: 0,
          duration: 450,
          easing: calmEase,
          useNativeDriver: true,
        }),
        NativeAnimated.timing(incomingOpacity, {
          toValue: 1,
          duration: 750,
          delay: 150,
          easing: calmEase,
          useNativeDriver: true,
        }),
        NativeAnimated.timing(incomingOffset, {
          toValue: 0,
          duration: 900,
          delay: 150,
          easing: calmEase,
          useNativeDriver: true,
        }),
        NativeAnimated.timing(titleOpacity, {
          toValue: 1,
          duration: 760,
          delay: 330,
          easing: calmEase,
          useNativeDriver: true,
        }),
        NativeAnimated.timing(titleOffset, {
          toValue: 0,
          duration: 760,
          delay: 330,
          easing: calmEase,
          useNativeDriver: true,
        }),
        NativeAnimated.timing(bodyOpacity, {
          toValue: 1,
          duration: 760,
          delay: 430,
          easing: calmEase,
          useNativeDriver: true,
        }),
        NativeAnimated.timing(bodyOffset, {
          toValue: 0,
          duration: 760,
          delay: 430,
          easing: calmEase,
          useNativeDriver: true,
        }),
      ]);
      transitionAnimation.current.start(({ finished }) => {
        if (finished) {
          setIndex(next);
          onStep(INTRO_STEPS[next]);
        }
        setIncomingIndex(null);
        outgoingOpacity.setValue(1);
        transitioning.current = false;
      });
    });
  }

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx <= -45) goTo(index + 1);
      else if (gesture.dx >= 45) goTo(index - 1);
    },
  });

  const pages = [
    {
      art: <PremiseArt />,
      title: <>Your light, your pot,{"\n"}your habits.</>,
      body: <>A care label is an average of houses that aren't yours. PlantDiary starts from what you actually do and adjusts from there.</>,
    },
    {
      art: <ScheduleArt />,
      title: <>Your diary helps shape{"\n"}your care.</>,
      body: <>PlantDiary looks for patterns in the waterings you log. When they suggest a different schedule, it proposes a change. You decide whether to use it.</>,
    },
    {
      art: <DiaryArt />,
      title: <>Everything you log{"\n"}becomes a story.</>,
      body: <>Waterings, photos, the day a leaf opened. The same entries that teach the model give you something worth looking back at.</>,
    },
  ];

  const currentPage = pages[index];
  const nextPage = incomingIndex === null ? null : pages[incomingIndex];

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.progressHeader}>
        <View
          style={styles.progressPills}
          accessible
          accessibilityLabel={`Step ${index + 1} of 3`}
        >
          {INTRO_STEPS.map((item, itemIndex) => (
            <View
              key={item}
              style={[styles.progressPill, itemIndex === index && styles.progressPillActive]}
            />
          ))}
        </View>
        <Pressable style={styles.headerTap} onPress={onSkip} accessibilityRole="button">
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>
      <View style={styles.introViewport} {...panResponder.panHandlers}>
        <IntroPage
          art={currentPage.art}
          title={currentPage.title}
          containerStyle={{ opacity: outgoingOpacity }}
        >
          {currentPage.body}
        </IntroPage>
        {nextPage && (
          <IntroPage
            art={nextPage.art}
            title={nextPage.title}
            containerStyle={{
              opacity: incomingOpacity,
              transform: [{ translateY: incomingOffset }],
            }}
            titleStyle={{
              opacity: titleOpacity,
              transform: [{ translateY: titleOffset }],
            }}
            bodyStyle={{
              opacity: bodyOpacity,
              transform: [{ translateY: bodyOffset }],
            }}
          >
            {nextPage.body}
          </IntroPage>
        )}
      </View>
      <View style={styles.bottomAction}>
        <PrimaryButton label="Continue" onPress={() => goTo(index + 1)} />
      </View>
    </SafeAreaView>
  );
}

function IntroPage({
  art,
  title,
  children,
  containerStyle,
  titleStyle,
  bodyStyle,
}: {
  art: ReactNode;
  title: ReactNode;
  children: ReactNode;
  containerStyle?: object;
  titleStyle?: object;
  bodyStyle?: object;
}) {
  return (
    <NativeAnimated.View style={[styles.introPage, containerStyle]}>
      {art}
      <NativeAnimated.Text style={[styles.title, titleStyle]}>{title}</NativeAnimated.Text>
      <NativeAnimated.Text style={[styles.body, bodyStyle]}>{children}</NativeAnimated.Text>
    </NativeAnimated.View>
  );
}

function PremiseArt() {
  return (
    <View style={styles.artCard}>
      <EyebrowLabel>same species · same week</EyebrowLabel>
      <ComparisonBar label="Your window" value="every 9d" color={colors.forest} />
      <ComparisonBar label="The label's advice" value="every 7d" color="#C3C1B2" />
    </View>
  );
}

function ComparisonBar({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.comparison}>
      <View style={styles.comparisonLabels}>
        <Text style={styles.comparisonLabel}>{label}</Text>
        <Text style={styles.comparisonValue}>{value}</Text>
      </View>
      <View style={styles.segments}>
        {[0, 1, 2, 3].map((segment) => (
          <View
            key={segment}
            style={[styles.segment, segment === 0 && { backgroundColor: color }]}
          />
        ))}
      </View>
    </View>
  );
}

function ScheduleArt() {
  return (
    <View style={styles.artCard}>
      <EyebrowLabel>schedule suggestion · example</EyebrowLabel>
      <View style={styles.scheduleRow}>
        <View>
          <Text style={styles.scheduleCaption}>CURRENT</Text>
          <Text style={styles.scheduleValue}>every 7d</Text>
        </View>
        <Text style={styles.scheduleArrow}>→</Text>
        <View>
          <Text style={styles.scheduleCaption}>SUGGESTED</Text>
          <Text style={styles.scheduleValue}>every 9d</Text>
        </View>
      </View>
      <Text style={styles.artCaption}>Based on 6 waterings you logged.</Text>
      <View style={styles.exampleActions}>
        <View style={styles.exampleGhost}><Text style={styles.exampleGhostText}>Keep 7d</Text></View>
        <View style={styles.examplePrimary}><Text style={styles.examplePrimaryText}>Update to 9d</Text></View>
      </View>
    </View>
  );
}

function DiaryArt() {
  const entries = [
    { type: "milestone" as const, title: "New leaf unfurled", meta: "Giorgio · Jun 18" },
    { type: "water" as const, title: "Watered", meta: "Giorgio · Jun 12" },
    { type: "photo" as const, title: "First photo", meta: "Giorgio · Apr 02" },
  ];
  return (
    <View style={styles.artCard}>
      {entries.map((entry, index) => (
        <View key={entry.title} style={styles.timelineRow}>
          <View style={styles.timelineIcon}>
            <EventIcon type={entry.type} size={40} />
            {index < entries.length - 1 && <View style={styles.timelineLine} />}
          </View>
          <View style={styles.timelineCopy}>
            <Text style={styles.timelineTitle}>{entry.title}</Text>
            <Text style={styles.timelineMeta}>{entry.meta}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function DoneScreen({
  plant,
  onToday,
  onAddAnother,
}: {
  plant: Plant;
  onToday: () => void;
  onAddAnother: () => void;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.doneContent}>
        <EyebrowLabel>day one</EyebrowLabel>
        <Text style={styles.title}>{plant.name} is in the diary.</Text>
        <Text style={styles.body}>
          {plant.watering_frequency_days
            ? "A starting schedule gives you a place to begin. Log waterings as they happen and PlantDiary will propose changes when your pattern is clear."
            : "Your diary starts here. Log waterings as they happen to start building your plant's history."}
        </Text>
        <View style={styles.doneCard}><PlantCard plant={plant} /></View>
        <View style={styles.truthCard}>
          <Text style={styles.truthMetric}>0 waterings logged</Text>
          <Text style={styles.truthCopy}>No personal pattern yet. This will grow from what you log.</Text>
        </View>
        <View style={styles.doneActions}>
          <PrimaryButton label="Go to Today" onPress={onToday} />
          <GhostButton label="Add another plant" onPress={onAddAnother} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PrimaryButton({ label, onPress, light = false }: { label: string; onPress: () => void; light?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      style={[styles.primaryButton, light && styles.primaryButtonLight]}
      onPress={onPress}
    >
      <Text style={[styles.primaryButtonText, light && styles.primaryButtonTextDark]}>{label}</Text>
    </Pressable>
  );
}

function GhostButton({ label, onPress, dark = false }: { label: string; onPress: () => void; dark?: boolean }) {
  return (
    <Pressable accessibilityRole="button" style={styles.ghostButton} onPress={onPress}>
      <Text style={[styles.ghostButtonText, dark && styles.ghostButtonTextDark]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  phaseHost: { flex: 1, backgroundColor: colors.paper },
  phaseScreen: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  screen: { flex: 1, backgroundColor: colors.paper },
  welcome: {
    flex: 1,
    backgroundColor: "#2B3926",
    paddingHorizontal: 28,
    paddingTop: spacing.gutter,
    paddingBottom: spacing.base,
    justifyContent: "space-between",
  },
  welcomeCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  wordmark: {
    fontFamily: fonts.spectralSemiBold,
    fontSize: 34,
    lineHeight: 42,
    color: "#F1EFE4",
    marginTop: spacing.base,
  },
  tagline: {
    fontFamily: fonts.monoRegular,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 3,
    color: colors.sage,
    marginTop: spacing.sm,
  },
  welcomeCopy: {
    fontFamily: fonts.spectralItalic,
    fontSize: 17,
    lineHeight: 24,
    color: "#C8D2B8",
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  progressHeader: {
    height: 60,
    paddingHorizontal: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressPills: { minHeight: 44, flexDirection: "row", gap: 6, alignItems: "center" },
  progressPill: { width: 6, height: 4, borderRadius: 2, backgroundColor: "#CFCDBF" },
  progressPillActive: { width: 22, backgroundColor: colors.forest },
  headerTap: { minWidth: 44, minHeight: 44, alignItems: "flex-end", justifyContent: "center" },
  skipText: { fontFamily: fonts.hankenMedium, fontSize: 15, color: colors.muted },
  introViewport: { flex: 1, position: "relative", overflow: "hidden" },
  introPage: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: 28,
    paddingTop: spacing.xl,
  },
  title: {
    fontFamily: fonts.spectralSemiBold,
    fontSize: 30,
    lineHeight: 35,
    color: colors.ink,
    marginTop: spacing.xl,
  },
  body: {
    fontFamily: fonts.hankenRegular,
    fontSize: 15,
    lineHeight: 23,
    color: colors.bark,
    marginTop: spacing.base,
  },
  artCard: {
    backgroundColor: colors.mist,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.base,
    minHeight: 190,
    justifyContent: "center",
  },
  comparison: { marginTop: spacing.base },
  comparisonLabels: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  comparisonLabel: { fontFamily: fonts.spectralMedium, fontSize: 15, color: colors.ink },
  comparisonValue: { fontFamily: fonts.monoMedium, fontSize: 11, color: colors.fern },
  segments: { flexDirection: "row", gap: 4, marginTop: spacing.sm },
  segment: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.line },
  scheduleRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: spacing.lg },
  scheduleCaption: { fontFamily: fonts.monoRegular, fontSize: 9, letterSpacing: 1.2, color: colors.muted },
  scheduleValue: { fontFamily: fonts.spectralMedium, fontSize: 24, color: colors.ink, marginTop: spacing.xs },
  scheduleArrow: { fontFamily: fonts.hankenRegular, fontSize: 24, color: colors.fern, paddingBottom: 2 },
  artCaption: { fontFamily: fonts.hankenRegular, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: spacing.base },
  exampleActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.base },
  exampleGhost: { flex: 1, minHeight: 36, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  exampleGhostText: { fontFamily: fonts.hankenMedium, fontSize: 12, color: colors.bark },
  examplePrimary: { flex: 1, minHeight: 36, borderRadius: radius.md, backgroundColor: colors.forest, alignItems: "center", justifyContent: "center" },
  examplePrimaryText: { fontFamily: fonts.hankenSemiBold, fontSize: 12, color: "#F1EFE4" },
  timelineRow: { minHeight: 54, flexDirection: "row", alignItems: "flex-start" },
  timelineIcon: { width: 40, alignItems: "center" },
  timelineLine: { width: 1, height: 16, backgroundColor: colors.line },
  timelineCopy: { flex: 1, paddingLeft: spacing.md, paddingTop: 2 },
  timelineTitle: { fontFamily: fonts.spectralMedium, fontSize: 17, lineHeight: 21, color: colors.ink },
  timelineMeta: { fontFamily: fonts.monoRegular, fontSize: 12, lineHeight: 18, color: colors.muted },
  bottomAction: { paddingHorizontal: 28, paddingBottom: spacing.base },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.forest,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.base,
  },
  primaryButtonLight: { backgroundColor: "#F1EFE4" },
  primaryButtonText: { fontFamily: fonts.hankenSemiBold, fontSize: 16, color: "#F1EFE4" },
  primaryButtonTextDark: { color: "#2B3926" },
  ghostButton: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  ghostButtonText: { fontFamily: fonts.hankenMedium, fontSize: 15, color: colors.fern },
  ghostButtonTextDark: { color: colors.sage },
  doneContent: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 48, paddingBottom: spacing.base },
  doneCard: { marginTop: spacing.xl },
  truthCard: { marginTop: spacing.base, backgroundColor: colors.mist, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.base },
  truthMetric: { fontFamily: fonts.monoMedium, fontSize: 13, color: colors.ink },
  truthCopy: { fontFamily: fonts.hankenRegular, fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: spacing.sm },
  doneActions: { marginTop: "auto", paddingTop: spacing.xl },
  recovery: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  recoveryAction: { marginTop: spacing.xl, marginBottom: spacing.md },
});
