import type { GenerationSettings } from "../music";
import {
  createRandomNotePromptQueue,
  fillRandomNotePromptQueue,
} from "./randomNotes";
import { createScalePracticeQueue } from "./scales";
import { createTriadPracticeQueue } from "./triads";
import type { PromptSlot } from "./types";

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

  fillRandomNotePromptQueue(
    promptQueue,
    length,
    generationSettings,
    generatedNotePool,
  );
}
