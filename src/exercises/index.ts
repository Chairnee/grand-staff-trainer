import type { GenerationSettings } from "../theory/music";
import {
  createRandomNotePromptQueue,
  fillRandomNotePromptQueue,
} from "./randomNotes";
import { createCadencePracticeQueue } from "./cadences";
import { createScalePracticeQueue } from "./scales";
import { createTriadPracticeQueue } from "./triads";
import type { ExerciseNotationProfile, PromptSlot } from "./types";

export function createExercisePromptQueue(
  length: number,
  generationSettings: GenerationSettings,
  generatedNotePool: string[],
) {
  if (generationSettings.practiceMode === "scales") {
    return createScalePracticeQueue(generationSettings);
  }

  if (generationSettings.practiceMode === "triads") {
    return createTriadPracticeQueue(generationSettings);
  }

  if (generationSettings.practiceMode === "cadences") {
    return createCadencePracticeQueue(generationSettings);
  }

  return createRandomNotePromptQueue(
    length,
    generationSettings,
    generatedNotePool,
  );
}

export function fillExercisePromptQueue(
  promptQueue: PromptSlot[],
  length: number,
  generationSettings: GenerationSettings,
  generatedNotePool: string[],
) {
  if (generationSettings.practiceMode === "scales") {
    return;
  }

  if (generationSettings.practiceMode === "triads") {
    return;
  }

  if (generationSettings.practiceMode === "cadences") {
    return;
  }

  fillRandomNotePromptQueue(
    promptQueue,
    length,
    generationSettings,
    generatedNotePool,
  );
}

export function getExerciseNotationProfile(
  generationSettings: GenerationSettings,
): ExerciseNotationProfile | null {
  if (
    generationSettings.practiceMode === "scales" ||
    generationSettings.practiceMode === "triads" ||
    generationSettings.practiceMode === "cadences"
  ) {
    return {
      timeSignature: "C",
      beatsPerMeasure: 4,
    };
  }

  return null;
}
