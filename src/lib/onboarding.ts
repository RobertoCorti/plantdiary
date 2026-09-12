import type { SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { log } from "./logger";

export const ONBOARDING_STEPS = [
  "welcome",
  "premise",
  "schedule",
  "diary",
  "plant",
  "done",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type OnboardingState = {
  step: OnboardingStep;
  completedAt: string | null;
  plantId: string | null;
  updatedAt: string;
};

type OnboardingRow = {
  onboarding_step: unknown;
  onboarding_completed_at: unknown;
  onboarding_plant_id: unknown;
  onboarding_updated_at: unknown;
};

type OnboardingStorage = Pick<
  typeof SecureStore,
  "getItemAsync" | "setItemAsync"
>;

const SELECT_COLUMNS =
  "onboarding_step,onboarding_completed_at,onboarding_plant_id,onboarding_updated_at";

function storageKey(userId: string): string {
  return `plantdiary.onboarding.${userId}`;
}

function isStep(value: unknown): value is OnboardingStep {
  return ONBOARDING_STEPS.includes(value as OnboardingStep);
}

function initialState(now = new Date().toISOString()): OnboardingState {
  return { step: "welcome", completedAt: null, plantId: null, updatedAt: now };
}

function parseState(value: unknown): OnboardingState | null {
  if (!value || typeof value !== "object") return null;
  const state = value as Partial<OnboardingState>;
  if (!isStep(state.step) || typeof state.updatedAt !== "string") return null;
  if (state.completedAt !== null && typeof state.completedAt !== "string") return null;
  if (state.plantId !== null && typeof state.plantId !== "string") return null;
  return state as OnboardingState;
}

function stateFromRow(row: OnboardingRow | null): OnboardingState | null {
  if (!row) return null;
  return parseState({
    step: row.onboarding_step,
    completedAt: row.onboarding_completed_at,
    plantId: row.onboarding_plant_id,
    updatedAt: row.onboarding_updated_at,
  });
}

async function readLocal(
  storage: OnboardingStorage,
  userId: string
): Promise<OnboardingState | null> {
  try {
    const value = await storage.getItemAsync(storageKey(userId));
    return value ? parseState(JSON.parse(value)) : null;
  } catch (error) {
    log.warn("onboarding", "Could not read local onboarding state", error);
    return null;
  }
}

async function writeLocal(
  storage: OnboardingStorage,
  userId: string,
  state: OnboardingState
): Promise<void> {
  try {
    await storage.setItemAsync(storageKey(userId), JSON.stringify(state));
  } catch (error) {
    log.warn("onboarding", "Could not save local onboarding state", error);
  }
}

function laterStep(a: OnboardingStep, b: OnboardingStep): OnboardingStep {
  return ONBOARDING_STEPS.indexOf(a) >= ONBOARDING_STEPS.indexOf(b) ? a : b;
}

function mergeStates(server: OnboardingState, local: OnboardingState): OnboardingState {
  const newer = server.updatedAt >= local.updatedAt ? server : local;
  const older = newer === server ? local : server;
  return {
    step: laterStep(server.step, local.step),
    completedAt: server.completedAt ?? local.completedAt,
    plantId: newer.plantId ?? older.plantId,
    updatedAt: newer.updatedAt,
  };
}

async function writeServer(
  client: SupabaseClient,
  userId: string,
  state: OnboardingState
): Promise<boolean> {
  const { error } = await client.from("profiles").upsert(
    {
      id: userId,
      onboarding_step: state.step,
      onboarding_completed_at: state.completedAt,
      onboarding_plant_id: state.plantId,
      onboarding_updated_at: state.updatedAt,
    },
    { onConflict: "id" }
  );
  if (!error) return true;
  log.warn("onboarding", "Could not sync onboarding state", error.message);
  return false;
}

export async function loadOnboardingState(
  client: SupabaseClient,
  userId: string,
  storage: OnboardingStorage = SecureStore
): Promise<OnboardingState> {
  const local = await readLocal(storage, userId);
  const { data, error } = await client
    .from("profiles")
    .select(SELECT_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    log.warn("onboarding", "Could not load server onboarding state", error.message);
    if (local) return local;
    throw error;
  }

  const server = stateFromRow(data as OnboardingRow | null);
  const merged = server && local ? mergeStates(server, local) : server ?? local ?? initialState();

  await writeLocal(storage, userId, merged);
  if (!server || (local && JSON.stringify(merged) !== JSON.stringify(server))) {
    await writeServer(client, userId, merged);
  }
  return merged;
}

export async function saveOnboardingProgress(
  client: SupabaseClient,
  userId: string,
  step: OnboardingStep,
  plantId: string | null,
  storage: OnboardingStorage = SecureStore
): Promise<OnboardingState> {
  const local = await readLocal(storage, userId);
  const state: OnboardingState = {
    step: local ? laterStep(local.step, step) : step,
    completedAt: local?.completedAt ?? null,
    plantId: plantId ?? local?.plantId ?? null,
    updatedAt: new Date().toISOString(),
  };
  await writeLocal(storage, userId, state);

  const { error } = await client.from("profiles").upsert(
    {
      id: userId,
      onboarding_step: state.step,
      onboarding_plant_id: state.plantId,
      onboarding_updated_at: state.updatedAt,
    },
    { onConflict: "id" }
  );
  if (error) log.warn("onboarding", "Could not sync onboarding progress", error.message);
  return state;
}

export async function completeOnboarding(
  client: SupabaseClient,
  userId: string,
  plantId: string | null = null,
  storage: OnboardingStorage = SecureStore
): Promise<OnboardingState> {
  const local = await readLocal(storage, userId);
  const now = new Date().toISOString();
  const state: OnboardingState = {
    step: "done",
    completedAt: local?.completedAt ?? now,
    plantId: plantId ?? local?.plantId ?? null,
    updatedAt: now,
  };
  await writeLocal(storage, userId, state);
  await writeServer(client, userId, state);
  return state;
}
