import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { getCurrentCoordsOrNull, saveHomeCoords } from "../lib/location";
import { placeSubtitle, searchPlaces, type PlaceHit } from "../lib/weather";
import { log } from "../lib/logger";
import { colors, fonts, radius, spacing } from "../lib/theme";

type Props = {
  visible: boolean;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
};

export function HomeLocationSheet({ visible, userId, onClose, onSaved }: Props) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setQuery("");
      setHits([]);
      setSearchError(null);
      setSearching(false);
      setSaving(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const name = query.trim();
    if (name.length < 2) {
      setHits([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const places = await searchPlaces(name);
        if (!cancelled) {
          setHits(places);
          setSearchError(null);
        }
      } catch (err) {
        log.warn(
          "weather",
          "Place search failed",
          err instanceof Error ? err.message : err
        );
        if (!cancelled) {
          setHits([]);
          setSearchError("Could not search places");
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, visible]);

  async function persist(coords: { lat: number; lon: number }) {
    setSaving(true);
    try {
      await saveHomeCoords(supabase, userId, coords);
      onSaved();
    } catch (err) {
      log.warn(
        "weather",
        "Failed to save home location",
        err instanceof Error ? err.message : err
      );
      Alert.alert("Could not save", "Home location was not updated. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePlace(place: PlaceHit) {
    await persist({ lat: place.latitude, lon: place.longitude });
  }

  async function handleCurrentLocation() {
    const coords = await getCurrentCoordsOrNull();
    if (!coords) {
      Alert.alert(
        "Location unavailable",
        "Allow location access, or search for the city where your plants live."
      );
      return;
    }
    await persist(coords);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Home location</Text>
          <Text style={styles.copy}>
            So we always remember your plants' home while you're away.
          </Text>
          <TextInput
            style={styles.search}
            placeholder="Search a city"
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="words"
            editable={!saving}
          />
          {searching ? (
            <View style={styles.searchStatus}>
              <ActivityIndicator size="small" color={colors.fern} />
            </View>
          ) : searchError ? (
            <Text style={styles.muted}>{searchError}</Text>
          ) : query.trim().length >= 2 && hits.length === 0 ? (
            <Text style={styles.muted}>No places found</Text>
          ) : hits.length > 0 ? (
            <View style={styles.results}>
              {hits.map((place, index) => {
                const subtitle = placeSubtitle(place);
                return (
                  <Pressable
                    key={place.id}
                    style={[
                      styles.result,
                      index === hits.length - 1 && styles.resultLast,
                    ]}
                    onPress={() => handlePlace(place)}
                    disabled={saving}
                  >
                    <Text style={styles.resultName}>{place.name}</Text>
                    {subtitle ? (
                      <Text style={styles.resultMeta}>{subtitle}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <Text style={styles.or}>or</Text>
          <Pressable
            style={[styles.outline, saving && styles.disabled]}
            onPress={handleCurrentLocation}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.forest} />
            ) : (
              <Text style={styles.outlineText}>Use current location</Text>
            )}
          </Pressable>
          <Pressable style={styles.cancel} onPress={onClose} disabled={saving}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(38,39,32,0.45)",
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.mist,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.gutter,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontFamily: fonts.spectralSemiBold,
    fontSize: 20,
    color: colors.ink,
  },
  copy: {
    fontFamily: fonts.hankenRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.bark,
    marginTop: spacing.sm,
    marginBottom: spacing.base,
  },
  search: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.hankenRegular,
    fontSize: 15,
    color: colors.ink,
  },
  searchStatus: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  muted: {
    fontFamily: fonts.hankenRegular,
    fontSize: 13,
    color: colors.muted,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  results: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  result: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  resultLast: {
    borderBottomWidth: 0,
  },
  resultName: {
    fontFamily: fonts.hankenSemiBold,
    fontSize: 15,
    color: colors.ink,
  },
  resultMeta: {
    fontFamily: fonts.hankenRegular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  or: {
    fontFamily: fonts.hankenBold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.base,
    marginBottom: spacing.md,
  },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.sageBorder,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  outlineText: {
    fontFamily: fonts.hankenSemiBold,
    fontSize: 15,
    color: colors.forest,
  },
  disabled: {
    opacity: 0.6,
  },
  cancel: {
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelText: {
    fontFamily: fonts.hankenRegular,
    fontSize: 14,
    color: colors.muted,
  },
});
