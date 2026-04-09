import type { GenerationSettings } from "../theory/music";
import { createArpeggioPracticeQueue } from "./arpeggios";
import { createCadencePracticeQueue } from "./cadences";
import { createScalePracticeQueue } from "./scales";
import { createTriadPracticeQueue } from "./triads";
import type { ExerciseNotationProfile, PromptSlot } from "./types";

export function createExercisePromptQueue(
  length: number,
  generationSettings: GenerationSettings,
) {
  void length;

  if (generationSettings.practiceMode === "scales") {
    return createScalePracticeQueue(generationSettings);
  }

  if (generationSettings.practiceMode === "triads") {
    return createTriadPracticeQueue(generationSettings);
  }

  if (generationSettings.practiceMode === "arpeggios") {
    return createArpeggioPracticeQueue(generationSettings);
  }

  if (generationSettings.practiceMode === "cadences") {
    return createCadencePracticeQueue(generationSettings);
  }

  const unsupportedPracticeMode: never = generationSettings.practiceMode;

  throw new Error(`Unsupported practice mode: ${unsupportedPracticeMode}`);
}

export function fillExercisePromptQueue(
  promptQueue: PromptSlot[],
  length: number,
  generationSettings: GenerationSettings,
) {
  void promptQueue;
  void length;
  void generationSettings;

  if (generationSettings.practiceMode === "scales") {
    return;
  }

  if (generationSettings.practiceMode === "triads") {
    return;
  }

  if (generationSettings.practiceMode === "arpeggios") {
    return;
  }

  if (generationSettings.practiceMode === "cadences") {
    return;
  }
}

export function getExerciseNotationProfile(
  generationSettings: GenerationSettings,
): ExerciseNotationProfile | null {
  if (
    generationSettings.practiceMode === "scales" ||
    generationSettings.practiceMode === "triads" ||
    generationSettings.practiceMode === "arpeggios" ||
    generationSettings.practiceMode === "cadences"
  ) {
    return {
      timeSignature: "C",
      beatsPerMeasure: 4,
    };
  }

  return null;
}
