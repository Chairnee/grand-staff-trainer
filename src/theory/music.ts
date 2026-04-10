import type { PromptSlot } from "../exercises/types";

const SHARP_KEY_SIGNATURE_ORDER = ["f", "c", "g", "d", "a", "e", "b"];
const FLAT_KEY_SIGNATURE_ORDER = ["b", "e", "a", "d", "g", "c", "f"];

export type PracticeMode = "scales" | "triads" | "arpeggios" | "cadences";
export type ScaleHands = "treble" | "bass" | "together";
export type ScaleOctaves = 1 | 2;
export type ScaleMotion = "parallel" | "contrary";
export type ScaleDirection = "ascending" | "descending";
export type AccidentalSpellingMode = "sharps" | "flats";
export type RenderingPreference = "preferred" | "alternate";
export type TriadType = "major" | "minor" | "diminished" | "augmented";
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
  scaleMotion: ScaleMotion;
  scaleDirection: ScaleDirection;
  tonic: Tonic;
  scaleType: ScaleType;
  triadType: TriadType;
  renderingPreference: RenderingPreference;
};

type ScaleRenderingOverride = {
  selectedTonic: Tonic;
  renderedTonic: Tonic;
  scaleType: ScaleType;
};

type TriadRenderingOverride = {
  selectedTonic: Tonic;
  renderedTonic: Tonic;
  triadType: TriadType;
};

export type TonicReadabilityOption = {
  tonic: Tonic;
  keySignature: KeySignature | null;
  keySignatureAccidentalCount: number;
  doubleAccidentalCount: number;
  cost: number;
};

type InternalTonicReadabilityOption = TonicReadabilityOption & {
  visibleAccidentalCount: number;
};

export type ExerciseRenderingOptions = {
  selectedTonic: Tonic;
  active: TonicReadabilityOption;
  alternate: TonicReadabilityOption | null;
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
const PRACTICAL_TONIC_BY_TONIC: Partial<Record<Tonic, Tonic>> = {
  Cb: "B",
  "G#": "Ab",
  "D#": "Eb",
  "A#": "Bb",
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
  if (
    generationSettings.practiceMode === "triads" ||
    generationSettings.practiceMode === "arpeggios" ||
    generationSettings.practiceMode === "cadences"
  ) {
    return getTriadRenderingOptions(generationSettings).active.keySignature;
  }

  return getScaleRenderingOptions(generationSettings).active.keySignature;
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

export function getPracticalTonic(tonic: Tonic): Tonic {
  return PRACTICAL_TONIC_BY_TONIC[tonic] ?? tonic;
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
  renderingPreference: RenderingPreference = "preferred",
): Tonic {
  const renderingOptions = getExerciseRenderingOptionsForScaleType(
    tonic,
    scaleType,
    renderingPreference,
  );

  return renderingOptions.active.tonic;
}

export function getSupportedTonicForTriadType(
  tonic: Tonic,
  triadType: TriadType,
  renderingPreference: RenderingPreference = "preferred",
): Tonic {
  const renderingOptions = getExerciseRenderingOptionsForTriadType(
    tonic,
    triadType,
    renderingPreference,
  );

  return renderingOptions.active.tonic;
}

export function getExerciseRenderingOptionsForScaleType(
  tonic: Tonic,
  scaleType: ScaleType,
  renderingPreference: RenderingPreference = "preferred",
): ExerciseRenderingOptions {
  const options = getTonicReadabilityOptionsForScaleType(tonic, scaleType);
  const preferredOption = options[0];
  const alternateOption = options[1] ?? null;

  if (!preferredOption) {
    throw new Error(
      `Could not determine rendering options for tonic ${tonic}.`,
    );
  }

  return {
    selectedTonic: tonic,
    active:
      renderingPreference === "alternate" && alternateOption
        ? alternateOption
        : preferredOption,
    alternate:
      renderingPreference === "alternate" ? preferredOption : alternateOption,
  };
}

export function getExerciseRenderingOptionsForTriadType(
  tonic: Tonic,
  triadType: TriadType,
  renderingPreference: RenderingPreference = "preferred",
): ExerciseRenderingOptions {
  const options = getTonicReadabilityOptionsForTriadType(tonic, triadType);
  const preferredOption = options[0];
  const alternateOption = options[1] ?? null;

  if (!preferredOption) {
    throw new Error(
      `Could not determine rendering options for tonic ${tonic}.`,
    );
  }

  return {
    selectedTonic: tonic,
    active:
      renderingPreference === "alternate" && alternateOption
        ? alternateOption
        : preferredOption,
    alternate:
      renderingPreference === "alternate" ? preferredOption : alternateOption,
  };
}

export function getScaleRenderingOverride(
  generationSettings: GenerationSettings,
): ScaleRenderingOverride | null {
  const renderedTonic =
    getScaleRenderingOptions(generationSettings).active.tonic;

  if (renderedTonic === generationSettings.tonic) {
    return null;
  }

  return {
    selectedTonic: generationSettings.tonic,
    renderedTonic,
    scaleType: generationSettings.scaleType,
  };
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

export function getScaleRenderingNotice(
  generationSettings: GenerationSettings,
) {
  const renderingOverride = getScaleRenderingOverride(generationSettings);

  if (!renderingOverride) {
    return null;
  }

  return `${renderingOverride.selectedTonic} ${formatScaleTypeLabel(renderingOverride.scaleType)} is being rendered as ${renderingOverride.renderedTonic} ${formatScaleTypeLabel(renderingOverride.scaleType)} for readability.`;
}

export function getScaleRenderingOptions(
  generationSettings: GenerationSettings,
) {
  return getExerciseRenderingOptionsForScaleType(
    generationSettings.tonic,
    generationSettings.scaleType,
    generationSettings.renderingPreference,
  );
}

export function getTriadRenderingOverride(
  generationSettings: GenerationSettings,
): TriadRenderingOverride | null {
  const renderedTonic =
    getTriadRenderingOptions(generationSettings).active.tonic;

  if (renderedTonic === generationSettings.tonic) {
    return null;
  }

  return {
    selectedTonic: generationSettings.tonic,
    renderedTonic,
    triadType: generationSettings.triadType,
  };
}

export function getTriadRenderingNotice(
  generationSettings: GenerationSettings,
) {
  const renderingOverride = getTriadRenderingOverride(generationSettings);

  if (!renderingOverride) {
    return null;
  }

  return `${renderingOverride.selectedTonic} ${renderingOverride.triadType} triads are being rendered as ${renderingOverride.renderedTonic} ${renderingOverride.triadType} triads for readability.`;
}

export function getCadenceRenderingNotice(
  generationSettings: GenerationSettings,
) {
  const renderingOverride = getCadenceRenderingOverride(generationSettings);

  if (!renderingOverride) {
    return null;
  }

  return `${renderingOverride.selectedTonic} ${renderingOverride.triadType} cadences are being rendered as ${renderingOverride.renderedTonic} ${renderingOverride.triadType} cadences for readability.`;
}

export function getArpeggioRenderingNotice(
  generationSettings: GenerationSettings,
) {
  const renderingOverride = getTriadRenderingOverride(generationSettings);

  if (!renderingOverride) {
    return null;
  }

  return `${renderingOverride.selectedTonic} ${renderingOverride.triadType} arpeggios are being rendered as ${renderingOverride.renderedTonic} ${renderingOverride.triadType} arpeggios for readability.`;
}

export function getTriadRenderingOptions(
  generationSettings: GenerationSettings,
) {
  return getExerciseRenderingOptionsForTriadType(
    generationSettings.tonic,
    generationSettings.triadType,
    generationSettings.renderingPreference,
  );
}

export function getCadenceRenderingOptions(
  generationSettings: GenerationSettings,
) {
  return getExerciseRenderingOptionsForScaleType(
    generationSettings.tonic,
    generationSettings.triadType === "major" ? "major" : "natural-minor",
    generationSettings.renderingPreference,
  );
}

export function getArpeggioRenderingOptions(
  generationSettings: GenerationSettings,
) {
  return getTriadRenderingOptions(generationSettings);
}

function getCadenceRenderingOverride(
  generationSettings: GenerationSettings,
): TriadRenderingOverride | null {
  const renderedTonic =
    getCadenceRenderingOptions(generationSettings).active.tonic;

  if (renderedTonic === generationSettings.tonic) {
    return null;
  }

  return {
    selectedTonic: generationSettings.tonic,
    renderedTonic,
    triadType: generationSettings.triadType,
  };
}

export function getScaleStartingOctave(
  tonic: Tonic,
  scaleType?: ScaleType,
  renderingPreference: RenderingPreference = "preferred",
) {
  const renderedTonic = scaleType
    ? getSupportedTonicForScaleType(tonic, scaleType, renderingPreference)
    : tonic;

  return isTrebleScaleStartWithinUpperLimit(renderedTonic.toLowerCase())
    ? 4
    : 3;
}

export function getDescendingScaleStartingOctave(
  tonic: Tonic,
  scaleType: ScaleType,
  scaleOctaves: ScaleOctaves,
  scaleHands: Exclude<ScaleHands, "together">,
  renderingPreference: RenderingPreference = "preferred",
) {
  const renderedTonic = getSupportedTonicForScaleType(
    tonic,
    scaleType,
    renderingPreference,
  ).toLowerCase();

  if (scaleHands === "treble") {
    const highestComfortableTopMidiNote = keyToMidiNoteNumber("f#/6");
    const candidateTopMidiNote = keyToMidiNoteNumber(`${renderedTonic}/6`);
    const topTonicOctave =
      candidateTopMidiNote <= highestComfortableTopMidiNote ? 6 : 5;

    return topTonicOctave - scaleOctaves;
  }

  const minimumTopMidiNote = keyToMidiNoteNumber("f#/3");
  const maximumTopMidiNote = keyToMidiNoteNumber("f#/4");
  const candidateOctaves = [0, 1, 2, 3, 4, 5];
  const rankedCandidates = candidateOctaves.map((startingOctave) => {
    const topTonicMidiNote = keyToMidiNoteNumber(
      `${renderedTonic}/${startingOctave + scaleOctaves}`,
    );
    const lowOverflow = Math.max(0, minimumTopMidiNote - topTonicMidiNote);
    const highOverflow = Math.max(0, topTonicMidiNote - maximumTopMidiNote);
    const overflow = lowOverflow + highOverflow;

    return {
      startingOctave,
      overflow,
    };
  });
  const validCandidates = rankedCandidates.filter(
    (candidate) => candidate.overflow === 0,
  );

  if (validCandidates.length > 0) {
    return Math.max(
      ...validCandidates.map((candidate) => candidate.startingOctave),
    );
  }

  rankedCandidates.sort((left, right) => {
    if (left.overflow !== right.overflow) {
      return left.overflow - right.overflow;
    }

    return right.startingOctave - left.startingOctave;
  });

  const fallbackStartingOctave =
    rankedCandidates[0]?.startingOctave ??
    getScaleStartingOctave(tonic, scaleType, renderingPreference);

  return fallbackStartingOctave;
}

export function getTriadStartingOctave(
  tonic: Tonic,
  triadType: TriadType,
  renderingPreference: RenderingPreference = "preferred",
) {
  const renderedTonic = getSupportedTonicForTriadType(
    tonic,
    triadType,
    renderingPreference,
  );

  return isTrebleScaleStartWithinUpperLimit(renderedTonic.toLowerCase())
    ? 4
    : 3;
}

export function getCadenceStartingOctave(
  tonic: Tonic,
  triadType: TriadType,
  renderingPreference: RenderingPreference = "preferred",
) {
  const renderedTonic = getSupportedTonicForScaleType(
    tonic,
    triadType === "major" ? "major" : "natural-minor",
    renderingPreference,
  );

  return isTrebleCadenceStartWithinUpperLimit(renderedTonic.toLowerCase())
    ? 4
    : 3;
}

export function getAscendingScaleKeys(
  tonic: Tonic,
  scaleType: ScaleType,
  startingOctave: number,
  scaleOctaves: ScaleOctaves,
  renderingPreference: RenderingPreference = "preferred",
) {
  const renderedTonic = getSupportedTonicForScaleType(
    tonic,
    scaleType,
    renderingPreference,
  );
  return getAscendingScaleKeysForRenderedTonicName(
    renderedTonic,
    scaleType,
    startingOctave,
    scaleOctaves,
  );
}

export function getAscendingScaleKeysForRenderedTonicName(
  renderedTonic: string,
  scaleType: ScaleType,
  startingOctave: number,
  scaleOctaves: ScaleOctaves,
) {
  const scaleNoteNames = getScaleNoteNamesForRenderedTonicName(
    renderedTonic,
    scaleType,
  );
  const ascendingNoteNames = Array.from({ length: scaleOctaves }).flatMap(
    () => {
      return scaleNoteNames;
    },
  );
  ascendingNoteNames.push(renderedTonic.toLowerCase());
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

export function getScaleNoteNames(
  tonic: Tonic,
  scaleType: ScaleType,
  renderingPreference: RenderingPreference = "preferred",
) {
  const tonicNoteName = getSupportedTonicForScaleType(
    tonic,
    scaleType,
    renderingPreference,
  ).toLowerCase();
  return getScaleNoteNamesForRenderedTonic(tonicNoteName, scaleType);
}

export function getTonicReadabilityOptionsForScaleType(
  tonic: Tonic,
  scaleType: ScaleType,
): TonicReadabilityOption[] {
  const candidateTonics = getCandidateTonicsForPitchClass(tonic);

  return finalizeTonicReadabilityOptions(
    candidateTonics.map((candidateTonic) => {
      const keySignature = getKeySignatureForScaleType(
        candidateTonic,
        scaleType,
      );
      const scaleNoteNames = getScaleNoteNamesForRenderedTonic(
        candidateTonic.toLowerCase(),
        scaleType,
      );
      const keySignatureAccidentalCount =
        getKeySignatureAccidentalCount(keySignature);
      const visibleAccidentalCount = getVisibleAccidentalCount(
        keySignature,
        scaleNoteNames,
      );
      const doubleAccidentalCount = countDoubleAccidentals(scaleNoteNames);

      return {
        tonic: candidateTonic,
        keySignature,
        keySignatureAccidentalCount,
        visibleAccidentalCount,
        doubleAccidentalCount,
        cost: 0,
      };
    }),
    tonic,
  );
}

export function getTonicReadabilityOptionsForTriadType(
  tonic: Tonic,
  triadType: TriadType,
): TonicReadabilityOption[] {
  const candidateTonics = getCandidateTonicsForPitchClass(tonic);

  return finalizeTonicReadabilityOptions(
    candidateTonics.map((candidateTonic) => {
      const keySignature = getKeySignatureForTriadType(
        candidateTonic,
        triadType,
      );
      const triadNoteNames = getTriadNoteNamesForRenderedTonic(
        candidateTonic.toLowerCase(),
        triadType,
      );
      const keySignatureAccidentalCount =
        getKeySignatureAccidentalCount(keySignature);
      const visibleAccidentalCount = getVisibleAccidentalCount(
        keySignature,
        triadNoteNames,
      );
      const doubleAccidentalCount = countDoubleAccidentals(triadNoteNames);

      return {
        tonic: candidateTonic,
        keySignature,
        keySignatureAccidentalCount,
        visibleAccidentalCount,
        doubleAccidentalCount,
        cost: 0,
      };
    }),
    tonic,
  );
}

function finalizeTonicReadabilityOptions(
  options: InternalTonicReadabilityOption[],
  selectedTonic: Tonic,
): TonicReadabilityOption[] {
  const hasUnkeyedCandidate = options.some((option) => !option.keySignature);

  return options
    .map((option) => ({
      tonic: option.tonic,
      keySignature: option.keySignature,
      keySignatureAccidentalCount: option.keySignatureAccidentalCount,
      doubleAccidentalCount: option.doubleAccidentalCount,
      cost:
        (hasUnkeyedCandidate
          ? option.visibleAccidentalCount
          : option.keySignatureAccidentalCount) +
        option.doubleAccidentalCount * 10,
    }))
    .sort((left, right) => {
      if (left.cost !== right.cost) {
        return left.cost - right.cost;
      }

      if (left.tonic === selectedTonic) {
        return -1;
      }

      if (right.tonic === selectedTonic) {
        return 1;
      }

      return left.tonic.localeCompare(right.tonic);
    });
}

function getCandidateTonicsForPitchClass(tonic: Tonic) {
  const targetPitchClass = getPitchClassForTonic(tonic);
  const supportedTonics = Array.from(
    new Set<Tonic>([...MAJOR_TONICS, ...MINOR_TONICS, tonic]),
  );
  const candidateTonics = supportedTonics.filter(
    (candidateTonic) =>
      getPitchClassForTonic(candidateTonic) === targetPitchClass,
  );

  return candidateTonics.length > 0 ? candidateTonics : [tonic];
}

function getPitchClassForTonic(tonic: Tonic) {
  return keyToMidiNoteNumber(`${tonic.toLowerCase()}/4`) % 12;
}

function getKeySignatureForScaleType(
  tonic: Tonic,
  scaleType: ScaleType,
): KeySignature | null {
  if (scaleType === "major") {
    return MAJOR_KEY_SIGNATURE_BY_TONIC[tonic as MajorTonic] ?? null;
  }

  return MINOR_KEY_SIGNATURE_BY_TONIC[tonic as MinorTonic] ?? null;
}

function getKeySignatureForTriadType(
  tonic: Tonic,
  triadType: TriadType,
): KeySignature | null {
  if (triadType === "major") {
    return getKeySignatureForScaleType(tonic, "major");
  }

  if (triadType === "minor") {
    return getKeySignatureForScaleType(tonic, "natural-minor");
  }

  return null;
}

function getScaleNoteNamesForRenderedTonic(
  tonicNoteName: string,
  scaleType: ScaleType,
) {
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

export function getScaleNoteNamesForRenderedTonicName(
  tonicNoteName: string,
  scaleType: ScaleType,
) {
  return getScaleNoteNamesForRenderedTonic(
    tonicNoteName.toLowerCase(),
    scaleType,
  );
}

function getTriadNoteNamesForRenderedTonic(
  tonicNoteName: string,
  triadType: TriadType,
) {
  const tonicMidiNoteNumber = keyToMidiNoteNumber(`${tonicNoteName}/4`);
  const letterSequence = getScaleLetterSequence(tonicNoteName.charAt(0));
  const triadLetterSequence = [
    letterSequence[0],
    letterSequence[2],
    letterSequence[4],
  ];
  const semitoneOffsetsByTriadType: Record<TriadType, number[]> = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    diminished: [0, 3, 6],
    augmented: [0, 4, 8],
  };

  return semitoneOffsetsByTriadType[triadType].map((semitoneOffset, index) => {
    const targetPitchClass = (tonicMidiNoteNumber + semitoneOffset) % 12;
    const letterName = triadLetterSequence[index];

    if (!letterName) {
      throw new Error("Could not determine triad letter.");
    }

    return getSpelledNoteName(letterName, targetPitchClass);
  });
}

export function getTriadNoteNames(
  tonic: Tonic,
  triadType: TriadType,
  renderingPreference: RenderingPreference = "preferred",
) {
  const renderedTonic = getSupportedTonicForTriadType(
    tonic,
    triadType,
    renderingPreference,
  ).toLowerCase();
  return getTriadNoteNamesForRenderedTonic(renderedTonic, triadType);
}

export function getAscendingTriadPositions(
  tonic: Tonic,
  triadType: TriadType,
  startingOctave: number,
  exerciseOctaves: ScaleOctaves,
  renderingPreference: RenderingPreference = "preferred",
) {
  const triadNoteNames = getTriadNoteNames(
    tonic,
    triadType,
    renderingPreference,
  );
  const [rootNoteName, thirdNoteName, fifthNoteName] = triadNoteNames;

  if (!rootNoteName || !thirdNoteName || !fifthNoteName) {
    throw new Error("Could not determine triad note names.");
  }

  const totalRootPositions = exerciseOctaves + 1;
  const ascendingPositions: string[][] = [];

  for (
    let rootPositionIndex = 0;
    rootPositionIndex < totalRootPositions;
    rootPositionIndex += 1
  ) {
    const rootKey = `${rootNoteName}/${startingOctave + rootPositionIndex}`;
    const rootMidiNoteNumber = keyToMidiNoteNumber(rootKey);
    const rootPosition = triadNoteNames.map((noteName) =>
      findNextTriadKeyAtOrAbove(noteName, rootMidiNoteNumber),
    );

    if (rootPositionIndex < exerciseOctaves) {
      const firstInversionBassMidiNoteNumber = keyToMidiNoteNumber(
        rootPosition[1] ?? "",
      );
      const firstInversion = [
        rootPosition[1],
        rootPosition[2],
        findNextTriadKeyAtOrAbove(
          rootNoteName,
          firstInversionBassMidiNoteNumber,
        ),
      ];
      const secondInversionBassMidiNoteNumber = keyToMidiNoteNumber(
        firstInversion[1] ?? "",
      );
      const secondInversion = [
        firstInversion[1],
        firstInversion[2],
        findNextTriadKeyAtOrAbove(
          thirdNoteName,
          secondInversionBassMidiNoteNumber,
        ),
      ];

      ascendingPositions.push(rootPosition, firstInversion, secondInversion);
      continue;
    }

    ascendingPositions.push(rootPosition);
  }

  return ascendingPositions;
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
  const promptKeyGroups: Array<[string[] | undefined, string[] | undefined]> = [
    [prompt.trebleKeys, prompt.displayedTrebleKeys],
    [prompt.bassKeys, prompt.displayedBassKeys],
  ];

  for (const [actualKeys, displayedKeys] of promptKeyGroups) {
    if (!actualKeys) {
      continue;
    }

    const matchingKeyIndex = actualKeys.findIndex(
      (key) => keyToMidiNoteNumber(key) === heldNoteNumber,
    );

    if (matchingKeyIndex === -1) {
      continue;
    }

    const displayedKey = displayedKeys?.[matchingKeyIndex];

    const fallbackKey = actualKeys[matchingKeyIndex];

    if (!fallbackKey) {
      break;
    }

    return displayedKey ?? fallbackKey;
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

function getKeySignatureAccidentalCount(keySignature: KeySignature | null) {
  if (!keySignature) {
    return 0;
  }

  return Object.keys(getKeySignatureAccidentals(keySignature)).length;
}

function getVisibleAccidentalCount(
  keySignature: KeySignature | null,
  noteNames: string[],
) {
  if (keySignature) {
    return noteNames.filter((noteName) =>
      Boolean(getRenderedAccidentalForKey(`${noteName}/4`, keySignature)),
    ).length;
  }

  return countExplicitAccidentals(noteNames);
}

function countExplicitAccidentals(noteNames: string[]) {
  return noteNames.filter((noteName) => noteName.slice(1).length >= 1).length;
}

function countDoubleAccidentals(noteNames: string[]) {
  return noteNames.filter((noteName) => noteName.slice(1).length >= 2).length;
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

function isTrebleCadenceStartWithinUpperLimit(noteName: string) {
  const baseLetter = noteName.charAt(0).toLowerCase();
  const accidentalOffset = getAccidentalOffsetForNoteName(noteName);
  const allowedBaseLetters = ["c", "d", "e"];

  if (allowedBaseLetters.includes(baseLetter)) {
    return true;
  }

  if (baseLetter === "f" || baseLetter === "g") {
    return accidentalOffset <= 1;
  }

  if (["a", "b"].includes(baseLetter)) {
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

function findNextTriadKeyAtOrAbove(
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

function formatScaleTypeLabel(scaleType: ScaleType) {
  if (scaleType === "major") {
    return "major";
  }

  return scaleType.replaceAll("-", " ");
}
