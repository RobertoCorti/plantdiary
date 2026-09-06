import { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import {
  createNativeStackNavigator,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { Session } from "@supabase/supabase-js";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Spectral_400Regular,
  Spectral_500Medium,
  Spectral_600SemiBold,
  Spectral_400Regular_Italic,
} from "@expo-google-fonts/spectral";
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from "@expo-google-fonts/hanken-grotesk";
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from "@expo-google-fonts/ibm-plex-mono";
import { supabase } from "./src/lib/supabase";
import { completeAuthCallback } from "./src/lib/auth";
import { loadOnboardingState, type OnboardingState } from "./src/lib/onboarding";
import { syncPushTokenIfAuthorized } from "./src/lib/notifications";
import { log } from "./src/lib/logger";
import { colors } from "./src/lib/theme";
import { BreathingMark } from "./src/components/BreathingMark";
import { SplashReveal } from "./src/components/SplashReveal";
import AuthScreen from "./src/screens/AuthScreen";
import HomeScreen from "./src/screens/HomeScreen";
import AddPlantScreen from "./src/screens/AddPlantScreen";
import PlantProfileScreen from "./src/screens/PlantProfileScreen";
import PlantJournalScreen from "./src/screens/PlantJournalScreen";
import OnboardingScreen from "./src/screens/OnboardingScreen";

SplashScreen.preventAutoHideAsync().catch(() => {
  /* already prevented */
});

export type RootStackParamList = {
  Home: undefined;
  AddPlant: undefined;
  PlantProfile: { plantId: string };
  PlantJournal: { plantId: string };
  Auth: undefined;
  Onboarding: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingState, setOnboardingState] = useState<OnboardingState | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingUserId, setOnboardingUserId] = useState<string | null>(null);
  const [onboardingError, setOnboardingError] = useState(false);
  const [onboardingRetry, setOnboardingRetry] = useState(0);
  const [revealDone, setRevealDone] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Spectral_400Regular,
    Spectral_500Medium,
    Spectral_600SemiBold,
    Spectral_400Regular_Italic,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  useEffect(() => {
    if (fontError) log.error("app", "Font load failed", fontError.message);
  }, [fontError]);

  const fontsReady = fontsLoaded || !!fontError;

  // Hide the native splash as soon as fonts are ready so SplashReveal can take
  // over without a freeze on the native splash image.
  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsReady]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    if (!session) {
      setOnboardingState(null);
      setOnboardingUserId(null);
      setOnboardingError(false);
      setOnboardingLoading(false);
      return;
    }
    setOnboardingLoading(true);
    setOnboardingError(false);
    loadOnboardingState(supabase, session.user.id)
      .then((state) => {
        if (!active) return;
        setOnboardingState(state);
        setOnboardingUserId(session.user.id);
        setOnboardingLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        log.warn("onboarding", "Could not determine onboarding eligibility", error);
        setOnboardingUserId(session.user.id);
        setOnboardingError(true);
        setOnboardingLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session?.user.id, onboardingRetry]);

  useEffect(() => {
    async function handleUrl(url: string) {
      try {
        await completeAuthCallback(supabase, url);
      } catch (error) {
        const message = error instanceof Error ? error.message : "The confirmation link could not be opened.";
        log.warn("auth", "Email confirmation callback failed", message);
        Alert.alert("Confirmation link problem", message);
      }
    }

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });
    const subscription = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);

  // Refresh an existing push authorization without prompting after login.
  useEffect(() => {
    if (!session) return;

    syncPushTokenIfAuthorized().then(async (token) => {
      if (!token) return;
      const { error } = await supabase.from("profiles").upsert(
        { id: session.user.id, push_token: token },
        { onConflict: "id" }
      );
      if (error) {
        log.error("push", "Failed to upsert token to profiles", error.message);
      } else {
        log.info("push", "Token saved to profiles", { userId: session.user.id });
      }
    });
  }, [session?.user.id]);

  // Native splash holds while fonts download.
  if (!fontsReady) return null;

  // SplashReveal: cream frond strokes onto forest, then wordmark settles in.
  if (!revealDone) {
    return <SplashReveal onDone={() => setRevealDone(true)} />;
  }

  // Splash finished before auth resolved — calm holding state.
  if (
    loading ||
    (session && (onboardingLoading || onboardingUserId !== session.user.id))
  ) {
    return (
      <View style={styles.splash}>
        <BreathingMark size={64} color={colors.forest} />
      </View>
    );
  }

  if (session && onboardingError) {
    return (
      <View style={styles.gateError}>
        <Text style={styles.gateErrorTitle}>Couldn't load your account</Text>
        <Text style={styles.gateErrorBody}>Check your connection and try again.</Text>
        <Pressable
          style={styles.gateRetryButton}
          onPress={() => setOnboardingRetry((value) => value + 1)}
        >
          <Text style={styles.gateRetryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          onboardingState && !onboardingState.completedAt ? (
            <Stack.Screen name="Onboarding">
              {() => (
                <OnboardingScreen
                  session={session}
                  initialState={onboardingState}
                  onFinished={() =>
                    setOnboardingState((current) => ({
                      ...(current ?? onboardingState),
                      step: "done",
                      completedAt: current?.completedAt ?? new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    }))
                  }
                />
              )}
            </Stack.Screen>
          ) : (
            <>
              <Stack.Screen name="Home">
                {(props: NativeStackScreenProps<RootStackParamList, "Home">) => (
                  <HomeScreen session={session} navigation={props.navigation} />
                )}
              </Stack.Screen>
              <Stack.Screen name="PlantProfile">
                {(props: NativeStackScreenProps<RootStackParamList, "PlantProfile">) => (
                  <PlantProfileScreen
                    session={session}
                    plantId={props.route.params.plantId}
                    navigation={props.navigation}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="PlantJournal">
                {(props: NativeStackScreenProps<RootStackParamList, "PlantJournal">) => (
                  <PlantJournalScreen
                    session={session}
                    plantId={props.route.params.plantId}
                    navigation={props.navigation}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="AddPlant" options={{ presentation: "modal" }}>
                {(props: NativeStackScreenProps<RootStackParamList, "AddPlant">) => (
                  <AddPlantScreen
                    session={session}
                    onPlantAdded={() => props.navigation.goBack()}
                    onClose={() => props.navigation.goBack()}
                  />
                )}
              </Stack.Screen>
            </>
          )
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.paper,
    justifyContent: "center",
    alignItems: "center",
  },
  gateError: {
    flex: 1,
    backgroundColor: colors.paper,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  gateErrorTitle: {
    fontFamily: "Spectral_600SemiBold",
    fontSize: 26,
    lineHeight: 32,
    color: colors.ink,
    textAlign: "center",
  },
  gateErrorBody: {
    fontFamily: "HankenGrotesk_400Regular",
    fontSize: 15,
    lineHeight: 22,
    color: colors.bark,
    textAlign: "center",
    marginTop: 8,
  },
  gateRetryButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.forest,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  gateRetryText: {
    fontFamily: "HankenGrotesk_600SemiBold",
    fontSize: 16,
    color: "#F1EFE4",
  },
});
