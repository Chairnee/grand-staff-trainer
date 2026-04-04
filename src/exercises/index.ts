import type { GenerationSettings } from "../music";
import {
  createRandomNotePromptQueue,
  fillRandomNotePromptQueue,
} from "./randomNotes";
import { createScalePracticeQueue } from "./scales";
import type { PromptSlot } from "./types";

export function createExercisePromptQueue(
  length: number,
  generationSettings: GenerationSettings,
  generatedNotePool: string[],
) {
  if (generationSettings.practiceMode === "scales") {
    return createScalePracticeQueue(generationSettings);
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

  fillRandomNotePromptQueue(
    promptQueue,
    length,
    generationSettings,
    generatedNotePool,
  );
}
