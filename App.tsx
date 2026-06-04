import { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import {
  createNativeStackNavigator,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { Session } from "@supabase/supabase-js";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { supabase } from "./src/lib/supabase";
import AuthScreen from "./src/screens/AuthScreen";
import HomeScreen from "./src/screens/HomeScreen";
import AddPlantScreen from "./src/screens/AddPlantScreen";
import PlantProfileScreen from "./src/screens/PlantProfileScreen";

export type RootStackParamList = {
  Home: undefined;
  AddPlant: undefined;
  PlantProfile: { plantId: string };
  Auth: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>PlantDiary</Text>
        <ActivityIndicator size="large" color="#2d5016" style={{ marginTop: 16 }} />
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
    backgroundColor: "#f8faf5",
    justifyContent: "center",
    alignItems: "center",
  },
  splashTitle: {
    fontSize: 36,
    fontWeight: "700",
    color: "#2d5016",
  },
});
