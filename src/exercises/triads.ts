import {
  type GenerationSettings,
  getAscendingTriadPositions,
  getTriadStartingOctave,
  type ScaleHands,
} from "../music";
import type { PromptSlot } from "./types";

export function createTriadPracticeQueue(
  generationSettings: GenerationSettings,
) {
  const trebleStartingOctave = getTriadStartingOctave(
    generationSettings.tonic,
    generationSettings.triadType,
    generationSettings.renderingPreference,
  );
  const trebleAscendingTriads = getAscendingTriadPositions(
    generationSettings.tonic,
    generationSettings.triadType,
    trebleStartingOctave,
    generationSettings.scaleOctaves,
    generationSettings.renderingPreference,
  );
  const bassAscendingTriads = getAscendingTriadPositions(
    generationSettings.tonic,
    generationSettings.triadType,
    trebleStartingOctave - 1,
    generationSettings.scaleOctaves,
    generationSettings.renderingPreference,
  );
  const ascendingPrompts = createTriadPromptsForHands(
    trebleAscendingTriads,
    bassAscendingTriads,
    generationSettings.scaleHands,
    generationSettings.scaleOctaves,
    "ascending",
  );
  const descendingPrompts = createTriadPromptsForHands(
    [...trebleAscendingTriads].slice(0, -1).reverse(),
    [...bassAscendingTriads].slice(0, -1).reverse(),
    generationSettings.scaleHands,
    generationSettings.scaleOctaves,
    "descending",
  );

  return [...ascendingPrompts, ...descendingPrompts.slice(0, -1)];
}

function createTriadPromptsForHands(
  trebleTriads: string[][],
  bassTriads: string[][],
  scaleHands: ScaleHands,
  scaleOctaves: GenerationSettings["scaleOctaves"],
  direction: "ascending" | "descending",
): PromptSlot[] {
  return trebleTriads.map((trebleKeys, index) => {
    const bassKeys = bassTriads[index];

    if (!bassKeys) {
      throw new Error("Could not find matching bass triad.");
    }

    const prompt = createTriadPrompt(
      trebleKeys,
      bassKeys,
      scaleOctaves,
      direction,
      index,
    );

    if (scaleHands === "treble") {
      return {
        ...prompt,
        bassKeys: undefined,
        displayedBassKeys: undefined,
        bassDisplayedClef: undefined,
      };
    }

    if (scaleHands === "bass") {
      return {
        ...prompt,
        trebleKeys: undefined,
        displayedTrebleKeys: undefined,
        trebleOttavaStart: undefined,
        trebleOttavaEnd: undefined,
      };
    }

    return prompt;
  });
}

function createTriadPrompt(
  trebleKeys: string[],
  bassKeys: string[],
  scaleOctaves: GenerationSettings["scaleOctaves"],
  direction: "ascending" | "descending",
  index: number,
): PromptSlot {
  if (scaleOctaves === 1) {
    return {
      duration: "q",
      trebleKeys,
      bassKeys,
    };
  }

  const isWithinTrebleOttavaSpan = isWithinTwoOctaveMiddleSpan(
    direction,
    index,
  );
  const displayedTrebleKeys = isWithinTrebleOttavaSpan
    ? trebleKeys.map((key) => shiftKeyByOctaves(key, -1))
    : undefined;
  const bassDisplayedClef = isWithinTrebleOttavaSpan ? "treble" : "bass";

  return {
    duration: "q",
    trebleKeys,
    bassKeys,
    displayedTrebleKeys,
    bassDisplayedClef,
    trebleOttavaStart: direction === "ascending" && index === 3,
    trebleOttavaEnd: direction === "descending" && index === 2,
  };
}

function isWithinTwoOctaveMiddleSpan(
  direction: "ascending" | "descending",
  index: number,
) {
  if (direction === "ascending") {
    return index >= 3;
  }

  return index <= 2;
}

function shiftKeyByOctaves(key: string, octaveDelta: number) {
  const [noteName, octaveText] = key.split("/");

  if (!noteName || !octaveText) {
    throw new Error(`Invalid key format: ${key}`);
  }

  const octave = Number.parseInt(octaveText, 10);

  if (Number.isNaN(octave)) {
    throw new Error(`Invalid octave in key: ${key}`);
  }

  return `${noteName}/${octave + octaveDelta}`;
}
