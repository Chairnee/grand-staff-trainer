import { describe, expect, it } from "vitest";

import { getExerciseNotationProfile } from "../../exercises";
import type { GenerationSettings } from "../../theory/music";

function createGenerationSettings(
  overrides: Partial<GenerationSettings> = {},
): GenerationSettings {
  return {
    practiceMode: "scales",
    scaleHands: "together",
    scaleOctaves: 2,
    scaleMotion: "parallel",
    scaleDirection: "ascending",
    rangeStart: "c/2",
    rangeEnd: "c/6",
    noteSourceMode: "in-scale",
    accidentalSpellingMode: "sharps",
    tonic: "C",
    scaleType: "major",
    triadType: "major",
    renderingPreference: "preferred",
    ...overrides,
  };
}

describe("getExerciseNotationProfile", () => {
  it("returns common-time notation for scales, triads, arpeggios, and cadences", () => {
    expect(
      getExerciseNotationProfile(
        createGenerationSettings({
          practiceMode: "scales",
        }),
      ),
    ).toEqual({
      timeSignature: "C",
      beatsPerMeasure: 4,
    });

    expect(
      getExerciseNotationProfile(
        createGenerationSettings({
          practiceMode: "triads",
        }),
      ),
    ).toEqual({
      timeSignature: "C",
      beatsPerMeasure: 4,
    });

    expect(
      getExerciseNotationProfile(
        createGenerationSettings({
          practiceMode: "arpeggios",
        }),
      ),
    ).toEqual({
      timeSignature: "C",
      beatsPerMeasure: 4,
    });

    expect(
      getExerciseNotationProfile(
        createGenerationSettings({
          practiceMode: "cadences",
        }),
      ),
    ).toEqual({
      timeSignature: "C",
      beatsPerMeasure: 4,
    });
  });
});
