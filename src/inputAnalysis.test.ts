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

  it("names a major triad with a doubled root", () => {
    expect(analyzeHeldInput([60, 64, 67, 72])).toEqual({
      primaryLabel: "C major triad",
      secondaryLabel: "C4 - E4 - G4 - C5",
    });
  });

  it("names a major triad in first inversion", () => {
    expect(analyzeHeldInput([64, 67, 72])).toEqual({
      primaryLabel: "C major triad, first inversion",
      secondaryLabel: "E4 - G4 - C5",
      alternateLabel: "C/E",
    });
  });

  it("names a sus2 chord in root position", () => {
    expect(analyzeHeldInput([60, 62, 67])).toEqual({
      primaryLabel: "C sus2",
      secondaryLabel: "C4 - D4 - G4",
      alternateLabel: "G sus4/C",
    });
  });

  it("names a sus4 chord in root position", () => {
    expect(analyzeHeldInput([60, 65, 67])).toEqual({
      primaryLabel: "C sus4",
      secondaryLabel: "C4 - F4 - G4",
      alternateLabel: "F sus2/C",
    });
  });

  it("prefers the bass-root suspended reading when the voicing is ambiguous", () => {
    expect(analyzeHeldInput([65, 67, 72])).toEqual({
      primaryLabel: "F sus2",
      secondaryLabel: "F4 - G4 - C5",
      alternateLabel: "C sus4/F",
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

  it("names a major seventh chord", () => {
    expect(analyzeHeldInput([60, 64, 67, 71])).toEqual({
      primaryLabel: "Cmaj7",
      secondaryLabel: "C4 - E4 - G4 - B4",
    });
  });

  it("names a dominant seventh chord with a doubled root", () => {
    expect(analyzeHeldInput([60, 64, 67, 70, 72])).toEqual({
      primaryLabel: "C7",
      secondaryLabel: "C4 - E4 - G4 - Bb/A#4 - C5",
    });
  });

  it("prefers a 6 chord when its root matches the bass", () => {
    expect(analyzeHeldInput([60, 64, 67, 69])).toEqual({
      primaryLabel: "C6",
      secondaryLabel: "C4 - E4 - G4 - A4",
      alternateLabel: "Am7/C",
    });
  });

  it("prefers a seventh chord when its root matches the bass", () => {
    expect(analyzeHeldInput([57, 60, 64, 67])).toEqual({
      primaryLabel: "Am7",
      secondaryLabel: "A3 - C4 - E4 - G4",
      alternateLabel: "C6/A",
    });
  });

  it("names a dominant seventh chord", () => {
    expect(analyzeHeldInput([60, 64, 67, 70])).toEqual({
      primaryLabel: "C7",
      secondaryLabel: "C4 - E4 - G4 - Bb/A#4",
    });
  });

  it("names a minor major seventh chord", () => {
    expect(analyzeHeldInput([60, 63, 67, 71])).toEqual({
      primaryLabel: "Cm(maj7)",
      secondaryLabel: "C4 - Eb/D#4 - G4 - B4",
    });
  });

  it("names an augmented major seventh chord", () => {
    expect(analyzeHeldInput([60, 64, 68, 71])).toEqual({
      primaryLabel: "Cmaj7#5",
      secondaryLabel: "C4 - E4 - Ab/G#4 - B4",
    });
  });

  it("names an augmented dominant seventh chord", () => {
    expect(analyzeHeldInput([60, 64, 68, 70])).toEqual({
      primaryLabel: "C7#5",
      secondaryLabel: "C4 - E4 - Ab/G#4 - Bb/A#4",
    });
  });

  it("names a minor seventh chord", () => {
    expect(analyzeHeldInput([60, 63, 67, 70])).toEqual({
      primaryLabel: "Cm7",
      secondaryLabel: "C4 - Eb/D#4 - G4 - Bb/A#4",
      alternateLabel: "Eb6/C",
    });
  });

  it("names a half-diminished seventh chord", () => {
    expect(analyzeHeldInput([60, 63, 66, 70])).toEqual({
      primaryLabel: "Cm7b5",
      secondaryLabel: "C4 - Eb/D#4 - Gb/F#4 - Bb/A#4",
      alternateLabel: "Ebm6/C",
    });
  });

  it("prefers a minor 6 chord when its root matches the bass", () => {
    expect(analyzeHeldInput([60, 63, 67, 69])).toEqual({
      primaryLabel: "Cm6",
      secondaryLabel: "C4 - Eb/D#4 - G4 - A4",
      alternateLabel: "Am7b5/C",
    });
  });

  it("names an add2 chord when the second is close-voiced", () => {
    expect(analyzeHeldInput([60, 62, 64, 67])).toEqual({
      primaryLabel: "Cadd2",
      secondaryLabel: "C4 - D4 - E4 - G4",
      alternateLabel: "Cadd9",
    });
  });

  it("names an add9 chord when the second is compound", () => {
    expect(analyzeHeldInput([60, 64, 67, 74])).toEqual({
      primaryLabel: "Cadd9",
      secondaryLabel: "C4 - E4 - G4 - D5",
      alternateLabel: "Cadd2",
    });
  });

  it("names an add2 chord in first inversion", () => {
    expect(analyzeHeldInput([64, 67, 72, 74])).toEqual({
      primaryLabel: "Cadd2, first inversion",
      secondaryLabel: "E4 - G4 - C5 - D5",
      alternateLabel: "Cadd9/E",
    });
  });

  it("names a minor add2 chord when the second is close-voiced", () => {
    expect(analyzeHeldInput([60, 62, 63, 67])).toEqual({
      primaryLabel: "Cm(add2)",
      secondaryLabel: "C4 - D4 - Eb/D#4 - G4",
      alternateLabel: "Cm(add9)",
    });
  });

  it("names an add4 chord", () => {
    expect(analyzeHeldInput([60, 64, 65, 67])).toEqual({
      primaryLabel: "Cadd4",
      secondaryLabel: "C4 - E4 - F4 - G4",
    });
  });

  it("names a minor add4 chord", () => {
    expect(analyzeHeldInput([60, 63, 65, 67])).toEqual({
      primaryLabel: "Cm(add4)",
      secondaryLabel: "C4 - Eb/D#4 - F4 - G4",
    });
  });

  it("names a diminished seventh chord", () => {
    expect(analyzeHeldInput([60, 63, 66, 69])).toEqual({
      primaryLabel: "Cdim7",
      secondaryLabel: "C4 - Eb/D#4 - Gb/F#4 - A4",
    });
  });

  it("names a dominant seventh chord in first inversion", () => {
    expect(analyzeHeldInput([64, 67, 70, 72])).toEqual({
      primaryLabel: "C7, first inversion",
      secondaryLabel: "E4 - G4 - Bb/A#4 - C5",
      alternateLabel: "C7/E",
    });
  });

  it("names a power chord with octave doubling", () => {
    expect(analyzeHeldInput([60, 67, 72])).toEqual({
      primaryLabel: "C5",
      secondaryLabel: "C4 - G4 - C5",
    });
  });

  it("finds the harmonic root for inverted power-chord voicings", () => {
    expect(analyzeHeldInput([55, 60, 67])).toEqual({
      primaryLabel: "C5",
      secondaryLabel: "G3 - C4 - G4",
    });
  });

  it("shows a simple placeholder for unknown 4-note sets", () => {
    expect(analyzeHeldInput([60, 61, 64, 67])).toEqual({
      primaryLabel: "Unknown chord",
      secondaryLabel: "C4 - Db/C#4 - E4 - G4",
    });
  });

  it("shows a simple placeholder for unsupported 5-note sets", () => {
    expect(analyzeHeldInput([60, 62, 64, 67, 71])).toEqual({
      primaryLabel: "Unknown chord",
      secondaryLabel: "C4 - D4 - E4 - G4 - B4",
    });
  });
});
