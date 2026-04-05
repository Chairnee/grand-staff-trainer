import type { PromptSlot } from "./exercises/types";

const SHARP_KEY_SIGNATURE_ORDER = ["f", "c", "g", "d", "a", "e", "b"];
const FLAT_KEY_SIGNATURE_ORDER = ["b", "e", "a", "d", "g", "c", "f"];

export type PracticeMode = "random-notes" | "scales";
export type ScaleHands = "treble" | "bass" | "together";
export type ScaleOctaves = 1 | 2;
export type NoteSourceMode = "chromatic" | "in-scale";
export type AccidentalSpellingMode = "sharps" | "flats";
export type KeySignature =
  | "C"
  | "G"
  | "D"
  | "A"
  | "E"
  | "B"
  | "F#"
  | "C#"
  | "F"
  | "Bb"
  | "Eb"
  | "Ab"
  | "Db"
  | "Gb"
  | "Cb";
export type ScaleType =
  | "major"
  | "natural-minor"
  | "harmonic-minor"
  | "melodic-minor";
export type MajorTonic =
  | "C"
  | "G"
  | "D"
  | "A"
  | "E"
  | "B"
  | "F#"
  | "C#"
  | "F"
  | "Bb"
  | "Eb"
  | "Ab"
  | "Db"
  | "Gb"
  | "Cb";
export type MinorTonic =
  | "A"
  | "E"
  | "B"
  | "F#"
  | "C#"
  | "G#"
  | "D#"
  | "A#"
  | "D"
  | "G"
  | "C"
  | "F"
  | "Bb"
  | "Eb"
  | "Ab";
export type Tonic = MajorTonic | MinorTonic;

export type GenerationSettings = {
  practiceMode: PracticeMode;
  scaleHands: ScaleHands;
  scaleOctaves: ScaleOctaves;
  rangeStart: string;
  rangeEnd: string;
  noteSourceMode: NoteSourceMode;
  accidentalSpellingMode: AccidentalSpellingMode;
  tonic: Tonic;
  scaleType: ScaleType;
};

const MAJOR_KEY_SIGNATURE_BY_TONIC: Record<MajorTonic, KeySignature> = {
  C: "C",
  G: "G",
  D: "D",
  A: "A",
  E: "E",
  B: "B",
  "F#": "F#",
  "C#": "C#",
  F: "F",
  Bb: "Bb",
  Eb: "Eb",
  Ab: "Ab",
  Db: "Db",
  Gb: "Gb",
  Cb: "Cb",
};
const MINOR_KEY_SIGNATURE_BY_TONIC: Record<MinorTonic, KeySignature> = {
  A: "C",
  E: "G",
  B: "D",
  "F#": "A",
  "C#": "E",
  "G#": "B",
  "D#": "F#",
  "A#": "C#",
  D: "F",
  G: "Bb",
  C: "Eb",
  F: "Ab",
  Bb: "Db",
  Eb: "Gb",
  Ab: "Cb",
};
const MAJOR_TONICS = Object.keys(MAJOR_KEY_SIGNATURE_BY_TONIC) as MajorTonic[];
const MINOR_TONICS = Object.keys(MINOR_KEY_SIGNATURE_BY_TONIC) as MinorTonic[];
const ALL_TONICS: Tonic[] = [
  "C",
  "G",
  "D",
  "A",
  "E",
  "B",
  "F#",
  "C#",
  "G#",
  "D#",
  "A#",
  "F",
  "Bb",
  "Eb",
  "Ab",
  "Db",
  "Gb",
  "Cb",
];
const ENHARMONIC_MAJOR_TONIC_BY_MINOR_TONIC: Partial<
  Record<MinorTonic, MajorTonic>
> = {
  "G#": "Ab",
  "D#": "Eb",
  "A#": "Bb",
};
const ENHARMONIC_MINOR_TONIC_BY_MAJOR_TONIC: Partial<
  Record<MajorTonic, MinorTonic>
> = {
  Db: "C#",
  Gb: "F#",
  Cb: "B",
};

export function keyToMidiNoteNumber(key: string) {
  const [noteName, octaveText] = key.split("/");

  if (!noteName || !octaveText) {
    throw new Error(`Invalid key format: ${key}`);
  }

  const naturalSemitone = getNaturalSemitoneForNoteName(noteName);
  const accidentalOffset = getAccidentalOffsetForNoteName(noteName);
  const octave = Number.parseInt(octaveText, 10);

  if (Number.isNaN(octave)) {
    throw new Error(`Invalid octave in key: ${key}`);
  }

  return (octave + 1) * 12 + naturalSemitone + accidentalOffset;
}

export function getAccidentalOffsetForNoteName(noteName: string) {
  const accidentalText = noteName.slice(1);
  let accidentalOffset = 0;

  for (const character of accidentalText) {
    if (character === "#") {
      accidentalOffset += 1;
      continue;
    }

    if (character === "b") {
      accidentalOffset -= 1;
      continue;
    }

    throw new Error(`Unsupported accidental in note name: ${noteName}`);
  }

  return accidentalOffset;
}

export function getRenderedAccidentalForKey(
  key: string,
  keySignature: KeySignature | null,
) {
  const [noteName] = key.split("/");

  if (!noteName) {
    return null;
  }

  const actualAccidental = noteName.slice(1);

  if (!keySignature) {
    return actualAccidental || null;
  }

  const impliedAccidentals = getKeySignatureAccidentals(keySignature);
  const impliedAccidental =
    impliedAccidentals[noteName.charAt(0).toLowerCase()] ?? "";

  if (actualAccidental === impliedAccidental) {
    return null;
  }

  if (!actualAccidental && impliedAccidental) {
    return "n";
  }

  return actualAccidental || null;
}

export function getDerivedKeySignature(generationSettings: GenerationSettings) {
  const supportedTonic = getSupportedTonicForScaleType(
    generationSettings.tonic,
    generationSettings.scaleType,
  );

  if (generationSettings.scaleType === "major") {
    return MAJOR_KEY_SIGNATURE_BY_TONIC[supportedTonic as MajorTonic];
  }

  return MINOR_KEY_SIGNATURE_BY_TONIC[supportedTonic as MinorTonic];
}

export function getTonicsForScaleType(scaleType: ScaleType): Tonic[] {
  if (scaleType === "major") {
    return MAJOR_TONICS;
  }

  return MINOR_TONICS;
}

export function getAllTonics(): Tonic[] {
  return ALL_TONICS;
}

export function isTonicSupportedForScaleType(
  tonic: Tonic,
  scaleType: ScaleType,
) {
  if (scaleType === "major") {
    return MAJOR_TONICS.includes(tonic as MajorTonic);
  }

  return MINOR_TONICS.includes(tonic as MinorTonic);
}

export function getSupportedTonicForScaleType(
  tonic: Tonic,
  scaleType: ScaleType,
): Tonic {
  if (scaleType === "major") {
    if (MAJOR_TONICS.includes(tonic as MajorTonic)) {
      return tonic;
    }

    return ENHARMONIC_MAJOR_TONIC_BY_MINOR_TONIC[tonic as MinorTonic] ?? "C";
  }

  if (MINOR_TONICS.includes(tonic as MinorTonic)) {
    return tonic;
  }

  return ENHARMONIC_MINOR_TONIC_BY_MAJOR_TONIC[tonic as MajorTonic] ?? "A";
}

export function isScaleTypeSupportedForTonic(
  tonic: Tonic,
  scaleType: ScaleType,
) {
  if (scaleType === "major") {
    return true;
  }

  return MINOR_TONICS.includes(tonic as MinorTonic);
}

export function getSupportedScaleTypeForTonic(
  tonic: Tonic,
  scaleType: ScaleType,
): ScaleType {
  if (isScaleTypeSupportedForTonic(tonic, scaleType)) {
    return scaleType;
  }

  return "major";
}

export function getAccidentalSpellingModeForKeySignature(
  keySignature: KeySignature | null,
): AccidentalSpellingMode {
  if (!keySignature) {
    return "sharps";
  }

  const flatKeySignatures: KeySignature[] = [
    "F",
    "Bb",
    "Eb",
    "Ab",
    "Db",
    "Gb",
    "Cb",
  ];

  return flatKeySignatures.includes(keySignature) ? "flats" : "sharps";
}

export function createKeyboardNotePool(
  startMidiNote: number,
  endMidiNote: number,
) {
  const notePool: string[] = [];

  for (
    let midiNoteNumber = startMidiNote;
    midiNoteNumber <= endMidiNote;
    midiNoteNumber += 1
  ) {
    notePool.push(midiNoteNumberToKey(midiNoteNumber, "sharps"));
  }

  return notePool;
}

export function getScaleStartingOctave(tonic: Tonic) {
  return isTrebleScaleStartWithinUpperLimit(tonic.toLowerCase()) ? 4 : 3;
}

export function getAscendingScaleKeys(
  tonic: Tonic,
  scaleType: ScaleType,
  startingOctave: number,
  scaleOctaves: ScaleOctaves,
) {
  const scaleNoteNames = getScaleNoteNames(tonic, scaleType);
  const ascendingNoteNames = Array.from({ length: scaleOctaves }).flatMap(
    () => {
      return scaleNoteNames;
    },
  );
  ascendingNoteNames.push(tonic.toLowerCase());
  const ascendingKeys: string[] = [];
  let currentOctave = startingOctave;
  let previousMidiNoteNumber = -Infinity;

  for (const noteName of ascendingNoteNames) {
    let key = `${noteName}/${currentOctave}`;
    let midiNoteNumber = keyToMidiNoteNumber(key);

    while (midiNoteNumber <= previousMidiNoteNumber) {
      currentOctave += 1;
      key = `${noteName}/${currentOctave}`;
      midiNoteNumber = keyToMidiNoteNumber(key);
    }

    ascendingKeys.push(key);
    previousMidiNoteNumber = midiNoteNumber;
  }

  return ascendingKeys;
}

export function getClefForKey(key: string): "treble" | "bass" {
  return keyToMidiNoteNumber(key) < 60 ? "bass" : "treble";
}

export function compareKeysByMidiNumber(left: string, right: string) {
  return keyToMidiNoteNumber(left) - keyToMidiNoteNumber(right);
}

export function getNotesInScale(
  rangeStart: string,
  rangeEnd: string,
  tonic: Tonic,
  scaleType: ScaleType,
) {
  const startMidiNoteNumber = keyToMidiNoteNumber(rangeStart);
  const endMidiNoteNumber = keyToMidiNoteNumber(rangeEnd);
  const scaleNoteNames = getScaleNoteNames(tonic, scaleType);
  const notesInKey: Array<{ key: string; midiNoteNumber: number }> = [];

  for (
    let octave = getOctaveForKey(rangeStart) - 1;
    octave <= getOctaveForKey(rangeEnd) + 1;
    octave += 1
  ) {
    for (const noteName of scaleNoteNames) {
      const key = `${noteName}/${octave}`;
      const midiNoteNumber = keyToMidiNoteNumber(key);

      if (
        midiNoteNumber < startMidiNoteNumber ||
        midiNoteNumber > endMidiNoteNumber
      ) {
        continue;
      }

      notesInKey.push({
        key,
        midiNoteNumber,
      });
    }
  }

  notesInKey.sort((left, right) => left.midiNoteNumber - right.midiNoteNumber);

  return notesInKey.map((note) => note.key);
}

export function getScaleNoteNames(tonic: Tonic, scaleType: ScaleType) {
  const tonicNoteName = tonic.toLowerCase();
  const tonicMidiNoteNumber = keyToMidiNoteNumber(`${tonicNoteName}/4`);
  const letterSequence = getScaleLetterSequence(tonicNoteName.charAt(0));
  const semitoneOffsetsByScaleType: Record<ScaleType, number[]> = {
    major: [0, 2, 4, 5, 7, 9, 11],
    "natural-minor": [0, 2, 3, 5, 7, 8, 10],
    "harmonic-minor": [0, 2, 3, 5, 7, 8, 11],
    "melodic-minor": [0, 2, 3, 5, 7, 9, 11],
  };

  return semitoneOffsetsByScaleType[scaleType].map((semitoneOffset, index) => {
    const targetPitchClass = (tonicMidiNoteNumber + semitoneOffset) % 12;
    const letterName = letterSequence[index];

    if (!letterName) {
      throw new Error("Could not determine scale letter.");
    }

    return getSpelledNoteName(letterName, targetPitchClass);
  });
}

export function getGeneratedNotePool(
  generatedNotePool: string[],
  rangeStart: string,
  rangeEnd: string,
  accidentalSpellingMode: AccidentalSpellingMode,
) {
  const startIndex = generatedNotePool.indexOf(rangeStart);
  const endIndex = generatedNotePool.indexOf(rangeEnd);

  if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
    throw new Error("Invalid generated note range.");
  }

  return generatedNotePool
    .slice(startIndex, endIndex + 1)
    .map((key) =>
      midiNoteNumberToKey(keyToMidiNoteNumber(key), accidentalSpellingMode),
    );
}

export function getOctaveForKey(key: string) {
  const [, octaveText] = key.split("/");

  if (!octaveText) {
    throw new Error(`Invalid key format: ${key}`);
  }

  const octave = Number.parseInt(octaveText, 10);

  if (Number.isNaN(octave)) {
    throw new Error(`Invalid octave in key: ${key}`);
  }

  return octave;
}

export function formatKeyLabel(key: string) {
  const [noteName, octaveText] = key.split("/");

  if (!noteName || !octaveText) {
    return key;
  }

  const firstCharacter = noteName.charAt(0).toUpperCase();
  const accidental = noteName.slice(1);

  return `${firstCharacter}${accidental}${octaveText}`;
}

export function midiNoteNumberToKey(
  noteNumber: number,
  accidentalSpellingMode: AccidentalSpellingMode,
) {
  const sharpNoteNames = [
    "c",
    "c#",
    "d",
    "d#",
    "e",
    "f",
    "f#",
    "g",
    "g#",
    "a",
    "a#",
    "b",
  ];
  const flatNoteNames = [
    "c",
    "db",
    "d",
    "eb",
    "e",
    "f",
    "gb",
    "g",
    "ab",
    "a",
    "bb",
    "b",
  ];
  const noteNames =
    accidentalSpellingMode === "flats" ? flatNoteNames : sharpNoteNames;
  const noteName = noteNames[noteNumber % 12];
  const octave = Math.floor(noteNumber / 12) - 1;

  if (!noteName) {
    throw new Error(`Invalid MIDI note number: ${noteNumber}`);
  }

  return `${noteName}/${octave}`;
}

export function getHeldOverlayKey(
  prompt: PromptSlot,
  heldNoteNumber: number,
  displayedKeySignature: KeySignature | null,
) {
  const promptKeys = [...(prompt.trebleKeys ?? []), ...(prompt.bassKeys ?? [])];
  const matchingPromptKey = promptKeys.find(
    (key) => keyToMidiNoteNumber(key) === heldNoteNumber,
  );

  if (matchingPromptKey) {
    return matchingPromptKey;
  }

  return midiNoteNumberToKey(
    heldNoteNumber,
    getAccidentalSpellingModeForKeySignature(displayedKeySignature),
  );
}

function getNaturalSemitoneForNoteName(noteName: string) {
  const baseNote = noteName.charAt(0).toLowerCase();
  const semitonesByName: Record<string, number> = {
    c: 0,
    d: 2,
    e: 4,
    f: 5,
    g: 7,
    a: 9,
    b: 11,
  };

  const semitone = semitonesByName[baseNote];

  if (semitone === undefined) {
    throw new Error(`Unsupported note name: ${noteName}`);
  }

  return semitone;
}

function getKeySignatureAccidentals(keySignature: KeySignature) {
  const accidentals: Record<string, string> = {};
  const sharpKeySignatureCount: Partial<Record<KeySignature, number>> = {
    G: 1,
    D: 2,
    A: 3,
    E: 4,
    B: 5,
    "F#": 6,
    "C#": 7,
  };
  const flatKeySignatureCount: Partial<Record<KeySignature, number>> = {
    F: 1,
    Bb: 2,
    Eb: 3,
    Ab: 4,
    Db: 5,
    Gb: 6,
    Cb: 7,
  };
  const sharpCount = sharpKeySignatureCount[keySignature] ?? 0;
  const flatCount = flatKeySignatureCount[keySignature] ?? 0;

  for (const noteName of SHARP_KEY_SIGNATURE_ORDER.slice(0, sharpCount)) {
    accidentals[noteName] = "#";
  }

  for (const noteName of FLAT_KEY_SIGNATURE_ORDER.slice(0, flatCount)) {
    accidentals[noteName] = "b";
  }

  return accidentals;
}

function isTrebleScaleStartWithinUpperLimit(noteName: string) {
  const baseLetter = noteName.charAt(0).toLowerCase();
  const accidentalOffset = getAccidentalOffsetForNoteName(noteName);
  const allowedBaseLetters = ["c", "d", "e"];

  if (allowedBaseLetters.includes(baseLetter)) {
    return true;
  }

  if (baseLetter === "f") {
    return accidentalOffset <= 1;
  }

  if (["g", "a", "b"].includes(baseLetter)) {
    return false;
  }

  throw new Error(`Unsupported tonic note name: ${noteName}`);
}

function getScaleLetterSequence(startLetter: string) {
  const noteLetters = ["c", "d", "e", "f", "g", "a", "b"];
  const startIndex = noteLetters.indexOf(startLetter.toLowerCase());

  if (startIndex === -1) {
    throw new Error(`Unsupported tonic letter: ${startLetter}`);
  }

  return Array.from({ length: 7 }, (_, index) => {
    return noteLetters[(startIndex + index) % noteLetters.length];
  });
}

function getSpelledNoteName(letterName: string, targetPitchClass: number) {
  const naturalPitchClass = getNaturalSemitoneForNoteName(letterName);

  for (const accidentalOffset of [-2, -1, 0, 1, 2]) {
    if ((naturalPitchClass + accidentalOffset + 12) % 12 !== targetPitchClass) {
      continue;
    }

    return `${letterName}${getAccidentalText(accidentalOffset)}`;
  }

  throw new Error(
    `Could not spell note for ${letterName} at ${targetPitchClass}.`,
  );
}

function getAccidentalText(accidentalOffset: number) {
  if (accidentalOffset > 0) {
    return "#".repeat(accidentalOffset);
  }

  if (accidentalOffset < 0) {
    return "b".repeat(Math.abs(accidentalOffset));
  }

  return "";
}
