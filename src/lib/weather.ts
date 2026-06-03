import type { WeatherData } from "../types";

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
