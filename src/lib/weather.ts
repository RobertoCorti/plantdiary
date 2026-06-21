import type { WeatherData } from "../types";

// Pure threshold-based sentence (no AI). Used by the Today screen as a bridge
// between weather numbers and what they mean for the user's plants. Branches are
// ordered most specific → most general; first match wins.
export function careBridgeSentence(w: WeatherData): string {
  const hot = w.temperature > 28;
  const warm = w.temperature > 22 && !hot;
  const cool = w.temperature < 12;
  const dry = w.humidity < 40;
  const humid = w.humidity > 70;
  const rainy = w.precipitation > 5;
  const showery = w.precipitation > 0.5 && !rainy;

  if (rainy) return "Rainy today — outdoor pots get a soak, indoor ones unaffected.";
  if (hot && dry) return "Hot and dry today — your thirstier plants will feel it.";
  if (hot) return "Hot today — soil will dry faster than usual.";
  if (warm && dry) return "Warm and dry today — your thirstier plants will feel it.";
  if (dry) return "Dry air today — soil dries faster than usual.";
  if (cool && humid) return "Cool and humid — soil holds moisture longer.";
  if (cool) return "Cool today — your plants will sip slowly.";
  if (humid) return "Humid today — soil holds moisture well.";
  if (showery) return "A bit of rain today — outdoor pots get a drink.";
  if (warm) return "Mild and steady — a calm day for your plants.";
  return "A steady day for your plants.";
}

export async function fetchWeather(
  lat: number,
  lon: number
): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    temperature: data.current.temperature_2m,
    humidity: data.current.relative_humidity_2m,
    precipitation: data.current.precipitation,
  };
}
