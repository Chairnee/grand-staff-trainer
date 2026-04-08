import {
  getAscendingScaleKeysForRenderedTonicName,
  getDescendingScaleStartingOctave,
  type GenerationSettings,
  getAscendingScaleKeys,
  getScaleStartingOctave,
  getSupportedTonicForScaleType,
  keyToMidiNoteNumber,
  getScaleNoteNames,
  type ScaleHands,
  type ScaleType,
} from "../theory/music";
import type { PromptSlot } from "./types";

function getDescendingMotionScaleType(scaleType: ScaleType): ScaleType {
  return scaleType === "melodic-minor" ? "natural-minor" : scaleType;
}

function getExerciseMovementScaleKeys(
  generationSettings: GenerationSettings,
  movementScaleType: ScaleType,
  startingOctave: number,
) {
  if (generationSettings.scaleType === "melodic-minor") {
    const renderedTonic = getSupportedTonicForScaleType(
      generationSettings.tonic,
      generationSettings.scaleType,
      generationSettings.renderingPreference,
    );

    return getAscendingScaleKeysForRenderedTonicName(
      renderedTonic,
      movementScaleType,
      startingOctave,
      generationSettings.scaleOctaves,
    );
  }

  return getAscendingScaleKeys(
    generationSettings.tonic,
    movementScaleType,
    startingOctave,
    generationSettings.scaleOctaves,
    generationSettings.renderingPreference,
  );
}

export function createScalePracticeQueue(
  generationSettings: GenerationSettings,
) {
  if (
    generationSettings.scaleHands === "together" &&
    generationSettings.scaleMotion === "contrary"
  ) {
    return createContraryMotionScalePracticeQueue(generationSettings);
  }

  if (
    generationSettings.scaleHands !== "together" &&
    generationSettings.scaleDirection === "descending"
  ) {
    return createDescendingSingleHandScalePracticeQueue(generationSettings);
  }

  const trebleStartingOctave = getScaleStartingOctave(
    generationSettings.tonic,
    generationSettings.scaleType,
    generationSettings.renderingPreference,
  );
  const trebleAscendingKeys = getExerciseMovementScaleKeys(
    generationSettings,
    generationSettings.scaleType,
    trebleStartingOctave,
  );
  const bassAscendingKeys = getExerciseMovementScaleKeys(
    generationSettings,
    generationSettings.scaleType,
    trebleStartingOctave - 1,
  );
  const descendingScaleType = getDescendingMotionScaleType(
    generationSettings.scaleType,
  );
  const trebleDescendingKeys = getExerciseMovementScaleKeys(
    generationSettings,
    descendingScaleType,
    trebleStartingOctave,
  )
    .slice(0, -1)
    .reverse();
  const bassDescendingKeys = getExerciseMovementScaleKeys(
    generationSettings,
    descendingScaleType,
    trebleStartingOctave - 1,
  )
    .slice(0, -1)
    .reverse();
  const ascendingPrompts = createScalePromptsForHands(
    trebleAscendingKeys,
    bassAscendingKeys,
    generationSettings.scaleHands,
  );
  const descendingPrompts = createScalePromptsForHands(
    trebleDescendingKeys,
    bassDescendingKeys,
    generationSettings.scaleHands,
  );

  return [...ascendingPrompts, ...descendingPrompts.slice(0, -1)];
}

function createDescendingSingleHandScalePracticeQueue(
  generationSettings: GenerationSettings,
) : PromptSlot[] {
  const scaleHands = generationSettings.scaleHands;

  if (scaleHands === "together") {
    throw new Error("Descending single-hand scales require a single hand.");
  }

  const descendingStartingOctave = getDescendingScaleStartingOctave(
    generationSettings.tonic,
    generationSettings.scaleType,
    generationSettings.scaleOctaves,
    scaleHands,
    generationSettings.renderingPreference,
  );
  const descendingKeys = getExerciseMovementScaleKeys(
    generationSettings,
    getDescendingMotionScaleType(generationSettings.scaleType),
    descendingStartingOctave,
  ).reverse();
  const ascendingKeys = getExerciseMovementScaleKeys(
    generationSettings,
    generationSettings.scaleType,
    descendingStartingOctave,
  ).slice(1);

  if (scaleHands === "treble") {
    return [
      ...descendingKeys.map((key) => ({
        duration: "q" as const,
        trebleKeys: [key],
      })),
      ...ascendingKeys.map((key) => ({
        duration: "q" as const,
        trebleKeys: [key],
      })),
    ];
  }

  return [
    ...descendingKeys.map((key) => ({
      duration: "q" as const,
      bassKeys: [key],
    })),
    ...ascendingKeys.map((key) => ({
      duration: "q" as const,
      bassKeys: [key],
    })),
  ];
}

function createContraryMotionScalePracticeQueue(
  generationSettings: GenerationSettings,
) {
  const sharedStartingOctave = getContraryMotionStartingOctave(generationSettings);
  const trebleAscendingKeys = getExerciseMovementScaleKeys(
    generationSettings,
    generationSettings.scaleType,
    sharedStartingOctave,
  );
  const bassDescendingKeys = getExerciseMovementScaleKeys(
    generationSettings,
    getDescendingMotionScaleType(generationSettings.scaleType),
    sharedStartingOctave - generationSettings.scaleOctaves,
  ).reverse();
  const outwardPrompts = createScalePromptsForHands(
    trebleAscendingKeys,
    bassDescendingKeys,
    "together",
  );
  const trebleDescendingKeys = getExerciseMovementScaleKeys(
    generationSettings,
    getDescendingMotionScaleType(generationSettings.scaleType),
    sharedStartingOctave,
  )
    .reverse()
    .slice(1);
  const bassAscendingKeys = getExerciseMovementScaleKeys(
    generationSettings,
    generationSettings.scaleType,
    sharedStartingOctave - generationSettings.scaleOctaves,
  ).slice(1);
  const inwardPrompts = createScalePromptsForHands(
    trebleDescendingKeys,
    bassAscendingKeys,
    "together",
  );

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
    const trebleKeys = getExerciseMovementScaleKeys(
      generationSettings,
      generationSettings.scaleType,
      octave,
    );
    const bassKeys = getExerciseMovementScaleKeys(
      generationSettings,
      getDescendingMotionScaleType(generationSettings.scaleType),
      octave - generationSettings.scaleOctaves,
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
