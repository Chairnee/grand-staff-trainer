import {
  type GenerationSettings,
  getDescendingScaleStartingOctave,
  getTriadNoteNames,
  getTriadStartingOctave,
  keyToMidiNoteNumber,
  type ScaleHands,
} from "../theory/music";
import type { PromptSlot } from "./types";

export function createArpeggioPracticeQueue(
  generationSettings: GenerationSettings,
): PromptSlot[] {
  if (
    generationSettings.scaleHands !== "together" &&
    generationSettings.scaleDirection === "descending"
  ) {
    return createDescendingSingleHandArpeggioPracticeQueue(generationSettings);
  }

  if (
    generationSettings.scaleHands === "together" &&
    generationSettings.scaleMotion === "contrary"
  ) {
    return createContraryMotionArpeggioPracticeQueue(generationSettings);
  }

  const trebleStartingOctave = getTriadStartingOctave(
    generationSettings.tonic,
    generationSettings.triadType,
    generationSettings.renderingPreference,
  );
  const trebleAscendingKeys = getAscendingArpeggioKeys(
    generationSettings,
    trebleStartingOctave,
  );
  const bassAscendingKeys = getAscendingArpeggioKeys(
    generationSettings,
    trebleStartingOctave - 1,
  );
  const ascendingPrompts = createArpeggioPromptsForHands(
    trebleAscendingKeys,
    bassAscendingKeys,
    generationSettings.scaleHands,
  );
  const descendingPrompts = createArpeggioPromptsForHands(
    [...trebleAscendingKeys].slice(0, -1).reverse(),
    [...bassAscendingKeys].slice(0, -1).reverse(),
    generationSettings.scaleHands,
  );

  return [...ascendingPrompts, ...descendingPrompts.slice(0, -1)];
}

function createDescendingSingleHandArpeggioPracticeQueue(
  generationSettings: GenerationSettings,
): PromptSlot[] {
  const scaleHands = generationSettings.scaleHands;

  if (scaleHands === "together") {
    throw new Error("Descending single-hand arpeggios require a single hand.");
  }

  const descendingStartingOctave = getDescendingScaleStartingOctave(
    generationSettings.tonic,
    generationSettings.triadType === "major" ? "major" : "natural-minor",
    generationSettings.scaleOctaves,
    scaleHands,
    generationSettings.renderingPreference,
  );
  const descendingKeys = getAscendingArpeggioKeys(
    generationSettings,
    descendingStartingOctave,
  ).reverse();
  const ascendingKeys = getAscendingArpeggioKeys(
    generationSettings,
    descendingStartingOctave,
  ).slice(1);

  if (scaleHands === "treble") {
    const prompts: PromptSlot[] = [
      ...descendingKeys.map((key) => ({
        duration: "q" as const,
        trebleKeys: [key],
      })),
      ...ascendingKeys.map((key) => ({
        duration: "q" as const,
        trebleKeys: [key],
      })),
    ];

    return prompts.slice(0, -1);
  }

  const prompts: PromptSlot[] = [
    ...descendingKeys.map((key) => ({
      duration: "q" as const,
      bassKeys: [key],
    })),
    ...ascendingKeys.map((key) => ({
      duration: "q" as const,
      bassKeys: [key],
    })),
  ];

  return prompts.slice(0, -1);
}

function createContraryMotionArpeggioPracticeQueue(
  generationSettings: GenerationSettings,
): PromptSlot[] {
  const sharedStartingOctave =
    getContraryMotionArpeggioStartingOctave(generationSettings);
  const trebleAscendingKeys = getAscendingArpeggioKeys(
    generationSettings,
    sharedStartingOctave,
  );
  const bassDescendingKeys = getAscendingArpeggioKeys(
    generationSettings,
    sharedStartingOctave - generationSettings.scaleOctaves,
  ).reverse();
  const outwardPrompts = createArpeggioPromptsForHands(
    trebleAscendingKeys,
    bassDescendingKeys,
    "together",
  );
  const trebleDescendingKeys = [...trebleAscendingKeys].reverse().slice(1);
  const bassAscendingKeys = getAscendingArpeggioKeys(
    generationSettings,
    sharedStartingOctave - generationSettings.scaleOctaves,
  ).slice(1);
  const inwardPrompts = createArpeggioPromptsForHands(
    trebleDescendingKeys,
    bassAscendingKeys,
    "together",
  );

  return [...outwardPrompts, ...inwardPrompts.slice(0, -1)];
}

function getAscendingArpeggioKeys(
  generationSettings: GenerationSettings,
  startingOctave: number,
) {
  const triadNoteNames = getTriadNoteNames(
    generationSettings.tonic,
    generationSettings.triadType,
    generationSettings.renderingPreference,
  );
  const [rootNoteName, thirdNoteName, fifthNoteName] = triadNoteNames;

  if (!rootNoteName || !thirdNoteName || !fifthNoteName) {
    throw new Error("Could not determine arpeggio note names.");
  }

  const ascendingKeys: string[] = [];

  for (
    let octaveIndex = 0;
    octaveIndex <= generationSettings.scaleOctaves;
    octaveIndex += 1
  ) {
    const rootKey = `${rootNoteName}/${startingOctave + octaveIndex}`;
    ascendingKeys.push(rootKey);

    if (octaveIndex === generationSettings.scaleOctaves) {
      continue;
    }

    const rootMidiNoteNumber = keyToMidiNoteNumber(rootKey);
    ascendingKeys.push(
      findNextArpeggioKeyAtOrAbove(thirdNoteName, rootMidiNoteNumber),
    );
    ascendingKeys.push(
      findNextArpeggioKeyAtOrAbove(fifthNoteName, rootMidiNoteNumber),
    );
  }

  return ascendingKeys;
}

function createArpeggioPromptsForHands(
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
      throw new Error("Could not find matching bass arpeggio note.");
    }

    return {
      duration: "q",
      trebleKeys: [trebleKey],
      bassKeys: [bassKey],
    };
  });
}

function findNextArpeggioKeyAtOrAbove(
  noteName: string,
  minimumMidiNoteNumber: number,
) {
  let octave = Math.floor(minimumMidiNoteNumber / 12) - 1;
  let key = `${noteName}/${octave}`;
  let midiNoteNumber = keyToMidiNoteNumber(key);

  while (midiNoteNumber < minimumMidiNoteNumber) {
    octave += 1;
    key = `${noteName}/${octave}`;
    midiNoteNumber = keyToMidiNoteNumber(key);
  }

  return key;
}

function getContraryMotionArpeggioStartingOctave(
  generationSettings: GenerationSettings,
) {
  const triadNoteNames = getTriadNoteNames(
    generationSettings.tonic,
    generationSettings.triadType,
    generationSettings.renderingPreference,
  );
  const tonicNoteName = triadNoteNames[0];

  if (!tonicNoteName) {
    throw new Error("Could not determine contrary-motion arpeggio tonic.");
  }

  const candidateOctaves = [3, 4];
  const preferredCenterMidi = keyToMidiNoteNumber("c/4");
  const minimumMidi = keyToMidiNoteNumber("c/2");
  const maximumMidi = keyToMidiNoteNumber("c/6");

  const rankedCandidates = candidateOctaves.map((octave) => {
    const trebleKeys = getAscendingArpeggioKeys(generationSettings, octave);
    const bassKeys = getAscendingArpeggioKeys(
      generationSettings,
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
