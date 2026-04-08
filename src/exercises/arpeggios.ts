import {
  type GenerationSettings,
  getTriadNoteNames,
  getTriadStartingOctave,
  keyToMidiNoteNumber,
  type ScaleHands,
} from "../theory/music";
import type { PromptSlot } from "./types";

export function createArpeggioPracticeQueue(
  generationSettings: GenerationSettings,
) {
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

  return [...ascendingPrompts, ...descendingPrompts];
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
