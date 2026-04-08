# Grand Staff Trainer
Grand Staff Trainer is a customisable piano practice tool for learning how notes, scales, chords, arpeggios and cadences are read and played from the grand staff. It provides live MIDI input analysis with readable notation and visual feedback to help connect the player's input with practical sheet music. There are three primary features and each can be toggled in accordance with the player's preferences.

Primary feature explanations:
1. [Input naming panel](#input-naming-panel)
2. [Exercise panel](#exercise-panel)
3. [Keyboard display panel](#keyboard-display-panel)

Design philosophy rationale:
1. [Input naming panel](#input-analysis)
2. [Exercise panel](#exercise-engraving)
3. [Keyboard display panel](#keyboard-display)

![An example image of the Grand Staff Trainer layout.](referenceImg/layout.png)

## Input Naming Panel
The input naming panel is the topmost panel when visible. It analyses the player's current input using a key-agnostic naming system centred around C and provides information on its musical structure. It is compatible with sustain pedal use. Significant effort was put into making the analysis as transparent about ambiguities as possible, refer to [here](input-analysis) for the design philosophy.

![An example image of named input.](referenceImg/input_naming.jpg)

Every analysis consists of three lines:

1. A shorthand line that displays a best-effort primary reading and any reasonable alternatives/ambiguities.
2. A line that displays the exact notes.
3. A longhand line that displays a full name.

The input naming panel is capable of analysing the following structures. Please note that these are examples and not an exhaustive list.

- Individual notes (C, Db/C#)
- Intervals (longhand names include semitone distance)
    - First octave: Cm2, CM2, Cm3, CM3, CP4, CTT, CP5, Cm6, CM6, Cm7, CM7, CP8
    - Second octave: Cm9, CM9, Cm10, CM10, CP11, CTT, CP12, Cm13, CM13, Cm14, CM14, CP15
    - Third octave and beyond: revert to simple/first octave naming
- Triads and other three note structures
    - Triad qualities: CM, Cm, Cdim, Caug
    - Suspended: Csus2, Csus4
    - Inversions: CM/E, Csus2/D
    - 5 chords: C5
- 7th chords and other four note structures
    - 7th qualities: CM7, C7, Cm7, Cm7b5, Cdim7, CmM7, CaugM7, Caug7
    - 6th chords: C6, Cm6
    - All inversions: Cdim7/Eb ...
    - Added notes: CMadd2, CMadd4, CMadd9, CMadd11 ...

## Exercise Panel

## Keyboard Display Panel

## Design Rationale
Music is complex and many perspectives can be taken for any problem. Great effort has been put into making each feature feel as intuitive and consistent as possible, but there will no doubt be moments of confusion. This section is to explain the logic driving the features.

### Input Analysis

### Exercise Engraving

### Keyboard Display