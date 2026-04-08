import { describe, expect, it } from "vitest";

import {
  getCadenceStartingOctave,
  getDescendingScaleStartingOctave,
  getAllTonics,
  type GenerationSettings,
  getAscendingScaleKeys,
  getDerivedKeySignature,
  getHeldOverlayKey,
  getRenderedAccidentalForKey,
  getScaleNoteNames,
  getScaleRenderingNotice,
  getScaleStartingOctave,
  getTonicReadabilityOptionsForScaleType,
  keyToMidiNoteNumber,
} from "../../theory/music";

function createGenerationSettings(
  overrides: Partial<GenerationSettings> = {},
): GenerationSettings {
  return {
    practiceMode: "random-notes",
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

describe("keyToMidiNoteNumber", () => {
  it("converts plain and accidental note names to MIDI numbers", () => {
    expect(keyToMidiNoteNumber("c/4")).toBe(60);
    expect(keyToMidiNoteNumber("bb/3")).toBe(58);
    expect(keyToMidiNoteNumber("cb/4")).toBe(59);
    expect(keyToMidiNoteNumber("e#/4")).toBe(65);
  });
});

describe("getDerivedKeySignature", () => {
  it("derives major and minor key signatures from tonic and scale type", () => {
    expect(
      getDerivedKeySignature(
        createGenerationSettings({
          tonic: "G",
          scaleType: "major",
        }),
      ),
    ).toBe("G");

    expect(
      getDerivedKeySignature(
        createGenerationSettings({
          tonic: "E",
          scaleType: "natural-minor",
        }),
      ),
    ).toBe("G");
  });
});

describe("getAllTonics", () => {
  it("includes the restored supported enharmonic tonic selections", () => {
    expect(getAllTonics()).toEqual(
      expect.arrayContaining(["Cb", "G#", "D#", "A#"]),
    );
  });
});

describe("getScaleNoteNames", () => {
  it("spells F sharp major with the expected sharps", () => {
    expect(getScaleNoteNames("F#", "major")).toEqual([
      "f#",
      "g#",
      "a#",
      "b",
      "c#",
      "d#",
      "e#",
    ]);
  });

  it("spells B flat harmonic minor with the raised seventh", () => {
    expect(getScaleNoteNames("Bb", "harmonic-minor")).toEqual([
      "bb",
      "c",
      "db",
      "eb",
      "f",
      "gb",
      "a",
    ]);
  });

  it("renders rare flat-minor spellings as practical sharp minors", () => {
    expect(getScaleNoteNames("Gb", "natural-minor")).toEqual([
      "f#",
      "g#",
      "a",
      "b",
      "c#",
      "d",
      "e",
    ]);
  });

  it("renders rare sharp-major spellings as practical flat majors", () => {
    expect(getScaleNoteNames("G#", "major")).toEqual([
      "ab",
      "bb",
      "c",
      "db",
      "eb",
      "f",
      "g",
    ]);
  });

  it("prefers the lower-cost enharmonic for natural minor spellings", () => {
    expect(getScaleNoteNames("Ab", "natural-minor")).toEqual([
      "g#",
      "a#",
      "b",
      "c#",
      "d#",
      "e",
      "f#",
    ]);
  });

  it("still weighs total accidental burden when comparing harmonic minor enharmonics", () => {
    expect(getScaleNoteNames("Ab", "harmonic-minor")).toEqual([
      "ab",
      "bb",
      "cb",
      "db",
      "eb",
      "fb",
      "g",
    ]);
  });

  it("keeps D flat and G flat major in their conventional spellings", () => {
    expect(getScaleNoteNames("Db", "major")).toEqual([
      "db",
      "eb",
      "f",
      "gb",
      "ab",
      "bb",
      "c",
    ]);

    expect(getScaleNoteNames("Gb", "major")).toEqual([
      "gb",
      "ab",
      "bb",
      "cb",
      "db",
      "eb",
      "f",
    ]);
  });
});

describe("getRenderedAccidentalForKey", () => {
  it("suppresses accidentals implied by the key signature", () => {
    expect(getRenderedAccidentalForKey("bb/3", "Ab")).toBeNull();
  });

  it("shows a natural sign when the key signature implies a flat", () => {
    expect(getRenderedAccidentalForKey("b/3", "Ab")).toBe("n");
  });
});

describe("getHeldOverlayKey", () => {
  it("reuses the prompt spelling when the held pitch matches the prompt", () => {
    expect(
      getHeldOverlayKey(
        {
          duration: "q",
          trebleKeys: ["ab/4"],
        },
        68,
        "Ab",
      ),
    ).toBe("ab/4");
  });

  it("uses flat fallback spelling in flat key signatures", () => {
    expect(
      getHeldOverlayKey(
        {
          duration: "q",
          trebleKeys: ["a/4"],
        },
        70,
        "F",
      ),
    ).toBe("bb/4");
  });

  it("uses sharp fallback spelling in sharp key signatures", () => {
    expect(
      getHeldOverlayKey(
        {
          duration: "q",
          trebleKeys: ["a/4"],
        },
        70,
        "G",
      ),
    ).toBe("a#/4");
  });
});

describe("scale positioning helpers", () => {
  it("uses the expected treble starting octave rule", () => {
    expect(getScaleStartingOctave("F#")).toBe(4);
    expect(getScaleStartingOctave("Gb")).toBe(3);
    expect(getScaleStartingOctave("B")).toBe(3);
    expect(getScaleStartingOctave("Gb", "natural-minor")).toBe(4);
  });

  it("uses the higher cadence treble starting octave limit through G sharp", () => {
    expect(getCadenceStartingOctave("F#", "major")).toBe(4);
    expect(getCadenceStartingOctave("G#", "minor")).toBe(4);
    expect(getCadenceStartingOctave("Ab", "minor")).toBe(4);
    expect(getCadenceStartingOctave("A", "minor")).toBe(3);
  });

  it("chooses descending single-hand scale starts within the comfort bands", () => {
    expect(
      getDescendingScaleStartingOctave(
        "C",
        "major",
        1,
        "treble",
      ),
    ).toBe(5);
    expect(
      getDescendingScaleStartingOctave(
        "C",
        "major",
        1,
        "bass",
      ),
    ).toBe(3);
    expect(
      getDescendingScaleStartingOctave(
        "Ab",
        "natural-minor",
        2,
        "treble",
      ),
    ).toBe(3);
    expect(
      getDescendingScaleStartingOctave(
        "G",
        "major",
        1,
        "treble",
      ),
    ).toBe(4);
    expect(
      getDescendingScaleStartingOctave(
        "F#",
        "major",
        1,
        "bass",
      ),
    ).toBe(3);
  });

  it("builds ascending keys without dropping backward across octaves", () => {
    expect(getAscendingScaleKeys("Ab", "major", 3, 1)).toEqual([
      "ab/3",
      "bb/3",
      "c/4",
      "db/4",
      "eb/4",
      "f/4",
      "g/4",
      "ab/4",
    ]);
  });

  it("keeps practical enharmonic spellings through the repeated top note", () => {
    expect(getAscendingScaleKeys("Gb", "natural-minor", 4, 1)).toEqual([
      "f#/4",
      "g#/4",
      "a/4",
      "b/4",
      "c#/5",
      "d/5",
      "e/5",
      "f#/5",
    ]);

    expect(getAscendingScaleKeys("G#", "major", 3, 1)).toEqual([
      "ab/3",
      "bb/3",
      "c/4",
      "db/4",
      "eb/4",
      "f/4",
      "g/4",
      "ab/4",
    ]);
  });
});

describe("getScaleRenderingNotice", () => {
  it("explains when a rare spelling is rendered enharmonically", () => {
    expect(
      getScaleRenderingNotice(
        createGenerationSettings({
          tonic: "Gb",
          scaleType: "natural-minor",
        }),
      ),
    ).toBe(
      "Gb natural minor is being rendered as F# natural minor for readability.",
    );
  });

  it("returns null when no practical substitution is needed", () => {
    expect(
      getScaleRenderingNotice(
        createGenerationSettings({
          tonic: "Ab",
          scaleType: "major",
        }),
      ),
    ).toBeNull();
  });

  it("uses the readability-cost model for supported enharmonic minor spellings", () => {
    expect(
      getScaleRenderingNotice(
        createGenerationSettings({
          tonic: "Ab",
          scaleType: "natural-minor",
        }),
      ),
    ).toBe(
      "Ab natural minor is being rendered as G# natural minor for readability.",
    );
  });

  it("does not substitute conventional flat major key signatures", () => {
    expect(
      getScaleRenderingNotice(
        createGenerationSettings({
          tonic: "Db",
          scaleType: "major",
        }),
      ),
    ).toBeNull();

    expect(
      getScaleRenderingNotice(
        createGenerationSettings({
          tonic: "Gb",
          scaleType: "major",
        }),
      ),
    ).toBeNull();
  });
});

describe("getTonicReadabilityOptionsForScaleType", () => {
  it("sorts enharmonic candidates by readability cost", () => {
    expect(
      getTonicReadabilityOptionsForScaleType("Ab", "natural-minor").map(
        (option) => ({
          tonic: option.tonic,
          cost: option.cost,
        }),
      ),
    ).toEqual([
      { tonic: "G#", cost: 5 },
      { tonic: "Ab", cost: 7 },
    ]);
  });

  it("prefers D flat major and ties G flat major to the selected tonic", () => {
    expect(
      getTonicReadabilityOptionsForScaleType("Db", "major").map((option) => ({
        tonic: option.tonic,
        cost: option.cost,
      })),
    ).toEqual([
      { tonic: "Db", cost: 5 },
      { tonic: "C#", cost: 7 },
    ]);

    expect(
      getTonicReadabilityOptionsForScaleType("Gb", "major").map((option) => ({
        tonic: option.tonic,
        cost: option.cost,
      })),
    ).toEqual([
      { tonic: "Gb", cost: 6 },
      { tonic: "F#", cost: 6 },
    ]);
  });

  it("includes theoretical flat-minor spellings as alternates in the cost map", () => {
    expect(
      getTonicReadabilityOptionsForScaleType("Gb", "natural-minor").map(
        (option) => ({
          tonic: option.tonic,
          keySignature: option.keySignature,
          cost: option.cost,
        }),
      ),
    ).toEqual([
      { tonic: "F#", keySignature: "A", cost: 3 },
      { tonic: "Gb", keySignature: null, cost: 20 },
    ]);

    expect(
      getTonicReadabilityOptionsForScaleType("Db", "natural-minor").map(
        (option) => ({
          tonic: option.tonic,
          keySignature: option.keySignature,
          cost: option.cost,
        }),
      ),
    ).toEqual([
      { tonic: "C#", keySignature: "E", cost: 4 },
      { tonic: "Db", keySignature: null, cost: 10 },
    ]);
  });
});
