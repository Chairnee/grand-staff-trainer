import { describe, expect, it } from "vitest";

import type { GenerationSettings } from "../music";
import { createTriadPracticeQueue } from "./triads";

function createTriadSettings(
  overrides: Partial<GenerationSettings> = {},
): GenerationSettings {
  return {
    practiceMode: "triads",
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

describe("createTriadPracticeQueue", () => {
  it("creates a one-octave treble triad exercise that ascends and descends smoothly", () => {
    const queue = createTriadPracticeQueue(createTriadSettings());

    expect(queue).toHaveLength(6);
    expect(queue.map((prompt) => prompt.trebleKeys)).toEqual([
      ["c/4", "e/4", "g/4"],
      ["e/4", "g/4", "c/5"],
      ["g/4", "c/5", "e/5"],
      ["c/5", "e/5", "g/5"],
      ["g/4", "c/5", "e/5"],
      ["e/4", "g/4", "c/5"],
    ]);
  });

  it("creates a two-octave treble triad exercise with an ottava display span", () => {
    const queue = createTriadPracticeQueue(
      createTriadSettings({
        scaleOctaves: 2,
      }),
    );

    expect(queue).toHaveLength(12);
    expect(queue.filter((prompt) => prompt.trebleOttavaStart)).toHaveLength(1);
    expect(queue.filter((prompt) => prompt.trebleOttavaEnd)).toHaveLength(1);
    expect(queue[3]).toMatchObject({
      trebleKeys: ["c/5", "e/5", "g/5"],
      displayedTrebleKeys: ["c/4", "e/4", "g/4"],
      trebleOttavaStart: true,
    });
    expect(queue[7]).toMatchObject({
      trebleKeys: ["g/5", "c/6", "e/6"],
      displayedTrebleKeys: ["g/4", "c/5", "e/5"],
    });
    expect(queue[8]).toMatchObject({
      trebleKeys: ["e/5", "g/5", "c/6"],
      displayedTrebleKeys: ["e/4", "g/4", "c/5"],
    });
    expect(queue[9]).toMatchObject({
      trebleKeys: ["c/5", "e/5", "g/5"],
      displayedTrebleKeys: ["c/4", "e/4", "g/4"],
      trebleOttavaEnd: true,
    });
  });

  it("marks the lower staff middle span in treble clef for two-octave triads", () => {
    const queue = createTriadPracticeQueue(
      createTriadSettings({
        scaleHands: "bass",
        scaleOctaves: 2,
      }),
    );

    expect(queue[2]?.bassDisplayedClef).toBe("bass");
    expect(queue[3]?.bassDisplayedClef).toBe("treble");
    expect(queue[9]?.bassDisplayedClef).toBe("treble");
    expect(queue[10]?.bassDisplayedClef).toBe("bass");
  });

  it("keeps together-hand triad prompts one octave apart", () => {
    const queue = createTriadPracticeQueue(
      createTriadSettings({
        scaleHands: "together",
      }),
    );

    expect(queue[0]).toEqual({
      duration: "q",
      trebleKeys: ["c/4", "e/4", "g/4"],
      bassKeys: ["c/3", "e/3", "g/3"],
    });
  });
});
