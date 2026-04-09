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

  it("creates contrary-motion together-hand arpeggios from a shared start and returns inward", () => {
    const queue = createArpeggioPracticeQueue(
      createArpeggioSettings({
        scaleHands: "together",
        scaleMotion: "contrary",
      }),
    );

    expect(queue).toEqual([
      { duration: "q", trebleKeys: ["c/4"], bassKeys: ["c/4"] },
      { duration: "q", trebleKeys: ["e/4"], bassKeys: ["g/3"] },
      { duration: "q", trebleKeys: ["g/4"], bassKeys: ["e/3"] },
      { duration: "q", trebleKeys: ["c/5"], bassKeys: ["c/3"] },
      { duration: "q", trebleKeys: ["g/4"], bassKeys: ["e/3"] },
      { duration: "q", trebleKeys: ["e/4"], bassKeys: ["g/3"] },
    ]);
  });

  it("creates a descending treble arpeggio from a comfortable top note and returns upward", () => {
    const queue = createArpeggioPracticeQueue(
      createArpeggioSettings({
        scaleDirection: "descending",
      }),
    );

    expect(queue.map((prompt) => prompt.trebleKeys?.[0] ?? null)).toEqual([
      "c/6",
      "g/5",
      "e/5",
      "c/5",
      "e/5",
      "g/5",
    ]);
  });

  it("creates a descending bass arpeggio from a comfortable top note and returns upward", () => {
    const queue = createArpeggioPracticeQueue(
      createArpeggioSettings({
        scaleHands: "bass",
        scaleDirection: "descending",
      }),
    );

    expect(queue.map((prompt) => prompt.bassKeys?.[0] ?? null)).toEqual([
      "c/4",
      "g/3",
      "e/3",
      "c/3",
      "e/3",
      "g/3",
    ]);
  });

  it("keeps the shared start intact for B major shown as Cb major in contrary motion", () => {
    const queue = createArpeggioPracticeQueue(
      createArpeggioSettings({
        scaleHands: "together",
        scaleMotion: "contrary",
        tonic: "B",
        triadType: "major",
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
      trebleKeys: ["eb/4"],
      bassKeys: ["gb/3"],
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

  it("creates diminished arpeggios with the expected minor third and flat fifth", () => {
    const queue = createArpeggioPracticeQueue(
      createArpeggioSettings({
        triadType: "diminished",
      }),
    );

    expect(queue.map((prompt) => prompt.trebleKeys?.[0] ?? null)).toEqual([
      "c/4",
      "eb/4",
      "gb/4",
      "c/5",
      "gb/4",
      "eb/4",
    ]);
  });

  it("creates augmented arpeggios with the expected major third and raised fifth", () => {
    const queue = createArpeggioPracticeQueue(
      createArpeggioSettings({
        triadType: "augmented",
      }),
    );

    expect(queue.map((prompt) => prompt.trebleKeys?.[0] ?? null)).toEqual([
      "c/4",
      "e/4",
      "g#/4",
      "c/5",
      "g#/4",
      "e/4",
    ]);
  });
});
