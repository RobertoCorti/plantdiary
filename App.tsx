import { useEffect, useRef, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import {
  createNativeStackNavigator,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { Session } from "@supabase/supabase-js";
import { StyleSheet, View } from "react-native";
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
import { registerForPushNotifications } from "./src/lib/notifications";
import { log } from "./src/lib/logger";
import { colors } from "./src/lib/theme";
import { BreathingMark } from "./src/components/BreathingMark";
import { SplashReveal } from "./src/components/SplashReveal";
import AuthScreen from "./src/screens/AuthScreen";
import HomeScreen from "./src/screens/HomeScreen";
import AddPlantScreen from "./src/screens/AddPlantScreen";
import PlantProfileScreen from "./src/screens/PlantProfileScreen";
import PlantJournalScreen from "./src/screens/PlantJournalScreen";

SplashScreen.preventAutoHideAsync().catch(() => {
  /* already prevented */
});

export type RootStackParamList = {
  Home: undefined;
  AddPlant: undefined;
  PlantProfile: { plantId: string };
  PlantJournal: { plantId: string };
  Auth: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
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

  // Register for push notifications when user is logged in
  const hasRegistered = useRef(false);
  useEffect(() => {
    if (!session || hasRegistered.current) return;
    hasRegistered.current = true;

    registerForPushNotifications().then(async (token) => {
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
  }, [session]);

  // Native splash holds while fonts download.
  if (!fontsReady) return null;

  // SplashReveal: cream frond strokes onto forest, then wordmark settles in.
  if (!revealDone) {
    return <SplashReveal onDone={() => setRevealDone(true)} />;
  }

  // Splash finished before auth resolved — calm holding state.
  if (loading) {
    return (
      <View style={styles.splash}>
        <BreathingMark size={64} color={colors.forest} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
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
                />
              )}
            </Stack.Screen>
          </>
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
});
