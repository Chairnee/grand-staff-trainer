import {
  type GenerationSettings,
  getAscendingTriadPositions,
  getTriadNoteNames,
  getTriadStartingOctave,
  keyToMidiNoteNumber,
  type ScaleHands,
} from "../theory/music";
import type { PromptSlot } from "./types";

export function createTriadPracticeQueue(
  generationSettings: GenerationSettings,
) {
  if (
    generationSettings.scaleHands === "together" &&
    generationSettings.scaleMotion === "contrary"
  ) {
    return createContraryMotionTriadPracticeQueue(generationSettings);
  }

  if (
    generationSettings.scaleHands !== "together" &&
    generationSettings.scaleDirection === "descending"
  ) {
    return createDescendingSingleHandTriadPracticeQueue(generationSettings);
  }

  const trebleStartingOctave = getTriadStartingOctave(
    generationSettings.tonic,
    generationSettings.triadType,
    generationSettings.renderingPreference,
  );
  const trebleAscendingTriads = getAscendingTriadPositions(
    generationSettings.tonic,
    generationSettings.triadType,
    trebleStartingOctave,
    generationSettings.scaleOctaves,
    generationSettings.renderingPreference,
  );
  const bassAscendingTriads = getAscendingTriadPositions(
    generationSettings.tonic,
    generationSettings.triadType,
    trebleStartingOctave - 1,
    generationSettings.scaleOctaves,
    generationSettings.renderingPreference,
  );
  const ascendingPrompts = createTriadPromptsForHands(
    trebleAscendingTriads,
    bassAscendingTriads,
    generationSettings.scaleHands,
    generationSettings.scaleOctaves,
    "ascending",
  );
  const descendingPrompts = createTriadPromptsForHands(
    [...trebleAscendingTriads].slice(0, -1).reverse(),
    [...bassAscendingTriads].slice(0, -1).reverse(),
    generationSettings.scaleHands,
    generationSettings.scaleOctaves,
    "descending",
  );

  return [...ascendingPrompts, ...descendingPrompts.slice(0, -1)];
}

function createDescendingSingleHandTriadPracticeQueue(
  generationSettings: GenerationSettings,
) {
  const scaleHands = generationSettings.scaleHands;

  if (scaleHands === "together") {
    throw new Error("Descending single-hand triads require a single hand.");
  }

  const descendingStartingOctave =
    scaleHands === "treble"
      ? getDescendingTrebleTriadStartingOctave(generationSettings)
      : getDescendingBassTriadStartingOctave(generationSettings);
  const descendingTriads = getAscendingTriadPositions(
    generationSettings.tonic,
    generationSettings.triadType,
    descendingStartingOctave,
    generationSettings.scaleOctaves,
    generationSettings.renderingPreference,
  ).reverse();
  const ascendingTriads = getAscendingTriadPositions(
    generationSettings.tonic,
    generationSettings.triadType,
    descendingStartingOctave,
    generationSettings.scaleOctaves,
    generationSettings.renderingPreference,
  ).slice(1);
  const promptQueue: PromptSlot[] =
    scaleHands === "treble"
      ? [
          ...descendingTriads.map((trebleKeys) => ({
            duration: "q" as const,
            trebleKeys,
          })),
          ...ascendingTriads.map((trebleKeys) => ({
            duration: "q" as const,
            trebleKeys,
          })),
        ]
      : [
          ...descendingTriads.map((bassKeys) => ({
            duration: "q" as const,
            bassKeys,
          })),
          ...ascendingTriads.map((bassKeys) => ({
            duration: "q" as const,
            bassKeys,
          })),
        ];

  promptQueue.pop();

  if (scaleHands === "treble") {
    applyTrebleOttavaToHighSingleHandTriadPrompts(promptQueue);
  } else {
    applyBassOttavaToLowTriadPrompts(promptQueue);
  }

  return promptQueue;
}

function createContraryMotionTriadPracticeQueue(
  generationSettings: GenerationSettings,
) {
  const sharedStartingOctave = getTriadStartingOctave(
    generationSettings.tonic,
    generationSettings.triadType,
    generationSettings.renderingPreference,
  );
  const trebleAscendingTriads = getAscendingTriadPositions(
    generationSettings.tonic,
    generationSettings.triadType,
    sharedStartingOctave,
    generationSettings.scaleOctaves,
    generationSettings.renderingPreference,
  );
  const bassDescendingTriads = getDescendingContraryBassTriadPositions(
    generationSettings,
    sharedStartingOctave,
  );
  const outwardPrompts = createContraryTriadPrompts(
    trebleAscendingTriads,
    bassDescendingTriads,
    generationSettings.scaleOctaves,
    "ascending",
  );
  const inwardPrompts = createContraryTriadPrompts(
    [...trebleAscendingTriads].reverse().slice(1),
    [...bassDescendingTriads].reverse().slice(1),
    generationSettings.scaleOctaves,
    "descending",
  );
  const promptQueue = [...outwardPrompts, ...inwardPrompts.slice(0, -1)];

  applyBassOttavaToLowTriadPrompts(promptQueue);

  return promptQueue;
}

function createTriadPromptsForHands(
  trebleTriads: string[][],
  bassTriads: string[][],
  scaleHands: ScaleHands,
  scaleOctaves: GenerationSettings["scaleOctaves"],
  direction: "ascending" | "descending",
): PromptSlot[] {
  return trebleTriads.map((trebleKeys, index) => {
    const bassKeys = bassTriads[index];

    if (!bassKeys) {
      throw new Error("Could not find matching bass triad.");
    }

    const prompt = createTriadPrompt(
      trebleKeys,
      bassKeys,
      scaleOctaves,
      direction,
      index,
    );

    if (scaleHands === "treble") {
      return {
        ...prompt,
        bassKeys: undefined,
        displayedBassKeys: undefined,
        bassOttavaActive: undefined,
        bassDisplayedClef: undefined,
      };
    }

    if (scaleHands === "bass") {
      return {
        ...prompt,
        trebleKeys: undefined,
        displayedTrebleKeys: undefined,
        trebleOttavaActive: undefined,
        trebleOttavaStart: undefined,
        trebleOttavaEnd: undefined,
      };
    }

    return prompt;
  });
}

function createContraryTriadPrompts(
  trebleTriads: string[][],
  bassTriads: string[][],
  scaleOctaves: GenerationSettings["scaleOctaves"],
  direction: "ascending" | "descending",
) {
  return trebleTriads.map((trebleKeys, index) => {
    const bassKeys = bassTriads[index];

    if (!bassKeys) {
      throw new Error("Could not find matching bass contrary triad.");
    }

    const prompt: PromptSlot = {
      duration: "q",
      trebleKeys,
      bassKeys,
    };

    if (scaleOctaves === 2) {
      const isWithinTrebleOttavaSpan = isWithinTwoOctaveMiddleSpan(
        direction,
        index,
      );

      if (isWithinTrebleOttavaSpan) {
        prompt.displayedTrebleKeys = trebleKeys.map((key) =>
          shiftKeyByOctaves(key, -1),
        );
        prompt.trebleOttavaActive = true;
      }

      prompt.trebleOttavaStart = direction === "ascending" && index === 3;
      prompt.trebleOttavaEnd = direction === "descending" && index === 2;
    }

    return prompt;
  });
}

function createTriadPrompt(
  trebleKeys: string[],
  bassKeys: string[],
  scaleOctaves: GenerationSettings["scaleOctaves"],
  direction: "ascending" | "descending",
  index: number,
): PromptSlot {
  if (scaleOctaves === 1) {
    return {
      duration: "q",
      trebleKeys,
      bassKeys,
    };
  }

  const isWithinTrebleOttavaSpan = isWithinTwoOctaveMiddleSpan(
    direction,
    index,
  );
  const displayedTrebleKeys = isWithinTrebleOttavaSpan
    ? trebleKeys.map((key) => shiftKeyByOctaves(key, -1))
    : undefined;
  const bassDisplayedClef = isWithinTrebleOttavaSpan ? "treble" : "bass";

  return {
    duration: "q",
    trebleKeys,
    bassKeys,
    displayedTrebleKeys,
    trebleOttavaActive: isWithinTrebleOttavaSpan || undefined,
    bassDisplayedClef,
    trebleOttavaStart: direction === "ascending" && index === 3,
    trebleOttavaEnd: direction === "descending" && index === 2,
  };
}

function getDescendingContraryBassTriadPositions(
  generationSettings: GenerationSettings,
  sharedStartingOctave: number,
) {
  const triadNoteNames = getTriadNoteNames(
    generationSettings.tonic,
    generationSettings.triadType,
    generationSettings.renderingPreference,
  );
  const [rootNoteName, thirdNoteName, fifthNoteName] = triadNoteNames;

  if (!rootNoteName || !thirdNoteName || !fifthNoteName) {
    throw new Error("Could not determine contrary triad note names.");
  }

  const descendingTopKeys = getAscendingArpeggioTopKeys(
    rootNoteName,
    thirdNoteName,
    fifthNoteName,
    sharedStartingOctave - generationSettings.scaleOctaves,
    generationSettings.scaleOctaves,
  ).reverse();

  return descendingTopKeys.map((highestKey) =>
    createDescendingTriadFromHighestKey(
      highestKey,
      rootNoteName,
      thirdNoteName,
      fifthNoteName,
    ),
  );
}

function getAscendingArpeggioTopKeys(
  rootNoteName: string,
  thirdNoteName: string,
  fifthNoteName: string,
  startingOctave: number,
  scaleOctaves: GenerationSettings["scaleOctaves"],
) {
  const ascendingKeys: string[] = [];

  for (let octaveIndex = 0; octaveIndex <= scaleOctaves; octaveIndex += 1) {
    const rootKey = `${rootNoteName}/${startingOctave + octaveIndex}`;
    ascendingKeys.push(rootKey);

    if (octaveIndex === scaleOctaves) {
      continue;
    }

    const rootMidiNoteNumber = keyToMidiNoteNumber(rootKey);
    ascendingKeys.push(
      findNextTriadKeyAtOrAbove(thirdNoteName, rootMidiNoteNumber),
    );
    ascendingKeys.push(
      findNextTriadKeyAtOrAbove(fifthNoteName, rootMidiNoteNumber),
    );
  }

  return ascendingKeys;
}

function createDescendingTriadFromHighestKey(
  highestKey: string,
  rootNoteName: string,
  thirdNoteName: string,
  fifthNoteName: string,
) {
  const [highestNoteName] = highestKey.split("/");

  if (!highestNoteName) {
    throw new Error("Could not determine contrary triad top note name.");
  }

  const lowerNoteNamesDescending =
    highestNoteName === rootNoteName
      ? [fifthNoteName, thirdNoteName]
      : highestNoteName === thirdNoteName
        ? [rootNoteName, fifthNoteName]
        : highestNoteName === fifthNoteName
          ? [thirdNoteName, rootNoteName]
          : null;

  if (!lowerNoteNamesDescending) {
    throw new Error("Could not determine contrary triad inversion.");
  }

  const topMidiNoteNumber = keyToMidiNoteNumber(highestKey);
  const upperLowerKey = findPreviousTriadKeyAtOrBelow(
    lowerNoteNamesDescending[0],
    topMidiNoteNumber - 1,
  );
  const lowerKey = findPreviousTriadKeyAtOrBelow(
    lowerNoteNamesDescending[1],
    keyToMidiNoteNumber(upperLowerKey) - 1,
  );

  return [lowerKey, upperLowerKey, highestKey];
}

function getDescendingTrebleTriadStartingOctave(
  generationSettings: GenerationSettings,
) {
  const [rootNoteName] = getTriadNoteNames(
    generationSettings.tonic,
    generationSettings.triadType,
    generationSettings.renderingPreference,
  );

  if (!rootNoteName) {
    throw new Error("Could not determine descending treble triad root.");
  }

  const highestDisplayedStartMidiNote = 78; // F#5
  const trebleOttavaOffset = 12;
  const candidateTopRootMidiNote = keyToMidiNoteNumber(`${rootNoteName}/6`);
  const topRootOctave =
    candidateTopRootMidiNote - trebleOttavaOffset <=
    highestDisplayedStartMidiNote
      ? 6
      : 5;

  return topRootOctave - generationSettings.scaleOctaves;
}

function getDescendingBassTriadStartingOctave(
  generationSettings: GenerationSettings,
) {
  const triadNoteNames = getTriadNoteNames(
    generationSettings.tonic,
    generationSettings.triadType,
    generationSettings.renderingPreference,
  );
  const [rootNoteName, thirdNoteName, fifthNoteName] = triadNoteNames;

  if (!rootNoteName || !thirdNoteName || !fifthNoteName) {
    throw new Error("Could not determine descending bass triad note names.");
  }

  const rootPositionAtMiddleC = createRootPositionTriad(
    rootNoteName,
    thirdNoteName,
    fifthNoteName,
    4,
  );
  const highestBassStartMidiNote = 66; // F#4
  const topRootOctave = rootPositionAtMiddleC.every(
    (key) => keyToMidiNoteNumber(key) <= highestBassStartMidiNote,
  )
    ? 4
    : 3;

  return topRootOctave - generationSettings.scaleOctaves;
}

function createRootPositionTriad(
  rootNoteName: string,
  thirdNoteName: string,
  fifthNoteName: string,
  rootOctave: number,
) {
  const rootKey = `${rootNoteName}/${rootOctave}`;
  const rootMidiNoteNumber = keyToMidiNoteNumber(rootKey);

  return [rootNoteName, thirdNoteName, fifthNoteName].map((noteName) =>
    findNextTriadKeyAtOrAbove(noteName, rootMidiNoteNumber),
  );
}

function findPreviousTriadKeyAtOrBelow(
  noteName: string,
  maximumMidiNoteNumber: number,
) {
  let octave = Math.floor(maximumMidiNoteNumber / 12) - 1;
  let key = `${noteName}/${octave}`;
  let midiNoteNumber = keyToMidiNoteNumber(key);

  while (midiNoteNumber > maximumMidiNoteNumber) {
    octave -= 1;
    key = `${noteName}/${octave}`;
    midiNoteNumber = keyToMidiNoteNumber(key);
  }

  return key;
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

function applyTrebleOttavaToHighSingleHandTriadPrompts(
  promptQueue: PromptSlot[],
) {
  const trebleOttavaThresholdMidiNote = 82; // A#5
  const ottavaPromptIndices = promptQueue
    .map((prompt, index) =>
      (prompt.trebleKeys ?? []).some(
        (key) => keyToMidiNoteNumber(key) > trebleOttavaThresholdMidiNote,
      )
        ? index
        : -1,
    )
    .filter((index) => index !== -1);

  if (ottavaPromptIndices.length === 0) {
    return;
  }

  const ottavaStartIndex = ottavaPromptIndices[0];
  const ottavaEndIndex = ottavaPromptIndices.at(-1);

  if (ottavaStartIndex === undefined || ottavaEndIndex === undefined) {
    return;
  }

  for (const index of ottavaPromptIndices) {
    const prompt = promptQueue[index];

    if (!prompt?.trebleKeys) {
      continue;
    }

    prompt.displayedTrebleKeys = prompt.trebleKeys.map((key) =>
      shiftKeyByOctaves(key, -1),
    );
    prompt.trebleOttavaActive = true;
  }

  let currentSpanStartIndex = ottavaStartIndex;

  for (
    let indexPosition = 0;
    indexPosition < ottavaPromptIndices.length;
    indexPosition += 1
  ) {
    const currentIndex = ottavaPromptIndices[indexPosition];
    const nextIndex = ottavaPromptIndices[indexPosition + 1];
    const isSpanEnd = nextIndex === undefined || nextIndex !== currentIndex + 1;

    if (!isSpanEnd) {
      continue;
    }

    const startPrompt = promptQueue[currentSpanStartIndex];
    const endPrompt = promptQueue[currentIndex];

    if (startPrompt) {
      startPrompt.trebleOttavaStart = true;
    }

    if (endPrompt) {
      endPrompt.trebleOttavaEnd = true;
    }

    currentSpanStartIndex = nextIndex ?? currentSpanStartIndex;
  }
}

function applyBassOttavaToLowTriadPrompts(promptQueue: PromptSlot[]) {
  const bassOttavaThresholdMidiNote = 41; // F2
  const ottavaPromptIndices = promptQueue
    .map((prompt, index) =>
      (prompt.bassKeys ?? []).some(
        (key) => keyToMidiNoteNumber(key) < bassOttavaThresholdMidiNote,
      )
        ? index
        : -1,
    )
    .filter((index) => index !== -1);

  if (ottavaPromptIndices.length === 0) {
    return;
  }

  const ottavaStartIndex = ottavaPromptIndices[0];
  const ottavaEndIndex = ottavaPromptIndices.at(-1);

  if (ottavaStartIndex === undefined || ottavaEndIndex === undefined) {
    return;
  }

  for (const index of ottavaPromptIndices) {
    const prompt = promptQueue[index];

    if (!prompt?.bassKeys) {
      continue;
    }

    prompt.displayedBassKeys = prompt.bassKeys.map((key) =>
      shiftKeyByOctaves(key, 1),
    );
    prompt.bassOttavaActive = true;
  }

  const startPrompt = promptQueue[ottavaStartIndex];
  const endPrompt = promptQueue[ottavaEndIndex];

  if (startPrompt) {
    startPrompt.bassOttavaStart = true;
  }

  if (endPrompt) {
    endPrompt.bassOttavaEnd = true;
  }
}

function isWithinTwoOctaveMiddleSpan(
  direction: "ascending" | "descending",
  index: number,
) {
  if (direction === "ascending") {
    return index >= 3;
  }

  return index <= 2;
}

function shiftKeyByOctaves(key: string, octaveDelta: number) {
  const [noteName, octaveText] = key.split("/");

  if (!noteName || !octaveText) {
    throw new Error(`Invalid key format: ${key}`);
  }

  const octave = Number.parseInt(octaveText, 10);

  if (Number.isNaN(octave)) {
    throw new Error(`Invalid octave in key: ${key}`);
  }

  return `${noteName}/${octave + octaveDelta}`;
}
