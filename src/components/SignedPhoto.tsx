import { useEffect, useState } from "react";
import {
  Image,
  type ImageProps,
  type StyleProp,
  View,
  type ViewStyle,
} from "react-native";
import { createSignedPhotoUrl } from "../lib/photos";
import { log } from "../lib/logger";
import { supabase } from "../lib/supabase";

const REFRESH_SIGNED_URL_MS = 55 * 60 * 1000;

type Props = Omit<ImageProps, "source"> & {
  reference: string;
};

/** Renders a private Storage object without replacing its database reference. */
export function SignedPhoto({ reference, style, ...imageProps }: Props) {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    async function signPhoto() {
      try {
        const signedUrl = await createSignedPhotoUrl(supabase, reference);
        if (!active) return;
        setUri(signedUrl);
        refreshTimer = setTimeout(signPhoto, REFRESH_SIGNED_URL_MS);
      } catch (error) {
        if (!active) return;
        setUri(null);
        log.warn("storage", "Could not sign plant photo", error);
      }
    }

    setUri(null);
    signPhoto();

    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [reference]);

  if (!uri) {
    return <View style={style as StyleProp<ViewStyle>} />;
  }

  return <Image {...imageProps} source={{ uri }} style={style} />;
}
