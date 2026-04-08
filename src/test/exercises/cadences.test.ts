import { describe, expect, it } from "vitest";

import type { GenerationSettings } from "../../theory/music";
import { createCadencePracticeQueue } from "../../exercises/cadences";

function createCadenceSettings(
  overrides: Partial<GenerationSettings> = {},
): GenerationSettings {
  return {
    practiceMode: "cadences",
    scaleHands: "treble",
    scaleOctaves: 1,
    scaleMotion: "parallel",
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

describe("createCadencePracticeQueue", () => {
  it("creates one full cadence cycle per inversion", () => {
    const queue = createCadencePracticeQueue(createCadenceSettings());

    expect(queue).toHaveLength(15);
    expect(queue.map((prompt) => prompt.trebleKeys)).toEqual([
      ["c/4", "e/4", "g/4"],
      ["c/4", "f/4", "a/4"],
      ["c/4", "e/4", "g/4"],
      ["b/3", "d/4", "g/4"],
      ["c/4", "e/4", "g/4"],
      ["e/4", "g/4", "c/5"],
      ["f/4", "a/4", "c/5"],
      ["e/4", "g/4", "c/5"],
      ["d/4", "g/4", "b/4"],
      ["e/4", "g/4", "c/5"],
      ["g/4", "c/5", "e/5"],
      ["a/4", "c/5", "f/5"],
      ["g/4", "c/5", "e/5"],
      ["g/4", "b/4", "d/5"],
      ["g/4", "c/5", "e/5"],
    ]);
  });

  it("keeps together-hand cadences one octave apart", () => {
    const queue = createCadencePracticeQueue(
      createCadenceSettings({
        scaleHands: "together",
      }),
    );

    expect(queue[0]).toEqual({
      duration: "q",
      trebleKeys: ["c/4", "e/4", "g/4"],
      bassKeys: ["c/3", "e/3", "g/3"],
    });
    expect(queue[3]).toEqual({
      duration: "q",
      trebleKeys: ["b/3", "d/4", "g/4"],
      bassKeys: ["b/2", "d/3", "g/3"],
    });
  });

  it("uses a raised leading tone for the dominant chord in minor cadences", () => {
    const queue = createCadencePracticeQueue(
      createCadenceSettings({
        tonic: "A",
        triadType: "minor",
      }),
    );

    expect(queue[0]?.trebleKeys).toEqual(["a/3", "c/4", "e/4"]);
    expect(queue[3]?.trebleKeys).toEqual(["g#/3", "b/3", "e/4"]);
  });
});
