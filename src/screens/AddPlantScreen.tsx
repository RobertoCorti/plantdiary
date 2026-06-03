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
import type { AIIdentificationResult } from "../types";

type Props = {
  session: Session;
  onPlantAdded: () => void;
};

type Step = "photo" | "identifying" | "details" | "saving";

export default function AddPlantScreen({ session, onPlantAdded }: Props) {
  const [step, setStep] = useState<Step>("photo");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AIIdentificationResult | null>(
    null,
  );
  const [nickname, setNickname] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function pickImage(useCamera: boolean) {
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
      // Upload to Supabase Storage
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

      // Call Edge Function for AI identification
      const fnResp = await fetch(
        `${supabaseUrl}/functions/v1/identify-plant`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ photo_url: publicUrl }),
        },
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
        <ActivityIndicator size="large" color="#2d5016" />
        <Text style={styles.loadingText}>
          {step === "identifying"
            ? "Identifying your plant..."
            : "Saving your plant..."}
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
          <Text style={styles.title}>Plant Identified</Text>

          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.previewLarge} />
          )}

          <View style={styles.resultCard}>
            <Text style={styles.speciesName}>{aiResult.common_name}</Text>
            <Text style={styles.scientificName}>{aiResult.species}</Text>
            <Text style={styles.confidence}>
              Confidence: {aiResult.confidence}
            </Text>

            <View style={styles.careRow}>
              <View style={styles.careItem}>
                <Text style={styles.careLabel}>Water</Text>
                <Text style={styles.careValue}>
                  Every {aiResult.watering_frequency_days} days
                </Text>
              </View>
              <View style={styles.careItem}>
                <Text style={styles.careLabel}>Light</Text>
                <Text style={styles.careValue}>{aiResult.light}</Text>
              </View>
              <View style={styles.careItem}>
                <Text style={styles.careLabel}>Humidity</Text>
                <Text style={styles.careValue}>{aiResult.humidity}</Text>
              </View>
            </View>

            <Text style={styles.careNotes}>{aiResult.care_notes}</Text>
          </View>

          <Text style={styles.fieldLabel}>Nickname *</Text>
          <TextInput
            style={styles.input}
            placeholder='e.g. "Giorgio"'
            placeholderTextColor="#999"
            value={nickname}
            onChangeText={setNickname}
          />

          <Text style={styles.fieldLabel}>Location</Text>
          <TextInput
            style={styles.input}
            placeholder='e.g. "Living room window"'
            placeholderTextColor="#999"
            value={location}
            onChangeText={setLocation}
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable style={styles.saveButton} onPress={savePlant}>
            <Text style={styles.saveButtonText}>Save Plant</Text>
          </Pressable>

          <Pressable
            style={styles.cancelButton}
            onPress={onPlantAdded}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Photo step
  return (
    <View style={styles.container}>
      <View style={styles.photoContent}>
        <Text style={styles.title}>Add a Plant</Text>
        <Text style={styles.subtitle}>
          Take a photo or pick one from your gallery
        </Text>

        {imageUri && (
          <Image source={{ uri: imageUri }} style={styles.previewLarge} />
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Pressable
          style={styles.photoButton}
          onPress={() => pickImage(true)}
        >
          <Text style={styles.photoButtonText}>Take Photo</Text>
        </Pressable>

        <Pressable
          style={[styles.photoButton, styles.photoButtonSecondary]}
          onPress={() => pickImage(false)}
        >
          <Text style={[styles.photoButtonText, styles.photoButtonTextSecondary]}>
            Choose from Gallery
          </Text>
        </Pressable>

        <Pressable
          style={styles.cancelButton}
          onPress={onPlantAdded}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8faf5",
  },
  centered: {
    flex: 1,
    backgroundColor: "#f8faf5",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  photoContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2d5016",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#888",
    marginBottom: 24,
  },
  loadingText: {
    fontSize: 16,
    color: "#2d5016",
    marginTop: 16,
  },
  previewSmall: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginTop: 24,
  },
  previewLarge: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 16,
    marginBottom: 20,
  },
  resultCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#e0e8d8",
  },
  speciesName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2d5016",
  },
  scientificName: {
    fontSize: 14,
    fontStyle: "italic",
    color: "#666",
    marginTop: 2,
  },
  confidence: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
    marginBottom: 16,
  },
  careRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  careItem: {
    flex: 1,
    backgroundColor: "#f0f5eb",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  careLabel: {
    fontSize: 11,
    color: "#888",
    fontWeight: "600",
    marginBottom: 4,
  },
  careValue: {
    fontSize: 12,
    color: "#2d5016",
    textAlign: "center",
  },
  careNotes: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
    color: "#333",
  },
  errorText: {
    color: "#c0392b",
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  photoButton: {
    backgroundColor: "#2d5016",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  photoButtonSecondary: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#2d5016",
  },
  photoButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  photoButtonTextSecondary: {
    color: "#2d5016",
  },
  saveButton: {
    backgroundColor: "#2d5016",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#c0392b",
    fontSize: 16,
  },
});
