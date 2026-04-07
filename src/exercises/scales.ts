import {
  type GenerationSettings,
  getAscendingScaleKeys,
  getScaleNoteNames,
  getScaleStartingOctave,
  type ScaleHands,
  keyToMidiNoteNumber,
} from "../theory/music";
import type { PromptSlot } from "./types";

export function createScalePracticeQueue(
  generationSettings: GenerationSettings,
) {
  if (
    generationSettings.scaleHands === "together" &&
    generationSettings.scaleMotion === "contrary"
  ) {
    return createContraryMotionScalePracticeQueue(generationSettings);
  }

  const trebleStartingOctave = getScaleStartingOctave(
    generationSettings.tonic,
    generationSettings.scaleType,
    generationSettings.renderingPreference,
  );
  const trebleAscendingKeys = getAscendingScaleKeys(
    generationSettings.tonic,
    generationSettings.scaleType,
    trebleStartingOctave,
    generationSettings.scaleOctaves,
    generationSettings.renderingPreference,
  );
  const bassAscendingKeys = getAscendingScaleKeys(
    generationSettings.tonic,
    generationSettings.scaleType,
    trebleStartingOctave - 1,
    generationSettings.scaleOctaves,
    generationSettings.renderingPreference,
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

function createContraryMotionScalePracticeQueue(
  generationSettings: GenerationSettings,
) {
  const sharedStartingOctave = getContraryMotionStartingOctave(generationSettings);
  const trebleAscendingKeys = getAscendingScaleKeys(
    generationSettings.tonic,
    generationSettings.scaleType,
    sharedStartingOctave,
    generationSettings.scaleOctaves,
    generationSettings.renderingPreference,
  );
  const bassDescendingKeys = getAscendingScaleKeys(
    generationSettings.tonic,
    generationSettings.scaleType,
    sharedStartingOctave - generationSettings.scaleOctaves,
    generationSettings.scaleOctaves,
    generationSettings.renderingPreference,
  ).reverse();
  const outwardPrompts = createScalePromptsForHands(
    trebleAscendingKeys,
    bassDescendingKeys,
    "together",
  );
  const inwardPrompts = [...outwardPrompts].slice(0, -1).reverse();

  return [...outwardPrompts, ...inwardPrompts.slice(0, -1)];
}

function getContraryMotionStartingOctave(
  generationSettings: GenerationSettings,
) {
  const scaleNoteNames = getScaleNoteNames(
    generationSettings.tonic,
    generationSettings.scaleType,
    generationSettings.renderingPreference,
  );
  const tonicNoteName = scaleNoteNames[0];

  if (!tonicNoteName) {
    throw new Error("Could not determine contrary-motion starting tonic.");
  }

  const candidateOctaves = [3, 4];
  const preferredCenterMidi = keyToMidiNoteNumber("c/4");
  const minimumMidi = keyToMidiNoteNumber("c/2");
  const maximumMidi = keyToMidiNoteNumber("c/6");

  const rankedCandidates = candidateOctaves.map((octave) => {
    const trebleKeys = getAscendingScaleKeys(
      generationSettings.tonic,
      generationSettings.scaleType,
      octave,
      generationSettings.scaleOctaves,
      generationSettings.renderingPreference,
    );
    const bassKeys = getAscendingScaleKeys(
      generationSettings.tonic,
      generationSettings.scaleType,
      octave - generationSettings.scaleOctaves,
      generationSettings.scaleOctaves,
      generationSettings.renderingPreference,
    ).reverse();
    const midiNotes = [...trebleKeys, ...bassKeys].map(keyToMidiNoteNumber);
    const lowestMidi = Math.min(...midiNotes);
    const highestMidi = Math.max(...midiNotes);
    const lowOverflow = Math.max(0, minimumMidi - lowestMidi);
    const highOverflow = Math.max(0, highestMidi - maximumMidi);
    const centerDistance = Math.abs(
      keyToMidiNoteNumber(`${tonicNoteName}/${octave}`) - preferredCenterMidi,
    );

    return {
      octave,
      score: (lowOverflow + highOverflow) * 100 + centerDistance,
    };
  });

  rankedCandidates.sort((left, right) => left.score - right.score);

  return rankedCandidates[0]?.octave ?? 4;
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
