import { describe, expect, it } from "vitest";
import { createCadencePracticeQueue } from "../../exercises/cadences";
import type { GenerationSettings } from "../../theory/music";

function createCadenceSettings(
  overrides: Partial<GenerationSettings> = {},
): GenerationSettings {
  return {
    practiceMode: "cadences",
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

describe("createCadencePracticeQueue", () => {
  it("creates one full cadence cycle per inversion", () => {
    const queue = createCadencePracticeQueue(createCadenceSettings());

    expect(queue).toHaveLength(18);
    expect(queue.map((prompt) => prompt.trebleKeys ?? null)).toEqual([
      ["c/4", "e/4", "g/4"],
      ["c/4", "f/4", "a/4"],
      ["c/4", "e/4", "g/4"],
      ["b/3", "d/4", "g/4"],
      ["c/4", "e/4", "g/4"],
      null,
      ["e/4", "g/4", "c/5"],
      ["f/4", "a/4", "c/5"],
      ["e/4", "g/4", "c/5"],
      ["d/4", "g/4", "b/4"],
      ["e/4", "g/4", "c/5"],
      null,
      ["g/4", "c/5", "e/5"],
      ["a/4", "c/5", "f/5"],
      ["g/4", "c/5", "e/5"],
      ["g/4", "b/4", "d/5"],
      ["g/4", "c/5", "e/5"],
      null,
    ]);
    expect(
      queue.map((prompt) => prompt.annotations?.[0]?.text ?? null),
    ).toEqual([
      "I",
      "IV",
      "I",
      "V",
      "I",
      null,
      "I",
      "IV",
      "I",
      "V",
      "I",
      null,
      "I",
      "IV",
      "I",
      "V",
      "I",
      null,
    ]);
    expect(queue.map((prompt) => prompt.duration)).toEqual([
      "q",
      "q",
      "q",
      "q",
      "h",
      "h",
      "q",
      "q",
      "q",
      "q",
      "h",
      "h",
      "q",
      "q",
      "q",
      "q",
      "h",
      "h",
    ]);
    expect(queue[5]).toEqual({
      duration: "h",
      isPlayable: false,
      trebleRestVisible: true,
      bassRestVisible: false,
    });
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
      annotations: [
        {
          staff: "treble",
          placement: "above",
          text: "I",
        },
      ],
    });
    expect(queue[3]).toEqual({
      duration: "q",
      trebleKeys: ["b/3", "d/4", "g/4"],
      bassKeys: ["b/2", "d/3", "g/3"],
      annotations: [
        {
          staff: "treble",
          placement: "above",
          text: "V",
        },
      ],
    });
    expect(queue[4]).toEqual({
      duration: "h",
      trebleKeys: ["c/4", "e/4", "g/4"],
      bassKeys: ["c/3", "e/3", "g/3"],
      annotations: [
        {
          staff: "treble",
          placement: "above",
          text: "I",
        },
      ],
    });
    expect(queue[5]).toEqual({
      duration: "h",
      isPlayable: false,
      trebleRestVisible: true,
      bassRestVisible: true,
    });
  });

  it("keeps the last bass cadence cycle in bass clef when the second cycle closes at or below E#4", () => {
    const queue = createCadencePracticeQueue(
      createCadenceSettings({
        tonic: "C",
        scaleHands: "together",
      }),
    );

    expect(queue[10]?.bassDisplayedClef).toBeUndefined();
    expect(queue[16]?.bassKeys).toEqual(["g/3", "c/4", "e/4"]);
    expect(queue[16]?.bassDisplayedClef).toBeUndefined();
  });

  it("keeps D major in bass clef when the second cycle closes below the rephrasing threshold", () => {
    const queue = createCadencePracticeQueue(
      createCadenceSettings({
        tonic: "D",
        scaleHands: "together",
      }),
    );

    expect(queue[16]?.bassKeys).toEqual(["a/3", "d/4", "f#/4"]);
    expect(queue[16]?.bassDisplayedClef).toBeUndefined();
  });

  it("keeps E major in bass clef when the second cycle closes at E4", () => {
    const queue = createCadencePracticeQueue(
      createCadenceSettings({
        tonic: "E",
        scaleHands: "together",
      }),
    );

    expect(queue[10]?.bassKeys).toEqual(["g#/3", "b/3", "e/4"]);
    expect(queue[12]?.bassDisplayedClef).toBeUndefined();
    expect(queue[16]?.bassDisplayedClef).toBeUndefined();
  });

  it("rephrases the last bass cadence cycle into treble clef when the second cycle closes above E#4", () => {
    const queue = createCadencePracticeQueue(
      createCadenceSettings({
        tonic: "F",
        scaleHands: "together",
      }),
    );

    expect(queue[12]?.bassDisplayedClef).toBe("treble");
    expect(queue[16]?.bassKeys).toEqual(["c/4", "f/4", "a/4"]);
    expect(queue[16]?.bassDisplayedClef).toBe("treble");
  });

  it("places cadence annotations on the visible staff", () => {
    const trebleQueue = createCadencePracticeQueue(
      createCadenceSettings({
        scaleHands: "treble",
      }),
    );
    const bassQueue = createCadencePracticeQueue(
      createCadenceSettings({
        scaleHands: "bass",
      }),
    );

    expect(trebleQueue[0]?.annotations).toEqual([
      {
        staff: "treble",
        placement: "above",
        text: "I",
      },
    ]);
    expect(bassQueue[0]?.annotations).toEqual([
      {
        staff: "bass",
        placement: "above",
        text: "I",
      },
    ]);
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

  it("keeps the preferred rendered tonic spelling throughout Ab minor cadences", () => {
    const queue = createCadencePracticeQueue(
      createCadenceSettings({
        tonic: "Ab",
        triadType: "minor",
      }),
    );

    expect(queue[0]?.trebleKeys).toEqual(["g#/4", "b/4", "d#/5"]);
    expect(queue[1]?.trebleKeys).toEqual(["g#/4", "c#/5", "e/5"]);
    expect(queue[3]?.trebleKeys).toContain("f##/4");
    expect(queue[3]?.trebleKeys).toContain("a#/4");
    expect(queue[3]?.trebleKeys).toContain("d#/5");
    expect(
      queue
        .flatMap((prompt) => prompt.trebleKeys ?? [])
        .some((key) => /^[a-g](?:b|bb)\//.test(key)),
    ).toBe(false);
  });
});
