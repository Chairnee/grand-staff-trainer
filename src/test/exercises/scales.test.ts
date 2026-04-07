import { describe, expect, it } from "vitest";

import type { GenerationSettings } from "../../theory/music";
import { createScalePracticeQueue } from "../../exercises/scales";

function createScaleSettings(
  overrides: Partial<GenerationSettings> = {},
): GenerationSettings {
  return {
    practiceMode: "scales",
    scaleHands: "treble",
    scaleOctaves: 1,
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

describe("createScalePracticeQueue", () => {
  it("creates a one-octave treble scale that ascends and descends smoothly", () => {
    const queue = createScalePracticeQueue(createScaleSettings());

    expect(queue).toHaveLength(14);
    expect(queue.map((prompt) => prompt.trebleKeys?.[0] ?? null)).toEqual([
      "c/4",
      "d/4",
      "e/4",
      "f/4",
      "g/4",
      "a/4",
      "b/4",
      "c/5",
      "b/4",
      "a/4",
      "g/4",
      "f/4",
      "e/4",
      "d/4",
    ]);
  });

  it("creates together-hand prompts one octave apart", () => {
    const queue = createScalePracticeQueue(
      createScaleSettings({
        scaleHands: "together",
      }),
    );

    expect(queue[0]).toEqual({
      duration: "q",
      trebleKeys: ["c/4"],
      bassKeys: ["c/3"],
    });
    expect(queue[7]).toEqual({
      duration: "q",
      trebleKeys: ["c/5"],
      bassKeys: ["c/4"],
    });
  });
});
