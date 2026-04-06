import { describe, expect, it } from "vitest";

import { analyzeHeldInput } from "./inputAnalysis";

describe("analyzeHeldInput", () => {
  it("returns an empty-state analysis when no notes are held", () => {
    expect(analyzeHeldInput([])).toEqual({
      noteLabel: null,
      primary: null,
      alternates: [],
    });
  });

  it("describes a single held note with note label and primary names", () => {
    expect(analyzeHeldInput([70])).toEqual({
      noteLabel: "Bb4/A#4",
      primary: {
        shorthand: "Bb/A#",
        longhand: "Bb/A# note",
      },
      alternates: [],
    });
  });

  it("describes a simple minor second interval", () => {
    expect(analyzeHeldInput([60, 61])).toEqual({
      noteLabel: "C4-Db4/C#4",
      primary: {
        shorthand: "Cm2",
        longhand: "C minor 2nd (1 semitone)",
      },
      alternates: [],
    });
  });

  it("describes a simple major second interval", () => {
    expect(analyzeHeldInput([60, 62])).toEqual({
      noteLabel: "C4-D4",
      primary: {
        shorthand: "CM2",
        longhand: "C major 2nd (2 semitones)",
      },
      alternates: [],
    });
  });

  it("describes a tritone interval", () => {
    expect(analyzeHeldInput([60, 66])).toEqual({
      noteLabel: "C4-Gb4/F#4",
      primary: {
        shorthand: "CTT",
        longhand: "C tritone (6 semitones)",
      },
      alternates: [],
    });
  });

  it("describes an octave interval", () => {
    expect(analyzeHeldInput([60, 72])).toEqual({
      noteLabel: "C4-C5",
      primary: {
        shorthand: "CP8",
        longhand: "C octave (12 semitones)",
      },
      alternates: [],
    });
  });

  it("describes a major ninth interval", () => {
    expect(analyzeHeldInput([60, 74])).toEqual({
      noteLabel: "C4-D5",
      primary: {
        shorthand: "CM9",
        longhand: "C major 9th (14 semitones)",
      },
      alternates: [],
    });
  });

  it("describes a perfect twelfth interval", () => {
    expect(analyzeHeldInput([60, 79])).toEqual({
      noteLabel: "C4-G5",
      primary: {
        shorthand: "CP12",
        longhand: "C perfect 12th (19 semitones)",
      },
      alternates: [],
    });
  });

  it("describes a compound tritone interval", () => {
    expect(analyzeHeldInput([60, 78])).toEqual({
      noteLabel: "C4-Gb5/F#5",
      primary: {
        shorthand: "CTT",
        longhand: "C tritone (18 semitones)",
      },
      alternates: [],
    });
  });

  it("describes a double octave interval", () => {
    expect(analyzeHeldInput([60, 84])).toEqual({
      noteLabel: "C4-C6",
      primary: {
        shorthand: "CP15",
        longhand: "C double octave (24 semitones)",
      },
      alternates: [],
    });
  });

  it("falls back to simple naming plus semitone distance for larger awkward intervals", () => {
    expect(analyzeHeldInput([60, 94])).toEqual({
      noteLabel: "C4-Bb6/A#6",
      primary: {
        shorthand: "Cm7",
        longhand: "C minor 7th (34 semitones)",
      },
      alternates: [],
    });
  });

  it("collapses octave stacks of one pitch class to the outer interval", () => {
    expect(analyzeHeldInput([84, 96, 108])).toEqual({
      noteLabel: "C6-C7-C8",
      primary: {
        shorthand: "CP15",
        longhand: "C double octave (24 semitones)",
      },
      alternates: [],
    });
  });

  it("collapses octave-doubled interval inputs to the simple interval", () => {
    expect(analyzeHeldInput([60, 64, 72])).toEqual({
      noteLabel: "C4-E4-C5",
      primary: {
        shorthand: "CM3",
        longhand: "C major 3rd (4 semitones)",
      },
      alternates: [],
    });
  });

  it("treats sustain-style exact duplicates the same as doubled notes", () => {
    expect(analyzeHeldInput([60, 64, 64, 72])).toEqual({
      noteLabel: "C4-E4-C5",
      primary: {
        shorthand: "CM3",
        longhand: "C major 3rd (4 semitones)",
      },
      alternates: [],
    });
  });

  it("prefers a 5 chord reading for doubled root-fifth voicings", () => {
    expect(analyzeHeldInput([60, 72, 79])).toEqual({
      noteLabel: "C4-C5-G5",
      primary: {
        shorthand: "C5",
        longhand: "C 5 chord",
      },
      alternates: [],
    });
  });

  it("describes a root-position 5 chord when a fifth is doubled as a voicing", () => {
    expect(analyzeHeldInput([60, 67, 72])).toEqual({
      noteLabel: "C4-G4-C5",
      primary: {
        shorthand: "C5",
        longhand: "C 5 chord",
      },
      alternates: [],
    });
  });

  it("describes a slash-bass 5 chord when the fifth is in the bass", () => {
    expect(analyzeHeldInput([55, 60, 67])).toEqual({
      noteLabel: "G3-C4-G4",
      primary: {
        shorthand: "C5/G",
        longhand: "C 5 chord over G",
      },
      alternates: [],
    });
  });

  it("describes a major triad", () => {
    expect(analyzeHeldInput([60, 64, 67])).toEqual({
      noteLabel: "C4-E4-G4",
      primary: {
        shorthand: "CM",
        longhand: "C major triad",
      },
      alternates: [],
    });
  });

  it("describes a major triad in first inversion", () => {
    expect(analyzeHeldInput([64, 67, 72])).toEqual({
      noteLabel: "E4-G4-C5",
      primary: {
        shorthand: "CM/E",
        longhand: "C major triad, first inversion",
      },
      alternates: [],
    });
  });

  it("describes a major triad in second inversion", () => {
    expect(analyzeHeldInput([67, 72, 76])).toEqual({
      noteLabel: "G4-C5-E5",
      primary: {
        shorthand: "CM/G",
        longhand: "C major triad, second inversion",
      },
      alternates: [],
    });
  });

  it("describes a minor triad", () => {
    expect(analyzeHeldInput([60, 63, 67])).toEqual({
      noteLabel: "C4-Eb4/D#4-G4",
      primary: {
        shorthand: "Cm",
        longhand: "C minor triad",
      },
      alternates: [],
    });
  });

  it("keeps triad inversion labeling when notes are doubled", () => {
    expect(analyzeHeldInput([64, 67, 72, 76])).toEqual({
      noteLabel: "E4-G4-C5-E5",
      primary: {
        shorthand: "CM/E",
        longhand: "C major triad, first inversion",
      },
      alternates: [],
    });
  });

  it("describes a diminished triad", () => {
    expect(analyzeHeldInput([60, 63, 66])).toEqual({
      noteLabel: "C4-Eb4/D#4-Gb4/F#4",
      primary: {
        shorthand: "Cdim",
        longhand: "C diminished triad",
      },
      alternates: [],
    });
  });

  it("describes an augmented triad", () => {
    expect(analyzeHeldInput([60, 64, 68])).toEqual({
      noteLabel: "C4-E4-Ab4/G#4",
      primary: {
        shorthand: "Caug",
        longhand: "C augmented triad",
      },
      alternates: [
        {
          shorthand: "Eaug/C",
          longhand: "E augmented triad, first inversion",
        },
        {
          shorthand: "Abaug/C",
          longhand: "Ab augmented triad, first inversion",
        },
      ],
    });
  });

  it("surfaces reasonable augmented-triad alternates", () => {
    expect(analyzeHeldInput([64, 68, 72])).toEqual({
      noteLabel: "E4-Ab4/G#4-C5",
      primary: {
        shorthand: "Eaug",
        longhand: "E augmented triad",
      },
      alternates: [
        {
          shorthand: "Caug/E",
          longhand: "C augmented triad, first inversion",
        },
        {
          shorthand: "Abaug/E",
          longhand: "Ab augmented triad, first inversion",
        },
      ],
    });
  });

  it("describes a major 7th chord", () => {
    expect(analyzeHeldInput([60, 64, 67, 71])).toEqual({
      noteLabel: "C4-E4-G4-B4",
      primary: {
        shorthand: "CM7",
        longhand: "C major 7th chord",
      },
      alternates: [],
    });
  });

  it("describes a dominant 7th chord", () => {
    expect(analyzeHeldInput([60, 64, 67, 70])).toEqual({
      noteLabel: "C4-E4-G4-Bb4/A#4",
      primary: {
        shorthand: "C7",
        longhand: "C dominant 7th chord",
      },
      alternates: [],
    });
  });

  it("describes a minor 7th chord", () => {
    expect(analyzeHeldInput([60, 63, 67, 70])).toEqual({
      noteLabel: "C4-Eb4/D#4-G4-Bb4/A#4",
      primary: {
        shorthand: "Cm7",
        longhand: "C minor 7th chord",
      },
      alternates: [],
    });
  });

  it("describes a half-diminished 7th chord", () => {
    expect(analyzeHeldInput([60, 63, 66, 70])).toEqual({
      noteLabel: "C4-Eb4/D#4-Gb4/F#4-Bb4/A#4",
      primary: {
        shorthand: "Cm7b5",
        longhand: "C half-diminished 7th chord",
      },
      alternates: [],
    });
  });

  it("describes a diminished 7th chord", () => {
    expect(analyzeHeldInput([60, 63, 66, 69])).toEqual({
      noteLabel: "C4-Eb4/D#4-Gb4/F#4-A4",
      primary: {
        shorthand: "Cdim7",
        longhand: "C diminished 7th chord",
      },
      alternates: [
        {
          shorthand: "Ebdim7/C",
          longhand: "Eb diminished 7th chord, third inversion",
        },
        {
          shorthand: "Gbdim7/C",
          longhand: "Gb diminished 7th chord, second inversion",
        },
        {
          shorthand: "Adim7/C",
          longhand: "A diminished 7th chord, first inversion",
        },
      ],
    });
  });

  it("describes a major 7th chord in first inversion", () => {
    expect(analyzeHeldInput([64, 67, 71, 72])).toEqual({
      noteLabel: "E4-G4-B4-C5",
      primary: {
        shorthand: "CM7/E",
        longhand: "C major 7th chord, first inversion",
      },
      alternates: [],
    });
  });

  it("describes a suspended 2nd chord with an alternate suspended 4th reading", () => {
    expect(analyzeHeldInput([60, 62, 67])).toEqual({
      noteLabel: "C4-D4-G4",
      primary: {
        shorthand: "Csus2",
        longhand: "C suspended 2nd",
      },
      alternates: [
        {
          shorthand: "Gsus4/C",
          longhand: "G suspended 4th over C",
        },
      ],
    });
  });

  it("describes a suspended 4th chord with an alternate suspended 2nd reading", () => {
    expect(analyzeHeldInput([60, 65, 67])).toEqual({
      noteLabel: "C4-F4-G4",
      primary: {
        shorthand: "Csus4",
        longhand: "C suspended 4th",
      },
      alternates: [
        {
          shorthand: "Fsus2/C",
          longhand: "F suspended 2nd over C",
        },
      ],
    });
  });

  it("keeps the bass-note suspended reading primary in inversion-like voicings", () => {
    expect(analyzeHeldInput([65, 67, 72])).toEqual({
      noteLabel: "F4-G4-C5",
      primary: {
        shorthand: "Fsus2",
        longhand: "F suspended 2nd",
      },
      alternates: [
        {
          shorthand: "Csus4/F",
          longhand: "C suspended 4th over F",
        },
      ],
    });
  });

  it("returns an unknown-input analysis for other unsupported inputs", () => {
    expect(analyzeHeldInput([60, 61, 67])).toEqual({
      noteLabel: "C4-Db4/C#4-G4",
      primary: null,
      alternates: [],
    });
  });
});
