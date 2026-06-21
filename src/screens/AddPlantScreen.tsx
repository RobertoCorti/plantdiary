import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import {
  colors,
  fonts,
  radius,
  spacing,
  typography,
} from "../lib/theme";
import { ConfidenceBar } from "../components/ConfidenceBar";
import { EyebrowLabel } from "../components/EyebrowLabel";
import type { AIIdentificationResult } from "../types";

type Props = {
  session: Session;
  onPlantAdded: () => void;
};

type Step = "photo" | "identifying" | "details" | "saving";

const CONFIDENCE_FILL: Record<AIIdentificationResult["confidence"], number> = {
  low: 28,
  medium: 62,
  high: 92,
};

export default function AddPlantScreen({ session, onPlantAdded }: Props) {
  const [step, setStep] = useState<Step>("photo");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AIIdentificationResult | null>(null);
  const [nickname, setNickname] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function pickImage(useCamera: boolean) {
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Camera permission required",
          "Please enable camera access in your device settings to take photos."
        );
        return;
      }
    }

    const pickerFn = useCamera
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    const result = await pickerFn({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      setError(null);
      await uploadAndIdentify(uri);
    }
  }

  async function uploadAndIdentify(uri: string) {
    setStep("identifying");
    setError(null);

    try {
      const fileExt = uri.split(".").pop() ?? "jpg";
      const fileName = `${session.user.id}/${Date.now()}.${fileExt}`;

      const contentType = `image/${fileExt === "jpg" ? "jpeg" : fileExt}`;
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;

      const formData = new FormData();
      formData.append("file", {
        uri,
        name: fileName.split("/").pop(),
        type: contentType,
      } as unknown as Blob);

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${supabaseUrl}/storage/v1/object/plant-photos/${fileName}`);
        xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
        xhr.setRequestHeader("apikey", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!);
        xhr.setRequestHeader("x-upsert", "false");
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.responseText}`));
          }
        };
        xhr.onerror = () => reject(new Error("Upload network error"));
        xhr.send(formData);
      });

      const {
        data: { publicUrl },
      } = supabase.storage.from("plant-photos").getPublicUrl(fileName);

      setPhotoUrl(publicUrl);

      const fnResp = await fetch(
        `${supabaseUrl}/functions/v1/identify-plant`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ photo_url: publicUrl }),
        }
      );

      if (!fnResp.ok) {
        const errText = await fnResp.text();
        throw new Error(`Identification failed (${fnResp.status}): ${errText}`);
      }

      const data = await fnResp.json();
      setAiResult(data as AIIdentificationResult);
      setStep("details");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setStep("photo");
    }
  }

  async function savePlant() {
    if (!nickname.trim()) {
      Alert.alert("Name required", "Give your plant a nickname.");
      return;
    }

    setStep("saving");
    setError(null);

    try {
      const { error: insertError } = await supabase.from("plants").insert({
        user_id: session.user.id,
        name: nickname.trim(),
        species: aiResult
          ? `${aiResult.common_name} (${aiResult.species})`
          : null,
        location: location.trim() || null,
        photo_url: photoUrl,
        watering_frequency_days: aiResult?.watering_frequency_days ?? null,
      });

      if (insertError) throw new Error(insertError.message);

      onPlantAdded();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save";
      setError(message);
      setStep("details");
    }
  }

  if (step === "identifying" || step === "saving") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.forest} />
        <Text style={styles.loadingText}>
          {step === "identifying"
            ? "Identifying your plant…"
            : "Saving…"}
        </Text>
        {imageUri && (
          <Image source={{ uri: imageUri }} style={styles.previewSmall} />
        )}
      </View>
    );
  }

  if (step === "details" && aiResult) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Plant identified</Text>

          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.previewLarge} />
          )}

          <View style={styles.resultCard}>
            <Text style={styles.speciesName}>{aiResult.common_name}</Text>
            <Text style={styles.scientificName}>{aiResult.species}</Text>

            <View style={styles.confidenceWrap}>
              <ConfidenceBar
                confidence={aiResult.confidence}
                fillPercent={CONFIDENCE_FILL[aiResult.confidence]}
              />
            </View>

            <View style={styles.careRow}>
              <CareCell label="Water" value={`${aiResult.watering_frequency_days}d`} />
              <CareCell label="Light" value={aiResult.light} />
              <CareCell label="Humidity" value={aiResult.humidity} />
            </View>

            <Text style={styles.careNotes}>{aiResult.care_notes}</Text>
          </View>

          <EyebrowLabel>Nickname</EyebrowLabel>
          <TextInput
            style={styles.input}
            placeholder='e.g. "Giorgio"'
            placeholderTextColor={colors.muted}
            value={nickname}
            onChangeText={setNickname}
          />

          <EyebrowLabel>Location</EyebrowLabel>
          <TextInput
            style={styles.input}
            placeholder='e.g. "Living room window"'
            placeholderTextColor={colors.muted}
            value={location}
            onChangeText={setLocation}
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable style={styles.primaryButton} onPress={savePlant}>
            <Text style={styles.primaryButtonText}>Save plant</Text>
          </Pressable>

          <Pressable style={styles.cancelButton} onPress={onPlantAdded}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.photoContent}>
        <Text style={styles.title}>Add a plant</Text>
        <Text style={styles.subtitle}>
          Take a photo or pick one from your gallery and we'll identify it.
        </Text>

        {imageUri && (
          <Image source={{ uri: imageUri }} style={styles.previewLarge} />
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Pressable style={styles.primaryButton} onPress={() => pickImage(true)}>
          <Text style={styles.primaryButtonText}>Take photo</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => pickImage(false)}
        >
          <Text style={styles.secondaryButtonText}>Choose from gallery</Text>
        </Pressable>

        <Pressable style={styles.cancelButton} onPress={onPlantAdded}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CareCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.careItem}>
      <Text style={styles.careLabel}>{label}</Text>
      <Text style={styles.careValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.paper,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.gutter,
  },
  photoContent: {
    flex: 1,
    paddingHorizontal: spacing.gutter,
    paddingTop: 72,
  },
  scrollContent: {
    paddingHorizontal: spacing.gutter,
    paddingTop: 72,
    paddingBottom: spacing.xxl,
  },
  title: {
    ...typography.display,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: fonts.hankenRegular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.bark,
    marginBottom: spacing.gutter,
  },
  loadingText: {
    fontFamily: fonts.hankenRegular,
    fontSize: 15,
    color: colors.bark,
    marginTop: spacing.base,
  },
  previewSmall: {
    width: 120,
    height: 120,
    borderRadius: radius.md,
    marginTop: spacing.gutter,
    borderWidth: 1,
    borderColor: colors.line,
  },
  previewLarge: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },

  resultCard: {
    backgroundColor: colors.mist,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.gutter,
    borderWidth: 1,
    borderColor: colors.line,
  },
  speciesName: {
    fontFamily: fonts.spectralSemiBold,
    fontSize: 22,
    color: colors.ink,
  },
  scientificName: {
    fontFamily: fonts.spectralItalic,
    fontSize: 14,
    color: colors.bark,
    marginTop: 2,
  },
  confidenceWrap: {
    marginTop: spacing.md,
    marginBottom: spacing.base,
  },
  careRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  careItem: {
    flex: 1,
    backgroundColor: colors.wash,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    alignItems: "center",
    gap: 2,
  },
  careLabel: {
    ...typography.label,
    color: colors.fern,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  careValue: {
    fontFamily: fonts.hankenSemiBold,
    fontSize: 13,
    color: colors.ink,
    textAlign: "center",
  },
  careNotes: {
    fontFamily: fonts.hankenRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.bark,
  },

  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: 14,
    fontFamily: fonts.hankenRegular,
    fontSize: 15,
    color: colors.ink,
    marginTop: spacing.sm,
    marginBottom: spacing.base,
  },
  errorText: {
    fontFamily: fonts.hankenRegular,
    fontSize: 13,
    color: colors.waterTodayText,
    marginBottom: spacing.base,
    textAlign: "center",
  },

  primaryButton: {
    backgroundColor: colors.forest,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  primaryButtonText: {
    color: "#fff",
    fontFamily: fonts.hankenSemiBold,
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.sageBorder,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  secondaryButtonText: {
    color: colors.forest,
    fontFamily: fonts.hankenSemiBold,
    fontSize: 15,
  },
  cancelButton: {
    paddingVertical: spacing.base,
    alignItems: "center",
  },
  cancelButtonText: {
    color: colors.muted,
    fontFamily: fonts.hankenRegular,
    fontSize: 14,
  },
});
