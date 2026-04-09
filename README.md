# Grand Staff Trainer
Grand Staff Trainer is a customisable piano practice tool for learning how notes, scales, chords, arpeggios and cadences are read and played from the grand staff in all keys. It provides live MIDI input analysis with readable notation and visual feedback to help connect the player's input with practical sheet music. There are three primary features and each can be toggled in accordance with the player's preferences.

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
The input naming panel is the topmost panel when visible. It analyses the player's current input using a key-agnostic naming system centred around C and provides information on its musical structure. It is compatible with sustain pedal use. Significant effort was put into making the analysis as transparent about ambiguities as possible, refer to [here](#input-analysis) for the design philosophy.

![An example image of named input.](referenceImg/input_naming.jpg)

Every analysis consists of three lines:

1. A shorthand line that displays a best-effort primary reading and any reasonable alternatives/ambiguities.
2. A line that displays the exact notes.
3. A longhand line that displays a full name.

The input naming panel is capable of analysing the following structures. Please note that these are some shorthand examples using C and by no means an exhaustive list.

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
    - All inversions: Cdim7/Eb
    - Added notes: CMadd2, CMadd4, CMadd9, CMadd11
- Repeated chord tones are recognised and considered (e.g. sustain pedal use).

## Exercise Panel
The exercise panel is the centre panel when visible. It is the crux of Grand Staff Trainer and therefore assigned the most space. It renders sheet music based on the chosen exercise settings. The sheet music scrolls as the player plays and will only advance when the expected notes are played correctly. Exercises cycle endlessly. 

Depending on the exercise settings (tonic, etc.), the tool may render the exercise in a different context to prioritise readability. The player can easily swap to the less readable view if they wish.

Any exercise that requires multi-note input, hands together scales or triads for example, depends on the adjustable "chord window" in the toolbar at the top of the page. The chord window is how long the tool will wait after detecting the first input before trying to validate the held notes against the expected notes for the exercise. The tighter the window, the more precise the player must be with inputting all notes at once.

![An example of Ab minor triads for two hands in parallel motion across two octaves being rendered in G# minor for readability.](referenceImg/exercise_panel.png)

The example image above is based on the following exercise settings:

1. Practice mode: triads
2. Hands: together
3. Octaves: 2
4. Tonic: Ab
5. Triad type: minor

There are four main components to the exercise panel:

1. The grand staff (centre).
2. An input overlay that shows where the currently played notes reside on the grand staff. This is vertically aligned with the notes expected to be played next.
3. A conditionally visible button to swap between especially ambiguous enharmonic readings (top left).
4. A summary of the current exercise settings (bottom left).




This is the current exercise suite:

- Scales
    - Hands
        - Treble only
        - Bass only
        - Together
    - Direction or Motion depending on single or double hand
        - Direction
            - Ascending
            - Descending
        - Motion
            - Parallel
            - Contrary
    - Octaves
        - 1
        - 2
    - Tonic
        - Every practical tonic
    - Scale type
        - Major
        - Natural minor
        - Harmonic minor
        - Melodic minor

- Triads
    - Hands
        - Treble only
        - Bass only
        - Together
    - Octaves
        - 1
        - 2
    - Tonic
        - Every practical tonic
    - Triad type
        - Major
        - Minor

- Arpeggios
    - Hands
        - Treble only
        - Bass only
        - Together
    - Direction or Motion depending on single or double hand
        - Direction
            - Ascending
            - Descending
        - Motion
            - Parallel
            - Contrary
    - Octaves
        - 1
        - 2
    - Tonic
        - Every practical tonic
    - Arpeggio type
        - Major
        - Minor

- Cadences
    - Hands
        - Treble only
        - Bass only
        - Together
    - Tonic
        - Every practical tonic
    - Cadence type
        - Major
        - Minor

## Keyboard Display Panel

## Design Rationale
Music is complex and many perspectives can be taken for any problem. Great effort has been put into making each feature feel as intuitive and consistent as possible, but there will no doubt be moments of confusion. This section is to explain the logic driving the features.

### Input Analysis

### Exercise Engraving

### Keyboard Display