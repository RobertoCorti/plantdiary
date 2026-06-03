import type { Plant, WateringStatus } from "../types";

export function getWateringStatus(plant: Plant): WateringStatus {
  if (!plant.watering_frequency_days) return "check";
  if (!plant.last_watered_at) return "water_today";

  const lastWatered = new Date(plant.last_watered_at);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextWatering = new Date(lastWatered);
  nextWatering.setDate(nextWatering.getDate() + plant.watering_frequency_days);
  nextWatering.setHours(0, 0, 0, 0);

  const diffMs = nextWatering.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "water_today";
  if (diffDays === 1) return "check";
  return "ok";
}

export function daysSinceWatered(plant: Plant): number | null {
  if (!plant.last_watered_at) return null;
  const lastWatered = new Date(plant.last_watered_at);
  const now = new Date();
  return Math.floor(
    (now.getTime() - lastWatered.getTime()) / (1000 * 60 * 60 * 24)
  );
}
