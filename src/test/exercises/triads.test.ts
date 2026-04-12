import { describe, expect, it } from "vitest";
import { createTriadPracticeQueue } from "../../exercises/triads";
import type { GenerationSettings } from "../../theory/music";

function createTriadSettings(
  overrides: Partial<GenerationSettings> = {},
): GenerationSettings {
  return {
    practiceMode: "triads",
    scaleHands: "treble",
    scaleOctaves: 1,
    scaleMotion: "parallel",
    scaleDirection: "ascending",
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

  it("creates a descending one-octave treble triad exercise that starts under ottava and drops it once the triad fits", () => {
    const queue = createTriadPracticeQueue(
      createTriadSettings({
        scaleDirection: "descending",
      }),
    );

    expect(queue).toEqual([
      {
        duration: "q",
        trebleKeys: ["c/6", "e/6", "g/6"],
        displayedTrebleKeys: ["c/5", "e/5", "g/5"],
        trebleOttavaActive: true,
        trebleOttavaStart: true,
      },
      {
        duration: "q",
        trebleKeys: ["g/5", "c/6", "e/6"],
        displayedTrebleKeys: ["g/4", "c/5", "e/5"],
        trebleOttavaActive: true,
      },
      {
        duration: "q",
        trebleKeys: ["e/5", "g/5", "c/6"],
        displayedTrebleKeys: ["e/4", "g/4", "c/5"],
        trebleOttavaActive: true,
        trebleOttavaEnd: true,
      },
      {
        duration: "q",
        trebleKeys: ["c/5", "e/5", "g/5"],
      },
      {
        duration: "q",
        trebleKeys: ["e/5", "g/5", "c/6"],
        displayedTrebleKeys: ["e/4", "g/4", "c/5"],
        trebleOttavaActive: true,
        trebleOttavaStart: true,
      },
      {
        duration: "q",
        trebleKeys: ["g/5", "c/6", "e/6"],
        displayedTrebleKeys: ["g/4", "c/5", "e/5"],
        trebleOttavaActive: true,
        trebleOttavaEnd: true,
      },
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

  it("creates a descending one-octave bass triad exercise that adds bass ottava through the low span", () => {
    const queue = createTriadPracticeQueue(
      createTriadSettings({
        scaleHands: "bass",
        scaleDirection: "descending",
      }),
    );

    expect(queue).toEqual([
      {
        duration: "q",
        bassKeys: ["c/3", "e/3", "g/3"],
      },
      {
        duration: "q",
        bassKeys: ["g/2", "c/3", "e/3"],
      },
      {
        duration: "q",
        bassKeys: ["e/2", "g/2", "c/3"],
        displayedBassKeys: ["e/3", "g/3", "c/4"],
        bassOttavaActive: true,
        bassOttavaStart: true,
      },
      {
        duration: "q",
        bassKeys: ["c/2", "e/2", "g/2"],
        displayedBassKeys: ["c/3", "e/3", "g/3"],
        bassOttavaActive: true,
      },
      {
        duration: "q",
        bassKeys: ["e/2", "g/2", "c/3"],
        displayedBassKeys: ["e/3", "g/3", "c/4"],
        bassOttavaActive: true,
        bassOttavaEnd: true,
      },
      {
        duration: "q",
        bassKeys: ["g/2", "c/3", "e/3"],
      },
    ]);
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

  it("creates contrary-motion together-hand triads from a shared start and returns inward", () => {
    const queue = createTriadPracticeQueue(
      createTriadSettings({
        scaleHands: "together",
        scaleMotion: "contrary",
      }),
    );

    expect(queue).toEqual([
      {
        duration: "q",
        trebleKeys: ["c/4", "e/4", "g/4"],
        bassKeys: ["e/3", "g/3", "c/4"],
      },
      {
        duration: "q",
        trebleKeys: ["e/4", "g/4", "c/5"],
        bassKeys: ["c/3", "e/3", "g/3"],
      },
      {
        duration: "q",
        trebleKeys: ["g/4", "c/5", "e/5"],
        bassKeys: ["g/2", "c/3", "e/3"],
      },
      {
        duration: "q",
        trebleKeys: ["c/5", "e/5", "g/5"],
        bassKeys: ["e/2", "g/2", "c/3"],
        displayedBassKeys: ["e/3", "g/3", "c/4"],
        bassOttavaActive: true,
        bassOttavaStart: true,
        bassOttavaEnd: true,
      },
      {
        duration: "q",
        trebleKeys: ["g/4", "c/5", "e/5"],
        bassKeys: ["g/2", "c/3", "e/3"],
      },
      {
        duration: "q",
        trebleKeys: ["e/4", "g/4", "c/5"],
        bassKeys: ["c/3", "e/3", "g/3"],
      },
    ]);
  });

  it("creates diminished triads with the expected flattened fifth", () => {
    const queue = createTriadPracticeQueue(
      createTriadSettings({
        triadType: "diminished",
      }),
    );

    expect(queue.map((prompt) => prompt.trebleKeys)).toEqual([
      ["c/4", "eb/4", "gb/4"],
      ["eb/4", "gb/4", "c/5"],
      ["gb/4", "c/5", "eb/5"],
      ["c/5", "eb/5", "gb/5"],
      ["gb/4", "c/5", "eb/5"],
      ["eb/4", "gb/4", "c/5"],
    ]);
  });

  it("creates augmented triads with the expected raised fifth", () => {
    const queue = createTriadPracticeQueue(
      createTriadSettings({
        triadType: "augmented",
      }),
    );

    expect(queue.map((prompt) => prompt.trebleKeys)).toEqual([
      ["c/4", "e/4", "g#/4"],
      ["e/4", "g#/4", "c/5"],
      ["g#/4", "c/5", "e/5"],
      ["c/5", "e/5", "g#/5"],
      ["g#/4", "c/5", "e/5"],
      ["e/4", "g#/4", "c/5"],
    ]);
  });
});
