import { describe, expect, it } from "vitest";
import { createArpeggioPracticeQueue } from "../../exercises/arpeggios";
import type { GenerationSettings } from "../../theory/music";

function createArpeggioSettings(
  overrides: Partial<GenerationSettings> = {},
): GenerationSettings {
  return {
    practiceMode: "arpeggios",
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

describe("createArpeggioPracticeQueue", () => {
  it("creates a one-octave arpeggio that climbs and descends without duplicating the apex", () => {
    const queue = createArpeggioPracticeQueue(createArpeggioSettings());

    expect(queue.map((prompt) => prompt.trebleKeys?.[0] ?? null)).toEqual([
      "c/4",
      "e/4",
      "g/4",
      "c/5",
      "g/4",
      "e/4",
      "c/4",
    ]);
  });

  it("creates a two-octave arpeggio with the expected C major pattern", () => {
    const queue = createArpeggioPracticeQueue(
      createArpeggioSettings({
        scaleOctaves: 2,
      }),
    );

    expect(queue.map((prompt) => prompt.trebleKeys?.[0] ?? null)).toEqual([
      "c/4",
      "e/4",
      "g/4",
      "c/5",
      "e/5",
      "g/5",
      "c/6",
      "g/5",
      "e/5",
      "c/5",
      "g/4",
      "e/4",
      "c/4",
    ]);
  });

  it("keeps together-hand arpeggios one octave apart in actual pitches", () => {
    const queue = createArpeggioPracticeQueue(
      createArpeggioSettings({
        scaleHands: "together",
      }),
    );

    expect(queue[0]).toEqual({
      duration: "q",
      trebleKeys: ["c/4"],
      bassKeys: ["c/3"],
    });
    expect(queue[3]).toEqual({
      duration: "q",
      trebleKeys: ["c/5"],
      bassKeys: ["c/4"],
    });
  });

  it("uses the rendered tonic spelling for minor arpeggios", () => {
    const queue = createArpeggioPracticeQueue(
      createArpeggioSettings({
        tonic: "Ab",
        triadType: "minor",
      }),
    );

    expect(queue[0]?.trebleKeys).toEqual(["g#/3"]);
    expect(queue[1]?.trebleKeys).toEqual(["b/3"]);
    expect(queue[2]?.trebleKeys).toEqual(["d#/4"]);
  });
});
