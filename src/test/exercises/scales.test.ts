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

  it("creates contrary-motion together-hand scales from a shared start and returns inward", () => {
    const queue = createScalePracticeQueue(
      createScaleSettings({
        scaleHands: "together",
        scaleMotion: "contrary",
        scaleOctaves: 1,
      }),
    );

    expect(queue).toHaveLength(14);
    expect(queue.slice(0, 8)).toEqual([
      { duration: "q", trebleKeys: ["c/4"], bassKeys: ["c/4"] },
      { duration: "q", trebleKeys: ["d/4"], bassKeys: ["b/3"] },
      { duration: "q", trebleKeys: ["e/4"], bassKeys: ["a/3"] },
      { duration: "q", trebleKeys: ["f/4"], bassKeys: ["g/3"] },
      { duration: "q", trebleKeys: ["g/4"], bassKeys: ["f/3"] },
      { duration: "q", trebleKeys: ["a/4"], bassKeys: ["e/3"] },
      { duration: "q", trebleKeys: ["b/4"], bassKeys: ["d/3"] },
      { duration: "q", trebleKeys: ["c/5"], bassKeys: ["c/3"] },
    ]);
  });

  it("chooses a centered shared start for two-octave contrary motion", () => {
    const queue = createScalePracticeQueue(
      createScaleSettings({
        scaleHands: "together",
        scaleMotion: "contrary",
        scaleOctaves: 2,
      }),
    );

    expect(queue[0]).toEqual({
      duration: "q",
      trebleKeys: ["c/4"],
      bassKeys: ["c/4"],
    });
    expect(queue[14]).toEqual({
      duration: "q",
      trebleKeys: ["c/6"],
      bassKeys: ["c/2"],
    });
  });

  it("keeps the shared start intact for B major shown as Cb major in contrary motion", () => {
    const queue = createScalePracticeQueue(
      createScaleSettings({
        scaleHands: "together",
        scaleMotion: "contrary",
        tonic: "B",
        scaleType: "major",
        renderingPreference: "alternate",
      }),
    );

    expect(queue[0]).toEqual({
      duration: "q",
      trebleKeys: ["cb/4"],
      bassKeys: ["cb/4"],
    });
    expect(queue[1]).toEqual({
      duration: "q",
      trebleKeys: ["db/4"],
      bassKeys: ["bb/3"],
    });
  });

  it("creates a descending treble scale with a comfortable starting note and returns upward", () => {
    const queue = createScalePracticeQueue(
      createScaleSettings({
        scaleDirection: "descending",
      }),
    );

    expect(queue.map((prompt) => prompt.trebleKeys?.[0] ?? null)).toEqual([
      "c/6",
      "b/5",
      "a/5",
      "g/5",
      "f/5",
      "e/5",
      "d/5",
      "c/5",
      "d/5",
      "e/5",
      "f/5",
      "g/5",
      "a/5",
      "b/5",
      "c/6",
    ]);
  });

  it("creates a descending bass scale with a comfortable starting note and returns upward", () => {
    const queue = createScalePracticeQueue(
      createScaleSettings({
        scaleHands: "bass",
        scaleDirection: "descending",
      }),
    );

    expect(queue.map((prompt) => prompt.bassKeys?.[0] ?? null)).toEqual([
      "c/4",
      "b/3",
      "a/3",
      "g/3",
      "f/3",
      "e/3",
      "d/3",
      "c/3",
      "d/3",
      "e/3",
      "f/3",
      "g/3",
      "a/3",
      "b/3",
      "c/4",
    ]);
  });
});
