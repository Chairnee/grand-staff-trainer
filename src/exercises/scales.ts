import {
  type GenerationSettings,
  getAscendingScaleKeys,
  getScaleStartingOctave,
  type ScaleHands,
} from "../music";
import type { PromptSlot } from "./types";

export function createScalePracticeQueue(
  generationSettings: GenerationSettings,
) {
  const trebleStartingOctave = getScaleStartingOctave(
    generationSettings.tonic,
    generationSettings.scaleType,
  );
  const trebleAscendingKeys = getAscendingScaleKeys(
    generationSettings.tonic,
    generationSettings.scaleType,
    trebleStartingOctave,
    generationSettings.scaleOctaves,
  );
  const bassAscendingKeys = getAscendingScaleKeys(
    generationSettings.tonic,
    generationSettings.scaleType,
    trebleStartingOctave - 1,
    generationSettings.scaleOctaves,
  );
  const ascendingPrompts = createScalePromptsForHands(
    trebleAscendingKeys,
    bassAscendingKeys,
    generationSettings.scaleHands,
  );
  const descendingPrompts = createScalePromptsForHands(
    [...trebleAscendingKeys].slice(0, -1).reverse(),
    [...bassAscendingKeys].slice(0, -1).reverse(),
    generationSettings.scaleHands,
  );

  return [...ascendingPrompts, ...descendingPrompts.slice(0, -1)];
}

function createScalePromptsForHands(
  trebleKeys: string[],
  bassKeys: string[],
  scaleHands: ScaleHands,
): PromptSlot[] {
  if (scaleHands === "treble") {
    return trebleKeys.map((key) => ({
      duration: "q",
      trebleKeys: [key],
    }));
  }

  if (scaleHands === "bass") {
    return bassKeys.map((key) => ({
      duration: "q",
      bassKeys: [key],
    }));
  }

  return trebleKeys.map((trebleKey, index) => {
    const bassKey = bassKeys[index];

    if (!bassKey) {
      throw new Error("Could not find matching bass scale note.");
    }

    return {
      duration: "q",
      trebleKeys: [trebleKey],
      bassKeys: [bassKey],
    };
  });
}
