export type InputAnalysis = {
  primaryLabel: string;
  secondaryLabel?: string;
};

type HeldInputNote = {
  key: string;
  label: string;
  pitchClass: number;
};

type TriadQuality =
  | "major"
  | "minor"
  | "diminished"
  | "augmented"
  | "sus2"
  | "sus4";
type TriadInversion = "root position" | "first inversion" | "second inversion";

type TriadAnalysis = {
  rootKey: string;
  quality: TriadQuality;
  inversion: TriadInversion;
};

type PowerChordAnalysis = {
  rootKey: string;
};

export function analyzeHeldInput(heldNotes: number[]): InputAnalysis {
  if (heldNotes.length === 0) {
    return {
      primaryLabel: "No input",
      secondaryLabel: "Hold notes to analyse input.",
    };
  }

  const distinctHeldNotes = [...new Set(heldNotes)].sort(
    (left, right) => left - right,
  );
  const inputNotes = distinctHeldNotes.map((noteNumber) => {
    const key = getCommonPracticalAnalysisKey(noteNumber);

    return {
      key,
      label: getCommonPracticalDisplayLabel(noteNumber),
      pitchClass: ((noteNumber % 12) + 12) % 12,
    };
  });

  if (inputNotes.length === 1) {
    const heldKey = inputNotes[0]?.label;

    if (!heldKey) {
      throw new Error("Could not determine held note.");
    }

    return {
      primaryLabel: heldKey,
      secondaryLabel: "Single note",
    };
  }

  if (inputNotes.length === 2) {
    const [lowerNote, higherNote] = inputNotes;
    const intervalLabel = getIntervalLabel(lowerNote.key, higherNote.key);

    return {
      primaryLabel: formatIntervalName(lowerNote.pitchClass, intervalLabel),
      secondaryLabel: formatHeldInputLabels(inputNotes),
    };
  }

  if (inputNotes.length === 3) {
    const triadAnalysis = analyzeTriad(inputNotes);

    if (triadAnalysis) {
      return {
        primaryLabel: formatTriadLabel(triadAnalysis),
        secondaryLabel: formatHeldInputLabels(inputNotes),
      };
    }
  }

  const powerChordAnalysis = analyzePowerChord(inputNotes);

  if (powerChordAnalysis) {
    return {
      primaryLabel: formatPowerChordLabel(powerChordAnalysis),
      secondaryLabel: formatHeldInputLabels(inputNotes),
    };
  }

  if (inputNotes.length === 3) {
    return {
      primaryLabel: "Unknown triad",
      secondaryLabel: formatHeldInputLabels(inputNotes),
    };
  }

  return {
    primaryLabel: "Multiple notes",
    secondaryLabel: "Chord naming coming soon.",
  };
}

function getIntervalLabel(lowerKey: string, higherKey: string) {
  return getPracticalIntervalLabel(
    getMidiNoteNumberForKey(higherKey) - getMidiNoteNumberForKey(lowerKey),
  );
}

function getPracticalIntervalLabel(semitoneDistance: number) {
  if (semitoneDistance <= 0) {
    throw new Error(`Invalid interval distance: ${semitoneDistance}`);
  }

  if (semitoneDistance === 12) {
    return "Octave";
  }

  const octaveCount = Math.floor(semitoneDistance / 12);
  const intervalClass = semitoneDistance % 12;
  const simpleIntervalLabels: Record<number, string> = {
    0: "Unison",
    1: "Minor second",
    2: "Major second",
    3: "Minor third",
    4: "Major third",
    5: "Perfect fourth",
    6: "Tritone",
    7: "Perfect fifth",
    8: "Minor sixth",
    9: "Major sixth",
    10: "Minor seventh",
    11: "Major seventh",
  };
  const compoundIntervalLabels: Record<number, string> = {
    0: "Octave",
    1: "Minor ninth",
    2: "Major ninth",
    3: "Minor tenth",
    4: "Major tenth",
    5: "Perfect eleventh",
    6: "Tritone",
    7: "Perfect twelfth",
    8: "Minor thirteenth",
    9: "Major thirteenth",
    10: "Minor fourteenth",
    11: "Major fourteenth",
  };

  if (octaveCount === 0) {
    const intervalLabel = simpleIntervalLabels[intervalClass];

    if (intervalLabel) {
      return intervalLabel;
    }
  }

  if (octaveCount === 1) {
    const intervalLabel = compoundIntervalLabels[intervalClass];

    if (intervalLabel) {
      return intervalLabel;
    }
  }

  const intervalLabel = simpleIntervalLabels[intervalClass];

  if (!intervalLabel) {
    throw new Error(`Unsupported interval class: ${intervalClass}`);
  }

  if (intervalClass === 0) {
    return `${octaveCount} octaves`;
  }

  return `${intervalLabel} + ${octaveCount} octave${octaveCount === 1 ? "" : "s"}`;
}

function analyzeTriad(inputNotes: HeldInputNote[]): TriadAnalysis | null {
  if (new Set(inputNotes.map((note) => note.pitchClass)).size !== 3) {
    return null;
  }

  for (const rootNote of inputNotes) {
    const intervals = inputNotes
      .filter((note) => note !== rootNote)
      .map((note) =>
        getPitchClassDistance(rootNote.pitchClass, note.pitchClass),
      )
      .sort((left, right) => left - right);
    const triadQuality = getTriadQualityByIntervals(intervals);

    if (!triadQuality) {
      continue;
    }

    return {
      rootKey: getPreferredPracticalTriadRootKey(rootNote.pitchClass),
      quality: triadQuality,
      inversion: getTriadInversion(
        inputNotes,
        rootNote.pitchClass,
        triadQuality,
      ),
    };
  }

  return null;
}

function getTriadQualityByIntervals(intervals: number[]) {
  const [firstInterval, secondInterval] = intervals;

  if (firstInterval === 2 && secondInterval === 7) {
    return "sus2";
  }

  if (firstInterval === 4 && secondInterval === 7) {
    return "major";
  }

  if (firstInterval === 3 && secondInterval === 7) {
    return "minor";
  }

  if (firstInterval === 5 && secondInterval === 7) {
    return "sus4";
  }

  if (firstInterval === 3 && secondInterval === 6) {
    return "diminished";
  }

  if (firstInterval === 4 && secondInterval === 8) {
    return "augmented";
  }

  return null;
}

function getTriadInversion(
  inputNotes: HeldInputNote[],
  rootPitchClass: number,
  triadQuality: TriadQuality,
): TriadInversion {
  const bassNote = inputNotes[0];

  if (!bassNote) {
    throw new Error("Could not determine bass note.");
  }

  const thirdPitchClass =
    (rootPitchClass + getTriadThirdOffset(triadQuality)) % 12;
  const fifthPitchClass =
    (rootPitchClass + getTriadFifthOffset(triadQuality)) % 12;

  if (bassNote.pitchClass === rootPitchClass) {
    return "root position";
  }

  if (bassNote.pitchClass === thirdPitchClass) {
    return "first inversion";
  }

  if (bassNote.pitchClass === fifthPitchClass) {
    return "second inversion";
  }

  throw new Error("Could not determine triad inversion.");
}

function getTriadThirdOffset(triadQuality: TriadQuality) {
  if (triadQuality === "sus2") {
    return 2;
  }

  if (triadQuality === "sus4") {
    return 5;
  }

  return triadQuality === "major" || triadQuality === "augmented" ? 4 : 3;
}

function getTriadFifthOffset(triadQuality: TriadQuality) {
  if (triadQuality === "diminished") {
    return 6;
  }

  if (triadQuality === "augmented") {
    return 8;
  }

  return 7;
}

function formatTriadLabel(triadAnalysis: TriadAnalysis) {
  const rootLabel = formatPitchLabel(triadAnalysis.rootKey);
  const inversionSuffix =
    triadAnalysis.inversion === "root position"
      ? ""
      : `, ${triadAnalysis.inversion}`;

  if (triadAnalysis.quality === "sus2" || triadAnalysis.quality === "sus4") {
    return `${rootLabel} ${triadAnalysis.quality}${inversionSuffix}`;
  }

  return `${rootLabel} ${triadAnalysis.quality} triad${inversionSuffix}`;
}

function analyzePowerChord(
  inputNotes: HeldInputNote[],
): PowerChordAnalysis | null {
  const distinctPitchClasses = [
    ...new Set(inputNotes.map((note) => note.pitchClass)),
  ];

  if (distinctPitchClasses.length !== 2) {
    return null;
  }

  const [firstPitchClass, secondPitchClass] = distinctPitchClasses;

  if (firstPitchClass === undefined || secondPitchClass === undefined) {
    return null;
  }

  if (getPitchClassDistance(firstPitchClass, secondPitchClass) === 7) {
    return {
      rootKey: getPreferredPracticalTriadRootKey(firstPitchClass),
    };
  }

  if (getPitchClassDistance(secondPitchClass, firstPitchClass) === 7) {
    return {
      rootKey: getPreferredPracticalTriadRootKey(secondPitchClass),
    };
  }

  return null;
}

function formatPowerChordLabel(powerChordAnalysis: PowerChordAnalysis) {
  const rootLabel = formatPitchLabel(powerChordAnalysis.rootKey);

  return `${rootLabel}5`;
}

function formatIntervalName(rootPitchClass: number, intervalLabel: string) {
  const rootLabel = formatPitchLabel(
    getPreferredPracticalTriadRootKey(rootPitchClass),
  );
  const titledIntervalLabel = intervalLabel
    .split(" ")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");

  return `${rootLabel} ${titledIntervalLabel}`;
}

function formatPitchLabel(key: string) {
  const [noteName] = key.split("/");

  if (!noteName) {
    return key;
  }

  return `${noteName.charAt(0).toUpperCase()}${noteName.slice(1)}`;
}

function formatHeldInputLabels(inputNotes: HeldInputNote[]) {
  return inputNotes.map((note) => note.label).join(" - ");
}

function getPreferredPracticalTriadRootKey(rootPitchClass: number) {
  return getCommonPracticalChordRootKey(60 + rootPitchClass);
}

function getCommonPracticalAnalysisKey(noteNumber: number) {
  const commonPracticalNoteNames = [
    "c",
    "c#",
    "d",
    "eb",
    "e",
    "f",
    "f#",
    "g",
    "ab",
    "a",
    "bb",
    "b",
  ];
  const noteName = commonPracticalNoteNames[((noteNumber % 12) + 12) % 12];
  const octave = Math.floor(noteNumber / 12) - 1;

  if (!noteName) {
    throw new Error(`Invalid MIDI note number: ${noteNumber}`);
  }

  return `${noteName}/${octave}`;
}

function getCommonPracticalDisplayLabel(noteNumber: number) {
  const commonPracticalNoteLabels = [
    "C",
    "Db/C#",
    "D",
    "Eb/D#",
    "E",
    "F",
    "Gb/F#",
    "G",
    "Ab/G#",
    "A",
    "Bb/A#",
    "B",
  ];
  const noteLabel = commonPracticalNoteLabels[((noteNumber % 12) + 12) % 12];
  const octave = Math.floor(noteNumber / 12) - 1;

  if (!noteLabel) {
    throw new Error(`Invalid MIDI note number: ${noteNumber}`);
  }

  return `${noteLabel}${octave}`;
}

function getCommonPracticalChordRootKey(noteNumber: number) {
  const commonPracticalChordRootNames = [
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
  const noteName = commonPracticalChordRootNames[((noteNumber % 12) + 12) % 12];
  const octave = Math.floor(noteNumber / 12) - 1;

  if (!noteName) {
    throw new Error(`Invalid MIDI note number: ${noteNumber}`);
  }

  return `${noteName}/${octave}`;
}

function getPitchClassDistance(
  lowerPitchClass: number,
  higherPitchClass: number,
) {
  return (higherPitchClass - lowerPitchClass + 12) % 12;
}

function getMidiNoteNumberForKey(key: string) {
  const [noteName, octaveText] = key.split("/");

  if (!noteName || !octaveText) {
    throw new Error(`Invalid key format: ${key}`);
  }

  const letterPitchClasses: Record<string, number> = {
    c: 0,
    d: 2,
    e: 4,
    f: 5,
    g: 7,
    a: 9,
    b: 11,
  };
  const pitchClass = letterPitchClasses[noteName.charAt(0)];
  const octave = Number.parseInt(octaveText, 10);

  if (pitchClass === undefined || Number.isNaN(octave)) {
    throw new Error(`Invalid key format: ${key}`);
  }

  let accidentalOffset = 0;

  for (const accidental of noteName.slice(1)) {
    if (accidental === "#") {
      accidentalOffset += 1;
      continue;
    }

    if (accidental === "b") {
      accidentalOffset -= 1;
      continue;
    }

    throw new Error(`Unsupported accidental in key: ${key}`);
  }

  return (octave + 1) * 12 + pitchClass + accidentalOffset;
}
