import * as Location from "expo-location";
import { log } from "./logger";

export type Coords = { lat: number; lon: number };

export async function getCurrentCoordsOrNull(): Promise<Coords | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") {
      const req = await Location.requestForegroundPermissionsAsync();
      if (req.status !== "granted") {
        log.warn("weather", "Location permission not granted; weather will be NULL");
        return null;
      }
    }

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: pos.coords.latitude, lon: pos.coords.longitude };
  } catch (err) {
    log.warn("weather", "Failed to get coords", err instanceof Error ? err.message : err);
    return null;
  }
}
