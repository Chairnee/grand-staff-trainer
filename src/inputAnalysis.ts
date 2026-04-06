export type InputNameVariant = {
  shorthand: string;
  longhand: string;
};

export type InputAnalysis = {
  noteLabel: string | null;
  primary: InputNameVariant | null;
  alternates: InputNameVariant[];
};

type InputAnalysisCandidate = InputNameVariant & {
  bassPitchClass: number;
  rootPitchClass: number;
};

export function analyzeHeldInput(heldNotes: number[]): InputAnalysis {
  if (heldNotes.length === 0) {
    return {
      noteLabel: null,
      primary: null,
      alternates: [],
    };
  }

  const distinctHeldNotes = [...new Set(heldNotes)].sort(
    (left, right) => left - right,
  );
  const noteLabels = distinctHeldNotes.map(getCommonPracticalDisplayLabel);
  const noteLabel = noteLabels.join("-");
  const distinctPitchClasses = getDistinctPitchClasses(distinctHeldNotes);

  if (distinctHeldNotes.length === 1) {
    const noteNumber = distinctHeldNotes[0];

    if (noteNumber === undefined) {
      throw new Error("Could not determine held note.");
    }

    const shorthand = getCommonPracticalPitchLabel(noteNumber);

    return finalizeAnalysis(noteLabel, [
      {
        shorthand,
        longhand: `${shorthand} note`,
        rootPitchClass: getPitchClass(noteNumber),
        bassPitchClass: getPitchClass(noteNumber),
      },
    ]);
  }

  if (distinctHeldNotes.length === 2) {
    const [lowerNoteNumber, higherNoteNumber] = distinctHeldNotes;

    if (lowerNoteNumber === undefined || higherNoteNumber === undefined) {
      throw new Error("Could not determine held interval.");
    }

    const intervalAnalysis = analyzeSimpleInterval(
      lowerNoteNumber,
      higherNoteNumber,
    );

    if (intervalAnalysis) {
      return finalizeAnalysis(noteLabel, [intervalAnalysis]);
    }
  }

  if (distinctHeldNotes.length > 2 && distinctPitchClasses.length === 1) {
    const lowerNoteNumber = distinctHeldNotes[0];
    const higherNoteNumber = distinctHeldNotes.at(-1);

    if (lowerNoteNumber === undefined || higherNoteNumber === undefined) {
      throw new Error("Could not determine octave stack interval.");
    }

    const octaveStackAnalysis = analyzeSimpleInterval(
      lowerNoteNumber,
      higherNoteNumber,
    );

    if (octaveStackAnalysis) {
      return finalizeAnalysis(noteLabel, [octaveStackAnalysis]);
    }
  }

  if (distinctHeldNotes.length > 2 && distinctPitchClasses.length === 2) {
    const bassNoteNumber = distinctHeldNotes[0];
    const [rootPitchClass, otherPitchClass] = distinctPitchClasses;

    if (
      bassNoteNumber === undefined ||
      rootPitchClass === undefined ||
      otherPitchClass === undefined
    ) {
      throw new Error("Could not determine two-pitch-class input.");
    }

    const powerChordCandidates = analyzePowerChord(
      distinctPitchClasses,
      getPitchClass(bassNoteNumber),
    );

    if (powerChordCandidates.length > 0) {
      return finalizeAnalysis(noteLabel, powerChordCandidates);
    }

    const collapsedIntervalAnalysis = analyzeCollapsedInterval(
      rootPitchClass,
      otherPitchClass,
    );

    if (collapsedIntervalAnalysis) {
      return finalizeAnalysis(noteLabel, [collapsedIntervalAnalysis]);
    }
  }

  if (distinctPitchClasses.length === 3) {
    const bassNoteNumber = distinctHeldNotes[0];

    if (bassNoteNumber === undefined) {
      throw new Error("Could not determine triad bass note.");
    }

    const triadAnalysis = analyzeThreeNoteChord(
      distinctPitchClasses,
      getPitchClass(bassNoteNumber),
    );

    if (triadAnalysis.length > 0) {
      return finalizeAnalysis(noteLabel, triadAnalysis);
    }
  }

  if (distinctPitchClasses.length === 4) {
    const bassNoteNumber = distinctHeldNotes[0];

    if (bassNoteNumber === undefined) {
      throw new Error("Could not determine seventh-chord bass note.");
    }

    const seventhChordAnalysis = analyzeFourNoteChord(
      distinctPitchClasses,
      getPitchClass(bassNoteNumber),
    );

    if (seventhChordAnalysis.length > 0) {
      return finalizeAnalysis(noteLabel, seventhChordAnalysis);
    }
  }

  return {
    noteLabel,
    primary: null,
    alternates: [],
  };
}

function getDistinctPitchClasses(noteNumbers: number[]) {
  const pitchClasses = new Set<number>();

  for (const noteNumber of noteNumbers) {
    pitchClasses.add(((noteNumber % 12) + 12) % 12);
  }

  return [...pitchClasses];
}

function analyzeSimpleInterval(
  lowerNoteNumber: number,
  higherNoteNumber: number,
): InputAnalysisCandidate | null {
  const semitoneDistance = higherNoteNumber - lowerNoteNumber;
  return buildIntervalVariant(lowerNoteNumber, semitoneDistance);
}

function analyzeCollapsedInterval(
  rootPitchClass: number,
  otherPitchClass: number,
): InputAnalysisCandidate | null {
  const semitoneDistance = (otherPitchClass - rootPitchClass + 12) % 12;

  if (semitoneDistance === 0) {
    return null;
  }

  return buildIntervalVariant(rootPitchClass, semitoneDistance);
}

function analyzePowerChord(
  distinctPitchClasses: number[],
  bassPitchClass: number,
): InputAnalysisCandidate[] {
  const candidates: InputAnalysisCandidate[] = [];

  for (const candidateRootPitchClass of distinctPitchClasses) {
    const otherPitchClass = distinctPitchClasses.find(
      (pitchClass) => pitchClass !== candidateRootPitchClass,
    );

    if (otherPitchClass === undefined) {
      continue;
    }

    const intervalFromRoot =
      (otherPitchClass - candidateRootPitchClass + 12) % 12;

    if (intervalFromRoot !== 7) {
      continue;
    }

    const rootLabel = getPreferredPracticalRootLabel(candidateRootPitchClass);
    const bassLabel = getPreferredPracticalRootLabel(bassPitchClass);
    const bassInterval = (bassPitchClass - candidateRootPitchClass + 12) % 12;

    if (bassInterval !== 0 && bassInterval !== 7) {
      continue;
    }

    candidates.push({
      shorthand:
        bassInterval === 0 ? `${rootLabel}5` : `${rootLabel}5/${bassLabel}`,
      longhand:
        bassInterval === 0
          ? `${rootLabel} 5 chord`
          : `${rootLabel} 5 chord over ${bassLabel}`,
      rootPitchClass: candidateRootPitchClass,
      bassPitchClass,
    });
  }

  return candidates;
}

function analyzeThreeNoteChord(
  distinctPitchClasses: number[],
  bassPitchClass: number,
): InputAnalysisCandidate[] {
  const candidates: InputAnalysisCandidate[] = [];

  for (const candidateRootPitchClass of distinctPitchClasses) {
    const intervals = distinctPitchClasses
      .filter((pitchClass) => pitchClass !== candidateRootPitchClass)
      .map((pitchClass) => (pitchClass - candidateRootPitchClass + 12) % 12)
      .sort((left, right) => left - right);
    const intervalPattern = intervals.join(",");
    const rootLabel = getPreferredPracticalRootLabel(candidateRootPitchClass);
    const triadMetadata = getTriadMetadata(intervalPattern);

    if (!triadMetadata) {
      continue;
    }

    const bassInterval = (bassPitchClass - candidateRootPitchClass + 12) % 12;
    const bassLabel = getPreferredPracticalRootLabel(bassPitchClass);
    const threeNoteChordVariant = buildThreeNoteChordVariant(
      triadMetadata,
      rootLabel,
      bassLabel,
      bassInterval,
      candidateRootPitchClass,
      bassPitchClass,
    );

    if (!threeNoteChordVariant) {
      continue;
    }

    candidates.push(threeNoteChordVariant);
  }

  return candidates;
}

function analyzeFourNoteChord(
  distinctPitchClasses: number[],
  bassPitchClass: number,
): InputAnalysisCandidate[] {
  const candidates: InputAnalysisCandidate[] = [];

  for (const candidateRootPitchClass of distinctPitchClasses) {
    const intervals = distinctPitchClasses
      .filter((pitchClass) => pitchClass !== candidateRootPitchClass)
      .map((pitchClass) => (pitchClass - candidateRootPitchClass + 12) % 12)
      .sort((left, right) => left - right);
    const intervalPattern = intervals.join(",");
    const seventhChordMetadata = getSeventhChordMetadata(intervalPattern);

    if (!seventhChordMetadata) {
      continue;
    }

    const rootLabel = getPreferredPracticalRootLabel(candidateRootPitchClass);
    const bassLabel = getPreferredPracticalRootLabel(bassPitchClass);
    const bassInterval = (bassPitchClass - candidateRootPitchClass + 12) % 12;
    const inversionMetadata = getSeventhChordInversionMetadata(
      intervals,
      bassInterval,
    );

    if (!inversionMetadata) {
      continue;
    }

    candidates.push({
      shorthand:
        inversionMetadata.shorthandSuffix === null
          ? `${rootLabel}${seventhChordMetadata.shorthandSuffix}`
          : `${rootLabel}${seventhChordMetadata.shorthandSuffix}/${bassLabel}`,
      longhand:
        inversionMetadata.longhandSuffix === null
          ? `${rootLabel} ${seventhChordMetadata.longhandSuffix}`
          : `${rootLabel} ${seventhChordMetadata.longhandSuffix}, ${inversionMetadata.longhandSuffix}`,
      rootPitchClass: candidateRootPitchClass,
      bassPitchClass,
    });
  }

  return candidates;
}

function buildThreeNoteChordVariant(
  triadMetadata: ReturnType<typeof getTriadMetadata>,
  rootLabel: string,
  bassLabel: string,
  bassInterval: number,
  rootPitchClass: number,
  bassPitchClass: number,
): InputAnalysisCandidate | null {
  if (!triadMetadata) {
    return null;
  }

  if (triadMetadata.family === "tertian") {
    const inversionMetadata = getTriadInversionMetadata(bassInterval);

    if (!inversionMetadata) {
      return null;
    }

    return {
      shorthand:
        inversionMetadata.shorthandSuffix === null
          ? `${rootLabel}${triadMetadata.shorthandSuffix}`
          : `${rootLabel}${triadMetadata.shorthandSuffix}/${bassLabel}`,
      longhand:
        inversionMetadata.longhandSuffix === null
          ? `${rootLabel} ${triadMetadata.longhandSuffix}`
          : `${rootLabel} ${triadMetadata.longhandSuffix}, ${inversionMetadata.longhandSuffix}`,
      rootPitchClass,
      bassPitchClass,
    };
  }

  const suspendedChordMetadata = getSuspendedChordBassMetadata(
    triadMetadata.kind,
    bassInterval,
  );

  if (!suspendedChordMetadata) {
    return null;
  }

  return {
    shorthand: suspendedChordMetadata.usesSlashNotation
      ? `${rootLabel}${triadMetadata.shorthandSuffix}/${bassLabel}`
      : `${rootLabel}${triadMetadata.shorthandSuffix}`,
    longhand: suspendedChordMetadata.usesSlashNotation
      ? `${rootLabel} ${triadMetadata.longhandSuffix} over ${bassLabel}`
      : `${rootLabel} ${triadMetadata.longhandSuffix}`,
    rootPitchClass,
    bassPitchClass,
  };
}

function buildIntervalVariant(
  rootPitchClass: number,
  semitoneDistance: number,
): InputAnalysisCandidate | null {
  const rootLabel = getPreferredPracticalRootLabel(rootPitchClass);
  const intervalMetadata = getIntervalMetadata(semitoneDistance);

  if (!intervalMetadata) {
    return null;
  }

  return {
    shorthand: `${rootLabel}${intervalMetadata.shorthandSuffix}`,
    longhand: `${rootLabel} ${intervalMetadata.longhandSuffix} (${formatSemitoneCount(semitoneDistance)})`,
    rootPitchClass,
    bassPitchClass: rootPitchClass,
  };
}

function finalizeAnalysis(
  noteLabel: string,
  candidates: InputAnalysisCandidate[],
): InputAnalysis {
  const uniqueCandidates = dedupeCandidates(candidates);
  const sortedCandidates = uniqueCandidates.sort(compareCandidates);
  const [primaryCandidate, ...alternateCandidates] = sortedCandidates;

  return {
    noteLabel,
    primary: primaryCandidate
      ? {
          shorthand: primaryCandidate.shorthand,
          longhand: primaryCandidate.longhand,
        }
      : null,
    alternates: alternateCandidates.map(({ shorthand, longhand }) => ({
      shorthand,
      longhand,
    })),
  };
}

function dedupeCandidates(candidates: InputAnalysisCandidate[]) {
  const seenCandidateKeys = new Set<string>();
  const uniqueCandidates: InputAnalysisCandidate[] = [];

  for (const candidate of candidates) {
    const candidateKey = `${candidate.shorthand}::${candidate.longhand}`;

    if (seenCandidateKeys.has(candidateKey)) {
      continue;
    }

    seenCandidateKeys.add(candidateKey);
    uniqueCandidates.push(candidate);
  }

  return uniqueCandidates;
}

function compareCandidates(
  leftCandidate: InputAnalysisCandidate,
  rightCandidate: InputAnalysisCandidate,
) {
  const leftCandidateRootMatchesBass =
    leftCandidate.rootPitchClass === leftCandidate.bassPitchClass;
  const rightCandidateRootMatchesBass =
    rightCandidate.rootPitchClass === rightCandidate.bassPitchClass;

  if (leftCandidateRootMatchesBass !== rightCandidateRootMatchesBass) {
    return leftCandidateRootMatchesBass ? -1 : 1;
  }

  if (leftCandidate.rootPitchClass !== rightCandidate.rootPitchClass) {
    return leftCandidate.rootPitchClass - rightCandidate.rootPitchClass;
  }

  return leftCandidate.shorthand.localeCompare(rightCandidate.shorthand);
}

function getCommonPracticalPitchLabel(noteNumber: number) {
  const commonPracticalPitchLabels = [
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
  const pitchLabel = commonPracticalPitchLabels[((noteNumber % 12) + 12) % 12];

  if (!pitchLabel) {
    throw new Error(`Invalid MIDI note number: ${noteNumber}`);
  }

  return pitchLabel;
}

function getPitchClass(noteNumber: number) {
  return ((noteNumber % 12) + 12) % 12;
}

function getPreferredPracticalRootLabel(noteNumber: number) {
  const preferredPracticalRootLabels = [
    "C",
    "Db",
    "D",
    "Eb",
    "E",
    "F",
    "Gb",
    "G",
    "Ab",
    "A",
    "Bb",
    "B",
  ];
  const rootLabel = preferredPracticalRootLabels[((noteNumber % 12) + 12) % 12];

  if (!rootLabel) {
    throw new Error(`Invalid MIDI note number: ${noteNumber}`);
  }

  return rootLabel;
}

function getCommonPracticalDisplayLabel(noteNumber: number) {
  const commonPracticalPitchLabels = [
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
  const pitchLabel = commonPracticalPitchLabels[((noteNumber % 12) + 12) % 12];
  const octave = Math.floor(noteNumber / 12) - 1;

  if (!pitchLabel) {
    throw new Error(`Invalid MIDI note number: ${noteNumber}`);
  }

  return pitchLabel
    .split("/")
    .map((label) => `${label}${octave}`)
    .join("/");
}

function getIntervalMetadata(semitoneDistance: number) {
  if (semitoneDistance <= 0) {
    return null;
  }

  const intervalDescriptorBySemitoneClass: Record<
    number,
    {
      qualityCode: "m" | "M" | "P";
      qualityWord: "minor" | "major" | "perfect";
      intervalNumber: number;
      longhandName: string;
    }
  > = {
    1: {
      qualityCode: "m",
      qualityWord: "minor",
      intervalNumber: 2,
      longhandName: "minor 2nd",
    },
    2: {
      qualityCode: "M",
      qualityWord: "major",
      intervalNumber: 2,
      longhandName: "major 2nd",
    },
    3: {
      qualityCode: "m",
      qualityWord: "minor",
      intervalNumber: 3,
      longhandName: "minor 3rd",
    },
    4: {
      qualityCode: "M",
      qualityWord: "major",
      intervalNumber: 3,
      longhandName: "major 3rd",
    },
    5: {
      qualityCode: "P",
      qualityWord: "perfect",
      intervalNumber: 4,
      longhandName: "perfect 4th",
    },
    6: {
      qualityCode: "P",
      qualityWord: "perfect",
      intervalNumber: 0,
      longhandName: "tritone",
    },
    7: {
      qualityCode: "P",
      qualityWord: "perfect",
      intervalNumber: 5,
      longhandName: "perfect 5th",
    },
    8: {
      qualityCode: "m",
      qualityWord: "minor",
      intervalNumber: 6,
      longhandName: "minor 6th",
    },
    9: {
      qualityCode: "M",
      qualityWord: "major",
      intervalNumber: 6,
      longhandName: "major 6th",
    },
    10: {
      qualityCode: "m",
      qualityWord: "minor",
      intervalNumber: 7,
      longhandName: "minor 7th",
    },
    11: {
      qualityCode: "M",
      qualityWord: "major",
      intervalNumber: 7,
      longhandName: "major 7th",
    },
    0: {
      qualityCode: "P",
      qualityWord: "perfect",
      intervalNumber: 8,
      longhandName: "octave",
    },
  };
  const semitoneClass = semitoneDistance % 12;
  const descriptor = intervalDescriptorBySemitoneClass[semitoneClass];

  if (!descriptor) {
    return null;
  }

  if (semitoneDistance <= 12) {
    return {
      shorthandSuffix:
        semitoneDistance === 6
          ? "TT"
          : `${descriptor.qualityCode}${descriptor.intervalNumber}`,
      longhandSuffix: descriptor.longhandName,
    };
  }

  const octaveCount = Math.floor(semitoneDistance / 12);
  const isCompoundTritone = semitoneClass === 6;
  const isCleanCompoundInterval = semitoneDistance <= 24 && !isCompoundTritone;

  if (isCleanCompoundInterval) {
    const intervalNumber =
      semitoneClass === 0
        ? descriptor.intervalNumber + (octaveCount - 1) * 7
        : descriptor.intervalNumber + octaveCount * 7;

    return {
      shorthandSuffix: `${descriptor.qualityCode}${intervalNumber}`,
      longhandSuffix:
        intervalNumber === 15 && semitoneClass === 0
          ? "double octave"
          : `${descriptor.qualityWord} ${formatIntervalOrdinal(intervalNumber)}`,
    };
  }

  return {
    shorthandSuffix:
      semitoneClass === 6
        ? "TT"
        : `${descriptor.qualityCode}${descriptor.intervalNumber}`,
    longhandSuffix: descriptor.longhandName,
  };
}

function getTriadMetadata(intervalPattern: string) {
  const triadMetadataByPattern: Record<
    string,
    {
      family: "tertian" | "suspended";
      kind: "major" | "minor" | "diminished" | "augmented" | "sus2" | "sus4";
      shorthandSuffix: string;
      longhandSuffix: string;
    }
  > = {
    "4,7": {
      family: "tertian",
      kind: "major",
      shorthandSuffix: "M",
      longhandSuffix: "major triad",
    },
    "3,7": {
      family: "tertian",
      kind: "minor",
      shorthandSuffix: "m",
      longhandSuffix: "minor triad",
    },
    "3,6": {
      family: "tertian",
      kind: "diminished",
      shorthandSuffix: "dim",
      longhandSuffix: "diminished triad",
    },
    "4,8": {
      family: "tertian",
      kind: "augmented",
      shorthandSuffix: "aug",
      longhandSuffix: "augmented triad",
    },
    "2,7": {
      family: "suspended",
      kind: "sus2",
      shorthandSuffix: "sus2",
      longhandSuffix: "suspended 2nd",
    },
    "5,7": {
      family: "suspended",
      kind: "sus4",
      shorthandSuffix: "sus4",
      longhandSuffix: "suspended 4th",
    },
  };

  return triadMetadataByPattern[intervalPattern] ?? null;
}

function getTriadInversionMetadata(bassInterval: number) {
  const inversionMetadataByBassInterval: Record<
    number,
    { shorthandSuffix: null | string; longhandSuffix: null | string }
  > = {
    0: {
      shorthandSuffix: null,
      longhandSuffix: null,
    },
    3: {
      shorthandSuffix: "/3",
      longhandSuffix: "first inversion",
    },
    4: {
      shorthandSuffix: "/3",
      longhandSuffix: "first inversion",
    },
    6: {
      shorthandSuffix: "/5",
      longhandSuffix: "second inversion",
    },
    7: {
      shorthandSuffix: "/5",
      longhandSuffix: "second inversion",
    },
    8: {
      shorthandSuffix: "/3",
      longhandSuffix: "first inversion",
    },
  };

  return inversionMetadataByBassInterval[bassInterval] ?? null;
}

function getSeventhChordMetadata(intervalPattern: string) {
  const seventhChordMetadataByPattern: Record<
    string,
    { shorthandSuffix: string; longhandSuffix: string }
  > = {
    "4,7,11": {
      shorthandSuffix: "M7",
      longhandSuffix: "major 7th chord",
    },
    "4,7,10": {
      shorthandSuffix: "7",
      longhandSuffix: "dominant 7th chord",
    },
    "3,7,10": {
      shorthandSuffix: "m7",
      longhandSuffix: "minor 7th chord",
    },
    "3,6,10": {
      shorthandSuffix: "m7b5",
      longhandSuffix: "half-diminished 7th chord",
    },
    "3,6,9": {
      shorthandSuffix: "dim7",
      longhandSuffix: "diminished 7th chord",
    },
  };

  return seventhChordMetadataByPattern[intervalPattern] ?? null;
}

function getSeventhChordInversionMetadata(
  intervals: number[],
  bassInterval: number,
) {
  if (bassInterval === 0) {
    return {
      shorthandSuffix: null,
      longhandSuffix: null,
    };
  }

  const inversionIndex = intervals.indexOf(bassInterval);

  if (inversionIndex === -1) {
    return null;
  }

  const inversionLonghandSuffixes = [
    "first inversion",
    "second inversion",
    "third inversion",
  ] as const;
  const inversionLonghandSuffix = inversionLonghandSuffixes[inversionIndex];

  if (!inversionLonghandSuffix) {
    return null;
  }

  return {
    shorthandSuffix: "/7",
    longhandSuffix: inversionLonghandSuffix,
  };
}

function getSuspendedChordBassMetadata(
  kind: "major" | "minor" | "diminished" | "augmented" | "sus2" | "sus4",
  bassInterval: number,
) {
  if (kind === "sus2") {
    const suspendedChordBassMetadataByInterval: Record<
      number,
      { usesSlashNotation: boolean }
    > = {
      0: { usesSlashNotation: false },
      2: { usesSlashNotation: true },
      7: { usesSlashNotation: true },
    };

    return suspendedChordBassMetadataByInterval[bassInterval] ?? null;
  }

  if (kind === "sus4") {
    const suspendedChordBassMetadataByInterval: Record<
      number,
      { usesSlashNotation: boolean }
    > = {
      0: { usesSlashNotation: false },
      5: { usesSlashNotation: true },
      7: { usesSlashNotation: true },
    };

    return suspendedChordBassMetadataByInterval[bassInterval] ?? null;
  }

  return null;
}

function formatIntervalOrdinal(intervalNumber: number) {
  const intervalOrdinals: Record<number, string> = {
    2: "2nd",
    3: "3rd",
    4: "4th",
    5: "5th",
    6: "6th",
    7: "7th",
    8: "8th",
    9: "9th",
    10: "10th",
    11: "11th",
    12: "12th",
    13: "13th",
    14: "14th",
    15: "15th",
  };

  return intervalOrdinals[intervalNumber] ?? `${intervalNumber}th`;
}

function formatSemitoneCount(semitoneDistance: number) {
  return `${semitoneDistance} ${semitoneDistance === 1 ? "semitone" : "semitones"}`;
}
