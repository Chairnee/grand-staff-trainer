export type InputAnalysis = {
  primaryLabel: string;
  secondaryLabel?: string;
  alternateLabel?: string;
};

type HeldInputNote = {
  key: string;
  label: string;
  noteNumber: number;
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
  rootPitchClass: number;
  bassPitchClass: number;
  quality: TriadQuality;
  inversion: TriadInversion;
};

type PowerChordAnalysis = {
  rootKey: string;
};

type FourNoteInversion =
  | "root position"
  | "first inversion"
  | "second inversion"
  | "third inversion";

type SixthChordQuality = "6" | "m6";

type SixthChordAnalysis = {
  rootKey: string;
  rootPitchClass: number;
  bassPitchClass: number;
  quality: SixthChordQuality;
  inversion: FourNoteInversion;
};

type AddChordQuality =
  | "add2"
  | "m(add2)"
  | "add4"
  | "m(add4)"
  | "add9"
  | "m(add9)";

type AddChordAnalysis = {
  rootKey: string;
  rootPitchClass: number;
  bassPitchClass: number;
  quality: AddChordQuality;
  inversion: FourNoteInversion;
};

type SeventhChordQuality =
  | "maj7"
  | "7"
  | "m7"
  | "m(maj7)"
  | "maj7#5"
  | "7#5"
  | "m7b5"
  | "dim7";

type SeventhChordAnalysis = {
  rootKey: string;
  rootPitchClass: number;
  bassPitchClass: number;
  quality: SeventhChordQuality;
  inversion: FourNoteInversion;
};

type FourNoteChordCandidate = {
  label: string;
  alternateLabel?: string;
  rootPitchClass: number;
  inversion: FourNoteInversion;
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
      noteNumber,
      pitchClass: ((noteNumber % 12) + 12) % 12,
    };
  });
  const distinctPitchClassNotes = getDistinctPitchClassNotes(inputNotes);

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

  if (distinctPitchClassNotes.length === 3) {
    const triadAnalysis = analyzeTriad(distinctPitchClassNotes);

    if (triadAnalysis) {
      return {
        primaryLabel: formatTriadLabel(triadAnalysis),
        secondaryLabel: formatHeldInputLabels(inputNotes),
        alternateLabel: getTriadAlternateLabel(
          triadAnalysis,
          distinctPitchClassNotes,
        ),
      };
    }
  }

  if (distinctPitchClassNotes.length === 4) {
    const fourNoteChordAnalysis = analyzeFourNoteChord(distinctPitchClassNotes);

    if (fourNoteChordAnalysis) {
      return {
        primaryLabel: fourNoteChordAnalysis.primaryLabel,
        secondaryLabel: formatHeldInputLabels(inputNotes),
        alternateLabel: fourNoteChordAnalysis.alternateLabel,
      };
    }
  }

  const powerChordAnalysis = analyzePowerChord(distinctPitchClassNotes);

  if (powerChordAnalysis) {
    return {
      primaryLabel: formatPowerChordLabel(powerChordAnalysis),
      secondaryLabel: formatHeldInputLabels(inputNotes),
    };
  }

  if (distinctPitchClassNotes.length === 3) {
    return {
      primaryLabel: "Unknown triad",
      secondaryLabel: formatHeldInputLabels(inputNotes),
    };
  }

  if (distinctPitchClassNotes.length >= 4) {
    return {
      primaryLabel: "Unknown chord",
      secondaryLabel: formatHeldInputLabels(inputNotes),
    };
  }

  return {
    primaryLabel: "Unknown chord",
    secondaryLabel: formatHeldInputLabels(inputNotes),
  };
}

function getDistinctPitchClassNotes(inputNotes: HeldInputNote[]) {
  const firstNoteByPitchClass = new Map<number, HeldInputNote>();

  for (const note of inputNotes) {
    if (!firstNoteByPitchClass.has(note.pitchClass)) {
      firstNoteByPitchClass.set(note.pitchClass, note);
    }
  }

  return [...firstNoteByPitchClass.values()].sort(
    (left, right) => left.noteNumber - right.noteNumber,
  );
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
      rootPitchClass: rootNote.pitchClass,
      bassPitchClass: inputNotes[0].pitchClass,
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

function getTriadAlternateLabel(
  triadAnalysis: TriadAnalysis,
  inputNotes: HeldInputNote[],
) {
  const suspendedAlternate = getSuspendedTriadAlternateLabel(
    triadAnalysis,
    inputNotes,
  );

  if (suspendedAlternate) {
    return suspendedAlternate;
  }

  if (triadAnalysis.inversion === "root position") {
    return undefined;
  }

  return formatTriadSlashLabel(triadAnalysis);
}

function getSuspendedTriadAlternateLabel(
  triadAnalysis: TriadAnalysis,
  inputNotes: HeldInputNote[],
) {
  if (triadAnalysis.quality !== "sus2" && triadAnalysis.quality !== "sus4") {
    return undefined;
  }

  for (const alternateRootNote of inputNotes) {
    if (alternateRootNote.pitchClass === triadAnalysis.rootPitchClass) {
      continue;
    }

    const intervals = inputNotes
      .filter((note) => note !== alternateRootNote)
      .map((note) =>
        getPitchClassDistance(alternateRootNote.pitchClass, note.pitchClass),
      )
      .sort((left, right) => left - right);
    const alternateQuality = getTriadQualityByIntervals(intervals);

    if (alternateQuality !== "sus2" && alternateQuality !== "sus4") {
      continue;
    }

    const alternateTriadAnalysis: TriadAnalysis = {
      rootKey: getPreferredPracticalTriadRootKey(alternateRootNote.pitchClass),
      rootPitchClass: alternateRootNote.pitchClass,
      bassPitchClass: triadAnalysis.bassPitchClass,
      quality: alternateQuality,
      inversion: getTriadInversion(
        inputNotes,
        alternateRootNote.pitchClass,
        alternateQuality,
      ),
    };

    return formatTriadSlashLabel(alternateTriadAnalysis);
  }

  return undefined;
}

function analyzeFourNoteChord(inputNotes: HeldInputNote[]) {
  const candidates: FourNoteChordCandidate[] = [];
  const addChordAnalysis = analyzeAddChord(inputNotes);

  if (addChordAnalysis) {
    candidates.push({
      label: formatAddChordLabel(addChordAnalysis),
      alternateLabel: formatAddChordAlternateLabel(addChordAnalysis),
      rootPitchClass: addChordAnalysis.rootPitchClass,
      inversion: addChordAnalysis.inversion,
    });
  }

  const sixthChordAnalysis = analyzeSixthChord(inputNotes);

  if (sixthChordAnalysis) {
    candidates.push({
      label: formatSixthChordLabel(sixthChordAnalysis),
      alternateLabel: formatSixthChordAlternateLabel(sixthChordAnalysis),
      rootPitchClass: sixthChordAnalysis.rootPitchClass,
      inversion: sixthChordAnalysis.inversion,
    });
  }

  const seventhChordAnalysis = analyzeSeventhChord(inputNotes);

  if (seventhChordAnalysis) {
    candidates.push({
      label: formatSeventhChordLabel(seventhChordAnalysis),
      alternateLabel: formatSeventhChordAlternateLabel(seventhChordAnalysis),
      rootPitchClass: seventhChordAnalysis.rootPitchClass,
      inversion: seventhChordAnalysis.inversion,
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  const rankedCandidates = [...candidates].sort((left, right) =>
    compareFourNoteChordCandidates(left, right, inputNotes),
  );
  const [primaryCandidate, alternateCandidate] = rankedCandidates;

  if (!primaryCandidate) {
    return null;
  }

  return {
    primaryLabel: primaryCandidate.label,
    alternateLabel:
      alternateCandidate && alternateCandidate.label !== primaryCandidate.label
        ? alternateCandidate.alternateLabel
        : primaryCandidate.alternateLabel !== primaryCandidate.label
          ? primaryCandidate.alternateLabel
          : undefined,
  };
}

function analyzeAddChord(inputNotes: HeldInputNote[]): AddChordAnalysis | null {
  if (new Set(inputNotes.map((note) => note.pitchClass)).size !== 4) {
    return null;
  }

  for (const rootNote of inputNotes) {
    const intervals = inputNotes
      .filter((note) => note !== rootNote)
      .map((note) =>
        getPitchClassDistance(rootNote.pitchClass, note.pitchClass),
      )
      .sort((left, right) => left - right);
    const addChordQuality = getAddChordQualityByIntervals(
      intervals,
      inputNotes,
      rootNote.pitchClass,
    );

    if (!addChordQuality) {
      continue;
    }

    return {
      rootKey: getPreferredPracticalTriadRootKey(rootNote.pitchClass),
      rootPitchClass: rootNote.pitchClass,
      bassPitchClass: inputNotes[0].pitchClass,
      quality: addChordQuality,
      inversion: getAddChordInversion(
        inputNotes,
        rootNote.pitchClass,
        addChordQuality,
      ),
    };
  }

  return null;
}

function getAddChordQualityByIntervals(
  intervals: number[],
  inputNotes: HeldInputNote[],
  rootPitchClass: number,
) {
  const [firstInterval, secondInterval, thirdInterval] = intervals;

  if (firstInterval === 2 && secondInterval === 4 && thirdInterval === 7) {
    return getAddedSecondQuality(inputNotes, rootPitchClass, "major");
  }

  if (firstInterval === 2 && secondInterval === 3 && thirdInterval === 7) {
    return getAddedSecondQuality(inputNotes, rootPitchClass, "minor");
  }

  if (firstInterval === 4 && secondInterval === 5 && thirdInterval === 7) {
    return "add4";
  }

  if (firstInterval === 3 && secondInterval === 5 && thirdInterval === 7) {
    return "m(add4)";
  }

  return null;
}

function getAddChordInversion(
  inputNotes: HeldInputNote[],
  rootPitchClass: number,
  addChordQuality: AddChordQuality,
): FourNoteInversion {
  const bassNote = inputNotes[0];

  if (!bassNote) {
    throw new Error("Could not determine bass note.");
  }

  const thirdPitchClass =
    (rootPitchClass + getAddChordThirdOffset(addChordQuality)) % 12;
  const addedTonePitchClass =
    (rootPitchClass + getAddChordAddedToneOffset(addChordQuality)) % 12;
  const fifthPitchClass = (rootPitchClass + 7) % 12;

  if (bassNote.pitchClass === rootPitchClass) {
    return "root position";
  }

  if (bassNote.pitchClass === thirdPitchClass) {
    return "first inversion";
  }

  if (bassNote.pitchClass === fifthPitchClass) {
    return "second inversion";
  }

  if (bassNote.pitchClass === addedTonePitchClass) {
    return "third inversion";
  }

  throw new Error("Could not determine added-chord inversion.");
}

function getAddChordThirdOffset(addChordQuality: AddChordQuality) {
  return addChordQuality === "add2" ||
    addChordQuality === "add4" ||
    addChordQuality === "add9"
    ? 4
    : 3;
}

function getAddChordAddedToneOffset(addChordQuality: AddChordQuality) {
  return addChordQuality === "add2" ||
    addChordQuality === "m(add2)" ||
    addChordQuality === "add9" ||
    addChordQuality === "m(add9)"
    ? 2
    : 5;
}

function getAddedSecondQuality(
  inputNotes: HeldInputNote[],
  rootPitchClass: number,
  triadFlavor: "major" | "minor",
): AddChordQuality {
  const rootNote = inputNotes.find(
    (note) => note.pitchClass === rootPitchClass,
  );
  const addedSecondNote = inputNotes.find(
    (note) => note.pitchClass === (rootPitchClass + 2) % 12,
  );

  if (!rootNote || !addedSecondNote) {
    throw new Error("Could not determine added-second voicing.");
  }

  const semitoneDistance = addedSecondNote.noteNumber - rootNote.noteNumber;

  if (semitoneDistance > 0 && semitoneDistance < 12) {
    return triadFlavor === "major" ? "add2" : "m(add2)";
  }

  return triadFlavor === "major" ? "add9" : "m(add9)";
}

function analyzeSixthChord(
  inputNotes: HeldInputNote[],
): SixthChordAnalysis | null {
  if (new Set(inputNotes.map((note) => note.pitchClass)).size !== 4) {
    return null;
  }

  for (const rootNote of inputNotes) {
    const intervals = inputNotes
      .filter((note) => note !== rootNote)
      .map((note) =>
        getPitchClassDistance(rootNote.pitchClass, note.pitchClass),
      )
      .sort((left, right) => left - right);
    const sixthChordQuality = getSixthChordQualityByIntervals(intervals);

    if (!sixthChordQuality) {
      continue;
    }

    return {
      rootKey: getPreferredPracticalTriadRootKey(rootNote.pitchClass),
      rootPitchClass: rootNote.pitchClass,
      bassPitchClass: inputNotes[0].pitchClass,
      quality: sixthChordQuality,
      inversion: getSixthChordInversion(
        inputNotes,
        rootNote.pitchClass,
        sixthChordQuality,
      ),
    };
  }

  return null;
}

function getSixthChordQualityByIntervals(intervals: number[]) {
  const [firstInterval, secondInterval, thirdInterval] = intervals;

  if (firstInterval === 4 && secondInterval === 7 && thirdInterval === 9) {
    return "6";
  }

  if (firstInterval === 3 && secondInterval === 7 && thirdInterval === 9) {
    return "m6";
  }

  return null;
}

function getSixthChordInversion(
  inputNotes: HeldInputNote[],
  rootPitchClass: number,
  sixthChordQuality: SixthChordQuality,
): FourNoteInversion {
  const bassNote = inputNotes[0];

  if (!bassNote) {
    throw new Error("Could not determine bass note.");
  }

  const thirdPitchClass =
    (rootPitchClass + getSixthChordThirdOffset(sixthChordQuality)) % 12;
  const fifthPitchClass = (rootPitchClass + 7) % 12;
  const sixthPitchClass = (rootPitchClass + 9) % 12;

  if (bassNote.pitchClass === rootPitchClass) {
    return "root position";
  }

  if (bassNote.pitchClass === thirdPitchClass) {
    return "first inversion";
  }

  if (bassNote.pitchClass === fifthPitchClass) {
    return "second inversion";
  }

  if (bassNote.pitchClass === sixthPitchClass) {
    return "third inversion";
  }

  throw new Error("Could not determine sixth-chord inversion.");
}

function getSixthChordThirdOffset(sixthChordQuality: SixthChordQuality) {
  return sixthChordQuality === "6" ? 4 : 3;
}

function formatSixthChordLabel(sixthChordAnalysis: SixthChordAnalysis) {
  const rootLabel = formatPitchLabel(sixthChordAnalysis.rootKey);
  const inversionSuffix =
    sixthChordAnalysis.inversion === "root position"
      ? ""
      : `, ${sixthChordAnalysis.inversion}`;

  return `${rootLabel}${sixthChordAnalysis.quality}${inversionSuffix}`;
}

function formatAddChordLabel(addChordAnalysis: AddChordAnalysis) {
  const rootLabel = formatPitchLabel(addChordAnalysis.rootKey);
  const inversionSuffix =
    addChordAnalysis.inversion === "root position"
      ? ""
      : `, ${addChordAnalysis.inversion}`;

  return `${rootLabel}${addChordAnalysis.quality}${inversionSuffix}`;
}

function formatTriadSlashLabel(triadAnalysis: TriadAnalysis) {
  const rootLabel = formatPitchLabel(triadAnalysis.rootKey);

  if (triadAnalysis.quality === "sus2" || triadAnalysis.quality === "sus4") {
    return formatSlashChordLabel(
      `${rootLabel} ${triadAnalysis.quality}`,
      triadAnalysis.inversion,
      triadAnalysis.bassPitchClass,
    );
  }

  return formatSlashChordLabel(
    `${rootLabel}`,
    triadAnalysis.inversion,
    triadAnalysis.bassPitchClass,
  );
}

function analyzeSeventhChord(
  inputNotes: HeldInputNote[],
): SeventhChordAnalysis | null {
  if (new Set(inputNotes.map((note) => note.pitchClass)).size !== 4) {
    return null;
  }

  for (const rootNote of inputNotes) {
    const intervals = inputNotes
      .filter((note) => note !== rootNote)
      .map((note) =>
        getPitchClassDistance(rootNote.pitchClass, note.pitchClass),
      )
      .sort((left, right) => left - right);
    const seventhChordQuality = getSeventhChordQualityByIntervals(intervals);

    if (!seventhChordQuality) {
      continue;
    }

    return {
      rootKey: getPreferredPracticalTriadRootKey(rootNote.pitchClass),
      rootPitchClass: rootNote.pitchClass,
      bassPitchClass: inputNotes[0].pitchClass,
      quality: seventhChordQuality,
      inversion: getSeventhChordInversion(
        inputNotes,
        rootNote.pitchClass,
        seventhChordQuality,
      ),
    };
  }

  return null;
}

function getSeventhChordQualityByIntervals(intervals: number[]) {
  const [firstInterval, secondInterval, thirdInterval] = intervals;

  if (firstInterval === 4 && secondInterval === 7 && thirdInterval === 11) {
    return "maj7";
  }

  if (firstInterval === 4 && secondInterval === 7 && thirdInterval === 10) {
    return "7";
  }

  if (firstInterval === 3 && secondInterval === 7 && thirdInterval === 11) {
    return "m(maj7)";
  }

  if (firstInterval === 4 && secondInterval === 8 && thirdInterval === 11) {
    return "maj7#5";
  }

  if (firstInterval === 4 && secondInterval === 8 && thirdInterval === 10) {
    return "7#5";
  }

  if (firstInterval === 3 && secondInterval === 7 && thirdInterval === 10) {
    return "m7";
  }

  if (firstInterval === 3 && secondInterval === 6 && thirdInterval === 10) {
    return "m7b5";
  }

  if (firstInterval === 3 && secondInterval === 6 && thirdInterval === 9) {
    return "dim7";
  }

  return null;
}

function getSeventhChordInversion(
  inputNotes: HeldInputNote[],
  rootPitchClass: number,
  seventhChordQuality: SeventhChordQuality,
): FourNoteInversion {
  const bassNote = inputNotes[0];

  if (!bassNote) {
    throw new Error("Could not determine bass note.");
  }

  const thirdPitchClass =
    (rootPitchClass + getSeventhChordThirdOffset(seventhChordQuality)) % 12;
  const fifthPitchClass =
    (rootPitchClass + getSeventhChordFifthOffset(seventhChordQuality)) % 12;
  const seventhPitchClass =
    (rootPitchClass + getSeventhChordSeventhOffset(seventhChordQuality)) % 12;

  if (bassNote.pitchClass === rootPitchClass) {
    return "root position";
  }

  if (bassNote.pitchClass === thirdPitchClass) {
    return "first inversion";
  }

  if (bassNote.pitchClass === fifthPitchClass) {
    return "second inversion";
  }

  if (bassNote.pitchClass === seventhPitchClass) {
    return "third inversion";
  }

  throw new Error("Could not determine seventh-chord inversion.");
}

function getSeventhChordThirdOffset(seventhChordQuality: SeventhChordQuality) {
  return seventhChordQuality === "maj7" ||
    seventhChordQuality === "7" ||
    seventhChordQuality === "maj7#5" ||
    seventhChordQuality === "7#5"
    ? 4
    : 3;
}

function getSeventhChordFifthOffset(seventhChordQuality: SeventhChordQuality) {
  if (seventhChordQuality === "m7b5" || seventhChordQuality === "dim7") {
    return 6;
  }

  if (seventhChordQuality === "maj7#5" || seventhChordQuality === "7#5") {
    return 8;
  }

  return 7;
}

function getSeventhChordSeventhOffset(
  seventhChordQuality: SeventhChordQuality,
) {
  if (
    seventhChordQuality === "maj7" ||
    seventhChordQuality === "m(maj7)" ||
    seventhChordQuality === "maj7#5"
  ) {
    return 11;
  }

  if (seventhChordQuality === "dim7") {
    return 9;
  }

  return 10;
}

function formatSeventhChordLabel(seventhChordAnalysis: SeventhChordAnalysis) {
  const rootLabel = formatPitchLabel(seventhChordAnalysis.rootKey);
  const inversionSuffix =
    seventhChordAnalysis.inversion === "root position"
      ? ""
      : `, ${seventhChordAnalysis.inversion}`;

  return `${rootLabel}${seventhChordAnalysis.quality}${inversionSuffix}`;
}

function formatSixthChordAlternateLabel(
  sixthChordAnalysis: SixthChordAnalysis,
) {
  return formatSlashChordLabel(
    `${formatPitchLabel(sixthChordAnalysis.rootKey)}${sixthChordAnalysis.quality}`,
    sixthChordAnalysis.inversion,
    sixthChordAnalysis.bassPitchClass,
  );
}

function formatAddChordAlternateLabel(addChordAnalysis: AddChordAnalysis) {
  const aliasQuality = getAddChordAliasQuality(addChordAnalysis.quality);

  if (aliasQuality) {
    return formatSlashChordLabel(
      `${formatPitchLabel(addChordAnalysis.rootKey)}${aliasQuality}`,
      addChordAnalysis.inversion,
      addChordAnalysis.bassPitchClass,
    );
  }

  if (addChordAnalysis.inversion === "root position") {
    return undefined;
  }

  return formatSlashChordLabel(
    `${formatPitchLabel(addChordAnalysis.rootKey)}${addChordAnalysis.quality}`,
    addChordAnalysis.inversion,
    addChordAnalysis.bassPitchClass,
  );
}

function getAddChordAliasQuality(addChordQuality: AddChordQuality) {
  const aliasByQuality: Partial<Record<AddChordQuality, AddChordQuality>> = {
    add2: "add9",
    "m(add2)": "m(add9)",
    add9: "add2",
    "m(add9)": "m(add2)",
  };

  return aliasByQuality[addChordQuality];
}

function formatSeventhChordAlternateLabel(
  seventhChordAnalysis: SeventhChordAnalysis,
) {
  return formatSlashChordLabel(
    `${formatPitchLabel(seventhChordAnalysis.rootKey)}${seventhChordAnalysis.quality}`,
    seventhChordAnalysis.inversion,
    seventhChordAnalysis.bassPitchClass,
  );
}

function formatSlashChordLabel(
  baseLabel: string,
  inversion: FourNoteInversion,
  bassPitchClass: number,
) {
  if (inversion === "root position") {
    return baseLabel;
  }

  return `${baseLabel}/${formatPitchLabel(getPreferredPracticalTriadRootKey(bassPitchClass))}`;
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

function compareFourNoteChordCandidates(
  left: FourNoteChordCandidate,
  right: FourNoteChordCandidate,
  inputNotes: HeldInputNote[],
) {
  const bassNote = inputNotes[0];

  if (!bassNote) {
    return 0;
  }

  const leftBassRootMatch = left.rootPitchClass === bassNote.pitchClass;
  const rightBassRootMatch = right.rootPitchClass === bassNote.pitchClass;

  if (leftBassRootMatch !== rightBassRootMatch) {
    return leftBassRootMatch ? -1 : 1;
  }

  const inversionDifference =
    getFourNoteInversionIndex(left.inversion) -
    getFourNoteInversionIndex(right.inversion);

  if (inversionDifference !== 0) {
    return inversionDifference;
  }

  return left.label.localeCompare(right.label);
}

function getFourNoteInversionIndex(inversion: FourNoteInversion) {
  const inversionOrder: Record<FourNoteInversion, number> = {
    "root position": 0,
    "first inversion": 1,
    "second inversion": 2,
    "third inversion": 3,
  };

  return inversionOrder[inversion];
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
