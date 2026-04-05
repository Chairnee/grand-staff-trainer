import { describe, expect, it } from "vitest";

import { analyzeHeldInput } from "./inputAnalysis";

describe("analyzeHeldInput", () => {
  it("shows a no-input placeholder when nothing is held", () => {
    expect(analyzeHeldInput([])).toEqual({
      primaryLabel: "No input",
      secondaryLabel: "Hold notes to analyse input.",
    });
  });

  it("uses common practical spelling for a single held note", () => {
    expect(analyzeHeldInput([70])).toEqual({
      primaryLabel: "Bb/A#4",
      secondaryLabel: "Single note",
    });
  });

  it("keeps practical single-note spelling key-agnostic", () => {
    expect(analyzeHeldInput([70])).toEqual({
      primaryLabel: "Bb/A#4",
      secondaryLabel: "Single note",
    });
  });

  it("names a perfect fifth from two held notes", () => {
    expect(analyzeHeldInput([59, 66])).toEqual({
      primaryLabel: "B Perfect Fifth",
      secondaryLabel: "B3 - Gb/F#4",
    });
  });

  it("uses practical semitone-based naming within the octave", () => {
    expect(analyzeHeldInput([60, 61])).toEqual({
      primaryLabel: "C Minor Second",
      secondaryLabel: "C4 - Db/C#4",
    });
  });

  it("uses compound interval naming above the octave", () => {
    expect(analyzeHeldInput([60, 74])).toEqual({
      primaryLabel: "C Major Ninth",
      secondaryLabel: "C4 - D5",
    });
  });

  it("uses practical semitone-based naming above the octave", () => {
    expect(analyzeHeldInput([60, 73])).toEqual({
      primaryLabel: "C Minor Ninth",
      secondaryLabel: "C4 - Db/C#5",
    });
  });

  it("uses flat spelling for intervals in flat keys", () => {
    expect(analyzeHeldInput([65, 70])).toEqual({
      primaryLabel: "F Perfect Fourth",
      secondaryLabel: "F4 - Bb/A#4",
    });
  });

  it("names octave-spaced notes as an octave", () => {
    expect(analyzeHeldInput([60, 72])).toEqual({
      primaryLabel: "C Octave",
      secondaryLabel: "C4 - C5",
    });
  });

  it("names a major triad in root position", () => {
    expect(analyzeHeldInput([60, 64, 67])).toEqual({
      primaryLabel: "C major triad",
      secondaryLabel: "C4 - E4 - G4",
    });
  });

  it("names a major triad in first inversion", () => {
    expect(analyzeHeldInput([64, 67, 72])).toEqual({
      primaryLabel: "C major triad, first inversion",
      secondaryLabel: "E4 - G4 - C5",
    });
  });

  it("uses practical naming for enharmonic triad spellings", () => {
    expect(analyzeHeldInput([60, 63, 67])).toEqual({
      primaryLabel: "C minor triad",
      secondaryLabel: "C4 - Eb/D#4 - G4",
    });
  });

  it("prefers flat root names for practical triads in flat keys", () => {
    expect(analyzeHeldInput([56, 60, 63])).toEqual({
      primaryLabel: "Ab major triad",
      secondaryLabel: "Ab/G#3 - C4 - Eb/D#4",
    });
  });

  it("prefers Db as the practical chord root name by default", () => {
    expect(analyzeHeldInput([61, 65, 68])).toEqual({
      primaryLabel: "Db major triad",
      secondaryLabel: "Db/C#4 - F4 - Ab/G#4",
    });
  });

  it("shows a simple placeholder for four or more held notes", () => {
    expect(analyzeHeldInput([60, 64, 67, 71])).toEqual({
      primaryLabel: "Multiple notes",
      secondaryLabel: "Chord naming coming soon.",
    });
  });
});
