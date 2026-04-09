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

  applyBassOttavaToLowContraryTriadPrompts(promptQueue);

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
        bassDisplayedClef: undefined,
      };
    }

    if (scaleHands === "bass") {
      return {
        ...prompt,
        trebleKeys: undefined,
        displayedTrebleKeys: undefined,
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

function applyBassOttavaToLowContraryTriadPrompts(promptQueue: PromptSlot[]) {
  const bassOttavaThresholdMidiNote = keyToMidiNoteNumber("f/2");
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
