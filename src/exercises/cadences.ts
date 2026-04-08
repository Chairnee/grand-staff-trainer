import {
  getCadenceStartingOctave,
  type GenerationSettings,
  getScaleNoteNamesForRenderedTonicName,
  getSupportedTonicForScaleType,
  keyToMidiNoteNumber,
  type ScaleHands,
} from "../theory/music";
import type { PromptAnnotation, PromptSlot } from "./types";

const CADENCE_PATTERN = ["I", "IV", "I", "V", "I"] as const;
const INVERSION_SEQUENCE = ["root", "first", "second"] as const;
const SECOND_INVERSION_CYCLE_START_INDEX =
  CADENCE_PATTERN.length * (INVERSION_SEQUENCE.length - 1);
const SECOND_CYCLE_FINAL_CHORD_INDEX =
  CADENCE_PATTERN.length * 2 - 1;
const HIGHEST_SAFE_SECOND_CYCLE_BASS_TOP_KEY = "e/4";

type CadenceDegree = (typeof CADENCE_PATTERN)[number];
type Inversion = (typeof INVERSION_SEQUENCE)[number];

export function createCadencePracticeQueue(
  generationSettings: GenerationSettings,
) {
  const trebleStartingOctave = getCadenceStartingOctave(
    generationSettings.tonic,
    generationSettings.triadType,
    generationSettings.renderingPreference,
  );
  const treblePrompts = createCadencePromptsForHand(
    generationSettings,
    trebleStartingOctave,
  );
  const bassPrompts = createCadencePromptsForHand(
    generationSettings,
    trebleStartingOctave - 1,
  );

  return createCadencePromptsForHands(
    treblePrompts,
    bassPrompts,
    generationSettings.scaleHands,
  );
}

function createCadencePromptsForHand(
  generationSettings: GenerationSettings,
  startingOctave: number,
) {
  return INVERSION_SEQUENCE.flatMap((inversion) => {
    const tonicVoicing = createCadenceChord(
      generationSettings,
      "I",
      inversion,
      startingOctave,
    );
    const subdominantVoicing = createVoiceLedCadenceChord(
      generationSettings,
      "IV",
      tonicVoicing,
    );
    const dominantVoicing = createVoiceLedCadenceChord(
      generationSettings,
      "V",
      tonicVoicing,
    );

    return [
      tonicVoicing,
      subdominantVoicing,
      tonicVoicing,
      dominantVoicing,
      tonicVoicing,
    ];
  });
}

function createCadencePromptsForHands(
  trebleChords: string[][],
  bassChords: string[][],
  scaleHands: ScaleHands,
): PromptSlot[] {
  const shouldRephraseFinalBassCycle = shouldRephraseFinalBassCycleToTreble(
    bassChords,
  );

  return trebleChords.flatMap((trebleKeys, index) => {
    const bassKeys = bassChords[index];
    const degree = CADENCE_PATTERN[index % CADENCE_PATTERN.length];
    const isFinalCadenceChord = isFinalChordOfCadenceCycle(index);
    const cadenceChordDuration = isFinalCadenceChord ? "h" : "q";

    if (!bassKeys) {
      throw new Error("Could not find matching bass cadence chord.");
    }

    const annotations = createCadenceAnnotations(scaleHands, degree);

    if (scaleHands === "treble") {
      const playablePrompt: PromptSlot = {
        duration: cadenceChordDuration,
        trebleKeys,
        annotations,
      };
      const cadenceBoundaryRest = isFinalCadenceChord
        ? createCadenceBoundaryRestPrompt("treble")
        : null;

      return cadenceBoundaryRest
        ? [playablePrompt, cadenceBoundaryRest]
        : [playablePrompt];
    }

    if (scaleHands === "bass") {
      const playablePrompt: PromptSlot = {
        duration: cadenceChordDuration,
        bassKeys,
        bassDisplayedClef:
          shouldRephraseFinalBassCycle && index >= SECOND_INVERSION_CYCLE_START_INDEX
            ? "treble"
            : undefined,
        annotations,
      };
      const cadenceBoundaryRest = isFinalCadenceChord
        ? createCadenceBoundaryRestPrompt("bass")
        : null;

      return cadenceBoundaryRest
        ? [playablePrompt, cadenceBoundaryRest]
        : [playablePrompt];
    }

    const playablePrompt: PromptSlot = {
      duration: cadenceChordDuration,
      trebleKeys,
      bassKeys,
      bassDisplayedClef:
        shouldRephraseFinalBassCycle && index >= SECOND_INVERSION_CYCLE_START_INDEX
          ? "treble"
          : undefined,
      annotations,
    };
    const cadenceBoundaryRest = isFinalCadenceChord
      ? createCadenceBoundaryRestPrompt("together")
      : null;

    return cadenceBoundaryRest
      ? [playablePrompt, cadenceBoundaryRest]
      : [playablePrompt];
  });
}

function createCadenceAnnotations(
  scaleHands: ScaleHands,
  degree: CadenceDegree,
): PromptAnnotation[] {
  return [
    {
      staff: scaleHands === "bass" ? "bass" : "treble",
      placement: "above",
      text: degree,
    },
  ];
}

function createCadenceChord(
  generationSettings: GenerationSettings,
  degree: CadenceDegree,
  inversion: Inversion,
  startingOctave: number,
) {
  const chordNoteNames = getCadenceChordNoteNames(generationSettings, degree);
  const [rootNoteName, thirdNoteName, fifthNoteName] = chordNoteNames;

  if (!rootNoteName || !thirdNoteName || !fifthNoteName) {
    throw new Error("Could not determine cadence chord note names.");
  }

  const rootKey = `${rootNoteName}/${startingOctave}`;
  const rootMidiNoteNumber = keyToMidiNoteNumber(rootKey);
  const rootPosition = chordNoteNames.map((noteName) =>
    findNextCadenceKeyAtOrAbove(noteName, rootMidiNoteNumber),
  );

  if (inversion === "root") {
    return rootPosition;
  }

  const firstInversionBassMidiNoteNumber = keyToMidiNoteNumber(
    rootPosition[1] ?? "",
  );
  const firstInversion = [
    rootPosition[1],
    rootPosition[2],
    findNextCadenceKeyAtOrAbove(rootNoteName, firstInversionBassMidiNoteNumber),
  ];

  if (inversion === "first") {
    return firstInversion;
  }

  const secondInversionBassMidiNoteNumber = keyToMidiNoteNumber(
    firstInversion[1] ?? "",
  );

  return [
    firstInversion[1],
    firstInversion[2],
    findNextCadenceKeyAtOrAbove(
      thirdNoteName,
      secondInversionBassMidiNoteNumber,
    ),
  ];
}

function createVoiceLedCadenceChord(
  generationSettings: GenerationSettings,
  degree: Exclude<CadenceDegree, "I">,
  referenceKeys: string[],
) {
  const chordNoteNames = getCadenceChordNoteNames(generationSettings, degree);
  const referenceMidiNoteNumbers = referenceKeys.map((key) =>
    keyToMidiNoteNumber(key),
  );
  const minimumReferenceMidiNoteNumber = Math.min(...referenceMidiNoteNumbers);
  const maximumReferenceMidiNoteNumber = Math.max(...referenceMidiNoteNumbers);

  let bestChord: string[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestRange = Number.POSITIVE_INFINITY;

  for (const permutation of getPermutations(chordNoteNames)) {
    const candidateKeysByVoice = permutation.map((noteName) =>
      getCadenceKeyCandidatesWithinRange(
        noteName,
        minimumReferenceMidiNoteNumber - 12,
        maximumReferenceMidiNoteNumber + 12,
      ),
    );

    const [firstVoiceCandidates, secondVoiceCandidates, thirdVoiceCandidates] =
      candidateKeysByVoice;

    for (const firstVoice of firstVoiceCandidates ?? []) {
      const firstVoiceMidiNoteNumber = keyToMidiNoteNumber(firstVoice);

      for (const secondVoice of secondVoiceCandidates ?? []) {
        const secondVoiceMidiNoteNumber = keyToMidiNoteNumber(secondVoice);

        if (secondVoiceMidiNoteNumber <= firstVoiceMidiNoteNumber) {
          continue;
        }

        for (const thirdVoice of thirdVoiceCandidates ?? []) {
          const thirdVoiceMidiNoteNumber = keyToMidiNoteNumber(thirdVoice);

          if (thirdVoiceMidiNoteNumber <= secondVoiceMidiNoteNumber) {
            continue;
          }

          const score =
            Math.abs(firstVoiceMidiNoteNumber - (referenceMidiNoteNumbers[0] ?? 0)) +
            Math.abs(secondVoiceMidiNoteNumber - (referenceMidiNoteNumbers[1] ?? 0)) +
            Math.abs(thirdVoiceMidiNoteNumber - (referenceMidiNoteNumbers[2] ?? 0));
          const range = thirdVoiceMidiNoteNumber - firstVoiceMidiNoteNumber;

          if (
            score < bestScore ||
            (score === bestScore && range < bestRange)
          ) {
            bestScore = score;
            bestRange = range;
            bestChord = [firstVoice, secondVoice, thirdVoice];
          }
        }
      }
    }
  }

  if (!bestChord) {
    throw new Error("Could not create a voice-led cadence chord.");
  }

  return bestChord;
}

function getCadenceChordNoteNames(
  generationSettings: GenerationSettings,
  degree: CadenceDegree,
) {
  const baseScaleType =
    generationSettings.triadType === "major" ? "major" : "natural-minor";
  const renderedTonic = getSupportedTonicForScaleType(
    generationSettings.tonic,
    baseScaleType,
    generationSettings.renderingPreference,
  ).toLowerCase();
  const baseScaleNoteNames = getScaleNoteNamesForRenderedTonicName(
    renderedTonic,
    baseScaleType,
  );
  const dominantScaleNoteNames =
    generationSettings.triadType === "major"
      ? baseScaleNoteNames
      : getScaleNoteNamesForRenderedTonicName(renderedTonic, "harmonic-minor");

  const noteNames =
    degree === "V" && generationSettings.triadType === "minor"
      ? dominantScaleNoteNames
      : baseScaleNoteNames;

  const degreeIndicesByChord: Record<CadenceDegree, [number, number, number]> = {
    I: [0, 2, 4],
    IV: [3, 5, 0],
    V: [4, 6, 1],
  };
  const degreeIndices = degreeIndicesByChord[degree];
  const chordNoteNames = degreeIndices.map((index) => noteNames[index]);

  if (chordNoteNames.some((noteName) => !noteName)) {
    throw new Error("Could not determine cadence chord note names.");
  }

  return chordNoteNames as [string, string, string];
}

function findNextCadenceKeyAtOrAbove(
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

function getCadenceKeyCandidatesWithinRange(
  noteName: string,
  minimumMidiNoteNumber: number,
  maximumMidiNoteNumber: number,
) {
  const minimumOctave = Math.floor(minimumMidiNoteNumber / 12) - 2;
  const maximumOctave = Math.floor(maximumMidiNoteNumber / 12);
  const keys: string[] = [];

  for (let octave = minimumOctave; octave <= maximumOctave; octave += 1) {
    const key = `${noteName}/${octave}`;
    const midiNoteNumber = keyToMidiNoteNumber(key);

    if (
      midiNoteNumber >= minimumMidiNoteNumber &&
      midiNoteNumber <= maximumMidiNoteNumber
    ) {
      keys.push(key);
    }
  }

  return keys;
}

function getPermutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) {
    return [Array.from(items)];
  }

  return items.flatMap((item, index) => {
    const remainingItems = items.filter((_, remainingIndex) => remainingIndex !== index);

    return getPermutations(remainingItems).map((permutation) => [
      item,
      ...permutation,
    ]);
  });
}

function shouldRephraseFinalBassCycleToTreble(bassChords: string[][]) {
  const finalSecondCycleTonicChord = bassChords[SECOND_CYCLE_FINAL_CHORD_INDEX];

  if (!finalSecondCycleTonicChord) {
    return false;
  }

  const highestDiatonicPosition = Math.max(
    ...finalSecondCycleTonicChord.map(getDiatonicStaffPosition),
  );

  return (
    highestDiatonicPosition >
    getDiatonicStaffPosition(HIGHEST_SAFE_SECOND_CYCLE_BASS_TOP_KEY)
  );
}

function getDiatonicStaffPosition(key: string) {
  const match = /^([a-gA-G])([#b]*?)\/(\d+)$/.exec(key);

  if (!match) {
    throw new Error(`Invalid cadence key: ${key}`);
  }

  const [, noteLetter, , octaveString] = match;
  const noteLetterOffsets: Record<string, number> = {
    c: 0,
    d: 1,
    e: 2,
    f: 3,
    g: 4,
    a: 5,
    b: 6,
  };
  const octave = Number.parseInt(octaveString, 10);
  const diatonicOffset = noteLetterOffsets[noteLetter.toLowerCase()];

  if (diatonicOffset === undefined) {
    throw new Error(`Invalid cadence note letter: ${noteLetter}`);
  }

  return octave * 7 + diatonicOffset;
}

function isFinalChordOfCadenceCycle(index: number) {
  return index % CADENCE_PATTERN.length === CADENCE_PATTERN.length - 1;
}

function createCadenceBoundaryRestPrompt(scaleHands: ScaleHands): PromptSlot {
  return {
    duration: "h",
    isPlayable: false,
    trebleRestVisible:
      scaleHands === "treble" || scaleHands === "together",
    bassRestVisible: scaleHands === "bass" || scaleHands === "together",
  };
}
