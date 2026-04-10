import { describe, expect, it } from "vitest";

import { createArpeggioPracticeQueue } from "../../exercises/arpeggios";
import { createCadencePracticeQueue } from "../../exercises/cadences";
import { createScalePracticeQueue } from "../../exercises/scales";
import { createTriadPracticeQueue } from "../../exercises/triads";
import type { PromptSlot } from "../../exercises/types";
import {
  type GenerationSettings,
  getAllTonics,
  getCadenceRenderingOptions,
  getScaleNoteNamesForRenderedTonicName,
  getScaleRenderingOptions,
  getTriadNoteNames,
  getTriadRenderingOptions,
  type RenderingPreference,
  type ScaleDirection,
  type ScaleHands,
  type ScaleMotion,
  type ScaleOctaves,
  type ScaleType,
  type Tonic,
  type TriadType,
} from "../../theory/music";

const SCALE_TYPES: ScaleType[] = [
  "major",
  "natural-minor",
  "harmonic-minor",
  "melodic-minor",
];
const TRIAD_TYPES: TriadType[] = ["major", "minor", "diminished", "augmented"];
const CADENCE_TRIAD_TYPES: TriadType[] = ["major", "minor"];
const SCALE_HANDS: ScaleHands[] = ["treble", "bass", "together"];
const SCALE_DIRECTIONS: ScaleDirection[] = ["ascending", "descending"];
const SCALE_MOTIONS: ScaleMotion[] = ["parallel", "contrary"];
const SCALE_OCTAVES: ScaleOctaves[] = [1, 2];

function createGenerationSettings(
  overrides: Partial<GenerationSettings> = {},
): GenerationSettings {
  return {
    practiceMode: "scales",
    scaleHands: "together",
    scaleOctaves: 2,
    scaleMotion: "parallel",
    scaleDirection: "ascending",
    tonic: "C",
    scaleType: "major",
    triadType: "major",
    renderingPreference: "preferred",
    ...overrides,
  };
}

function getPromptNoteNames(promptQueue: PromptSlot[]) {
  return promptQueue
    .flatMap((prompt) => [
      ...(prompt.trebleKeys ?? []),
      ...(prompt.bassKeys ?? []),
    ])
    .map((key) => key.split("/")[0] ?? "");
}

function getUnexpectedNoteNames(
  actualNoteNames: string[],
  allowedNoteNames: Iterable<string>,
) {
  const allowed = new Set(allowedNoteNames);

  return Array.from(
    new Set(actualNoteNames.filter((noteName) => !allowed.has(noteName))),
  ).sort();
}

function getAllowedScaleExerciseNoteNames(tonic: Tonic, scaleType: ScaleType) {
  const renderedTonic = getScaleRenderingOptions(
    createGenerationSettings({
      tonic,
      scaleType,
    }),
  ).active.tonic.toLowerCase();

  return getAllowedScaleExerciseNoteNamesForRenderedTonic(
    renderedTonic,
    scaleType,
  );
}

function getAllowedScaleExerciseNoteNamesForRenderedTonic(
  renderedTonic: string,
  scaleType: ScaleType,
) {
  if (scaleType !== "melodic-minor") {
    return getScaleNoteNamesForRenderedTonicName(renderedTonic, scaleType);
  }

  return new Set([
    ...getScaleNoteNamesForRenderedTonicName(renderedTonic, "melodic-minor"),
    ...getScaleNoteNamesForRenderedTonicName(renderedTonic, "natural-minor"),
  ]);
}

function getAllowedScaleExerciseNoteNamesForSettings(
  generationSettings: GenerationSettings,
) {
  const renderedTonic =
    getScaleRenderingOptions(generationSettings).active.tonic.toLowerCase();

  return getAllowedScaleExerciseNoteNamesForRenderedTonic(
    renderedTonic,
    generationSettings.scaleType,
  );
}

function getAllowedNoteNamesForSettings(
  generationSettings: GenerationSettings,
) {
  if (generationSettings.practiceMode === "scales") {
    return getAllowedScaleExerciseNoteNamesForSettings(generationSettings);
  }

  if (
    generationSettings.practiceMode === "triads" ||
    generationSettings.practiceMode === "arpeggios"
  ) {
    return getTriadNoteNames(
      generationSettings.tonic,
      generationSettings.triadType,
      generationSettings.renderingPreference,
    );
  }

  const renderedTonic =
    getCadenceRenderingOptions(generationSettings).active.tonic.toLowerCase();

  return generationSettings.triadType === "major"
    ? getScaleNoteNamesForRenderedTonicName(renderedTonic, "major")
    : new Set([
        ...getScaleNoteNamesForRenderedTonicName(
          renderedTonic,
          "natural-minor",
        ),
        ...getScaleNoteNamesForRenderedTonicName(
          renderedTonic,
          "harmonic-minor",
        ),
      ]);
}

function createPromptQueueForSettings(generationSettings: GenerationSettings) {
  if (generationSettings.practiceMode === "scales") {
    return createScalePracticeQueue(generationSettings);
  }

  if (generationSettings.practiceMode === "triads") {
    return createTriadPracticeQueue(generationSettings);
  }

  if (generationSettings.practiceMode === "arpeggios") {
    return createArpeggioPracticeQueue(generationSettings);
  }

  return createCadencePracticeQueue(generationSettings);
}

function hasAlternateRenderingOption(generationSettings: GenerationSettings) {
  if (generationSettings.practiceMode === "scales") {
    return Boolean(getScaleRenderingOptions(generationSettings).alternate);
  }

  if (
    generationSettings.practiceMode === "triads" ||
    generationSettings.practiceMode === "arpeggios"
  ) {
    return Boolean(getTriadRenderingOptions(generationSettings).alternate);
  }

  return Boolean(getCadenceRenderingOptions(generationSettings).alternate);
}

function formatSettingsLabel(generationSettings: GenerationSettings) {
  if (generationSettings.practiceMode === "cadences") {
    return [
      generationSettings.practiceMode,
      generationSettings.tonic,
      generationSettings.triadType,
      generationSettings.scaleHands,
      generationSettings.scaleOctaves,
      generationSettings.scaleMotion,
      generationSettings.scaleDirection,
      generationSettings.renderingPreference,
    ].join(" | ");
  }

  if (generationSettings.practiceMode === "scales") {
    return [
      generationSettings.practiceMode,
      generationSettings.tonic,
      generationSettings.scaleType,
      generationSettings.scaleHands,
      generationSettings.scaleOctaves,
      generationSettings.scaleMotion,
      generationSettings.scaleDirection,
      generationSettings.renderingPreference,
    ].join(" | ");
  }

  return [
    generationSettings.practiceMode,
    generationSettings.tonic,
    generationSettings.triadType,
    generationSettings.scaleHands,
    generationSettings.scaleOctaves,
    generationSettings.scaleMotion,
    generationSettings.scaleDirection,
    generationSettings.renderingPreference,
  ].join(" | ");
}

function forEachExercisePermutation(
  renderingPreference: RenderingPreference,
  visit: (generationSettings: GenerationSettings) => void,
) {
  for (const tonic of getAllTonics()) {
    for (const scaleType of SCALE_TYPES) {
      for (const scaleHands of SCALE_HANDS) {
        for (const scaleOctaves of SCALE_OCTAVES) {
          for (const scaleDirection of SCALE_DIRECTIONS) {
            for (const scaleMotion of SCALE_MOTIONS) {
              visit(
                createGenerationSettings({
                  practiceMode: "scales",
                  tonic,
                  scaleType,
                  scaleHands,
                  scaleOctaves,
                  scaleDirection,
                  scaleMotion,
                  renderingPreference,
                }),
              );
            }
          }
        }
      }
    }

    for (const triadType of TRIAD_TYPES) {
      for (const scaleHands of SCALE_HANDS) {
        for (const scaleOctaves of SCALE_OCTAVES) {
          for (const scaleDirection of SCALE_DIRECTIONS) {
            for (const scaleMotion of SCALE_MOTIONS) {
              visit(
                createGenerationSettings({
                  practiceMode: "triads",
                  tonic,
                  triadType,
                  scaleHands,
                  scaleOctaves,
                  scaleDirection,
                  scaleMotion,
                  renderingPreference,
                }),
              );
              visit(
                createGenerationSettings({
                  practiceMode: "arpeggios",
                  tonic,
                  triadType,
                  scaleHands,
                  scaleOctaves,
                  scaleDirection,
                  scaleMotion,
                  renderingPreference,
                }),
              );
            }
          }
        }
      }
    }

    for (const triadType of CADENCE_TRIAD_TYPES) {
      for (const scaleHands of SCALE_HANDS) {
        for (const scaleOctaves of SCALE_OCTAVES) {
          for (const scaleDirection of SCALE_DIRECTIONS) {
            for (const scaleMotion of SCALE_MOTIONS) {
              visit(
                createGenerationSettings({
                  practiceMode: "cadences",
                  tonic,
                  triadType,
                  scaleHands,
                  scaleOctaves,
                  scaleDirection,
                  scaleMotion,
                  renderingPreference,
                }),
              );
            }
          }
        }
      }
    }
  }
}

function collectRenderingConsistencyLeaks(
  renderingPreference: RenderingPreference,
) {
  const leaks: string[] = [];

  forEachExercisePermutation(renderingPreference, (generationSettings) => {
    if (
      renderingPreference === "alternate" &&
      !hasAlternateRenderingOption(generationSettings)
    ) {
      return;
    }

    const allowedNoteNames = getAllowedNoteNamesForSettings(generationSettings);
    const actualNoteNames = getPromptNoteNames(
      createPromptQueueForSettings(generationSettings),
    );
    const unexpectedNoteNames = getUnexpectedNoteNames(
      actualNoteNames,
      allowedNoteNames,
    );

    if (unexpectedNoteNames.length > 0) {
      leaks.push(
        `${formatSettingsLabel(generationSettings)}: ${unexpectedNoteNames.join(", ")}`,
      );
    }
  });

  return leaks;
}

describe("exercise rendering consistency", () => {
  it("keeps every preferred rendered exercise inside its chosen spelling across all valid permutations", () => {
    expect(collectRenderingConsistencyLeaks("preferred")).toEqual([]);
  });

  it("keeps every alternate rendered exercise inside its alternate spelling across all valid permutations", () => {
    expect(collectRenderingConsistencyLeaks("alternate")).toEqual([]);
  });
});
