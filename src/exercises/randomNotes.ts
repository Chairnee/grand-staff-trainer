import {
  type GenerationSettings,
  getClefForKey,
  getGeneratedNotePool,
  getNotesInScale,
} from "../theory/music";
import type { PromptSlot } from "./types";

export function createRandomNotePromptQueue(
  length: number,
  generationSettings: GenerationSettings,
  generatedNotePool: string[],
) {
  const promptQueue: PromptSlot[] = [];

  fillRandomNotePromptQueue(
    promptQueue,
    length,
    generationSettings,
    generatedNotePool,
  );

  return promptQueue;
}

export function fillRandomNotePromptQueue(
  promptQueue: PromptSlot[],
  length: number,
  generationSettings: GenerationSettings,
  generatedNotePool: string[],
) {
  while (promptQueue.length < length) {
    promptQueue.push(
      generateRandomNotePrompt(
        promptQueue.at(-1) ?? null,
        generationSettings,
        generatedNotePool,
      ),
    );
  }
}

function generateRandomNotePrompt(
  previousPrompt: PromptSlot | null,
  generationSettings: GenerationSettings,
  generatedNotePool: string[],
): PromptSlot {
  const allowedGeneratedNotes = getAllowedGeneratedNotes(
    generationSettings,
    generatedNotePool,
  );
  const previousKey =
    previousPrompt?.trebleKeys?.[0] ?? previousPrompt?.bassKeys?.[0] ?? null;
  const availableKeys = allowedGeneratedNotes.filter(
    (key) => key !== previousKey,
  );
  const key = pickRandomItem(
    availableKeys.length > 0 ? availableKeys : allowedGeneratedNotes,
  );

  if (getClefForKey(key) === "treble") {
    return {
      duration: "q",
      trebleKeys: [key],
    };
  }

  return {
    duration: "q",
    bassKeys: [key],
  };
}

function getAllowedGeneratedNotes(
  generationSettings: GenerationSettings,
  generatedNotePool: string[],
) {
  if (generationSettings.noteSourceMode === "in-scale") {
    return getNotesInScale(
      generationSettings.rangeStart,
      generationSettings.rangeEnd,
      generationSettings.tonic,
      generationSettings.scaleType,
      generationSettings.renderingPreference,
    );
  }

  return getGeneratedNotePool(
    generatedNotePool,
    generationSettings.rangeStart,
    generationSettings.rangeEnd,
    generationSettings.accidentalSpellingMode,
  );
}

function pickRandomItem<Item>(items: Item[]) {
  const randomIndex = Math.floor(Math.random() * items.length);
  const item = items[randomIndex];

  if (item === undefined) {
    throw new Error("Cannot pick a random item from an empty list.");
  }

  return item;
}
