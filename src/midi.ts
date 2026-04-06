export type MidiStatus =
  | "idle"
  | "requesting"
  | "waiting"
  | "ready"
  | "unsupported"
  | "error";

export type MidiInputOption = {
  id: string;
  name: string;
};

export type MidiEventInfo = {
  noteNumber: number;
  type: "noteon" | "noteoff";
  velocity: number;
} | null;

type ConnectMidiOptions = {
  onNoteOn?: (noteNumber: number) => void;
  preferredInputId?: string | null;
};

export type MidiState = {
  status: MidiStatus;
  deviceId: string | null;
  deviceName: string | null;
  availableInputs: MidiInputOption[];
  sustainPedalDown: boolean;
  heldKeys: string[];
  heldNotes: number[];
  analysisHeldKeys: string[];
  analysisHeldNotes: number[];
  lastEvent: MidiEventInfo;
  errorMessage: string | null;
};

const NOTE_NAMES = [
  "c",
  "c#",
  "d",
  "d#",
  "e",
  "f",
  "f#",
  "g",
  "g#",
  "a",
  "a#",
  "b",
];

export function connectMidi(
  onStateChange: (state: MidiState) => void,
  options: ConnectMidiOptions = {},
) {
  let access: MIDIAccess | null = null;
  let activeInput: MIDIInput | null = null;
  let preferredInputId = options.preferredInputId ?? null;
  const physicallyHeldNotes = new Set<number>();
  const sustainedNotes = new Set<number>();
  let sustainPedalDown = false;

  function emit(state: Partial<MidiState>) {
    const midiState: MidiState = {
      status: "idle",
      deviceId: activeInput?.id ?? null,
      deviceName: activeInput?.name ?? null,
      availableInputs: getAvailableInputs(),
      sustainPedalDown,
      heldKeys: getHeldKeys(),
      heldNotes: getHeldNotes(),
      analysisHeldKeys: getAnalysisHeldKeys(),
      analysisHeldNotes: getAnalysisHeldNotes(),
      lastEvent: null,
      errorMessage: null,
      ...state,
    };

    onStateChange(midiState);
  }

  function getHeldNotes() {
    return [...physicallyHeldNotes].sort((left, right) => left - right);
  }

  function getAnalysisHeldNotes() {
    return [...new Set([...physicallyHeldNotes, ...sustainedNotes])].sort(
      (left, right) => left - right,
    );
  }

  function getHeldKeys() {
    return getHeldNotes().map(midiNoteNumberToKey);
  }

  function getAnalysisHeldKeys() {
    return getAnalysisHeldNotes().map(midiNoteNumberToKey);
  }

  function getAvailableInputs() {
    if (!access) {
      return [];
    }

    return [...access.inputs.values()].map((input) => ({
      id: input.id,
      name: input.name ?? "Unnamed MIDI input",
    }));
  }

  function bindInput(input: MIDIInput | null) {
    if (activeInput) {
      activeInput.onmidimessage = null;
    }

    activeInput = input;
    physicallyHeldNotes.clear();
    sustainedNotes.clear();
    sustainPedalDown = false;

    if (!activeInput) {
      emit({
        status: "waiting",
      });
      return;
    }

    activeInput.onmidimessage = (event) => {
      if (!event.data) {
        return;
      }

      const statusByte = event.data[0];
      const noteNumber = event.data[1];
      const velocity = event.data[2];
      const messageType = statusByte & 0xf0;

      if (messageType === 0x90 && velocity > 0) {
        physicallyHeldNotes.add(noteNumber);
        sustainedNotes.delete(noteNumber);
        options.onNoteOn?.(noteNumber);
        emit({
          lastEvent: {
            noteNumber,
            type: "noteon",
            velocity,
          },
          status: "ready",
        });
        return;
      }

      if (messageType === 0x80 || (messageType === 0x90 && velocity === 0)) {
        physicallyHeldNotes.delete(noteNumber);

        if (sustainPedalDown) {
          sustainedNotes.add(noteNumber);
        } else {
          sustainedNotes.delete(noteNumber);
        }

        emit({
          lastEvent: {
            noteNumber,
            type: "noteoff",
            velocity,
          },
          status: "ready",
        });
        return;
      }

      if (messageType === 0xb0 && noteNumber === 64) {
        sustainPedalDown = velocity >= 64;

        if (!sustainPedalDown) {
          sustainedNotes.clear();
        }

        emit({
          status: "ready",
        });
      }
    };

    emit({
      status: "ready",
    });
  }

  function syncInput() {
    if (!access) {
      return;
    }

    const availableInputs = [...access.inputs.values()];
    const preferredInput = preferredInputId
      ? (access.inputs.get(preferredInputId) ?? null)
      : null;
    const currentInputStillAvailable = activeInput
      ? access.inputs.has(activeInput.id)
      : false;

    if (preferredInput) {
      bindInput(preferredInput);
      return;
    }

    if (currentInputStillAvailable) {
      emit({
        status: "ready",
      });
      return;
    }

    bindInput(availableInputs[0] ?? null);
  }

  async function start() {
    if (!("requestMIDIAccess" in navigator)) {
      emit({
        status: "unsupported",
        errorMessage: "Web MIDI is not available in this browser.",
      });
      return;
    }

    emit({
      status: "requesting",
    });

    try {
      access = await navigator.requestMIDIAccess();
      access.onstatechange = () => {
        syncInput();
      };
      syncInput();
    } catch (error) {
      emit({
        status: "error",
        errorMessage:
          error instanceof Error ? error.message : "Could not access Web MIDI.",
      });
    }
  }

  void start();

  return {
    disconnect() {
      if (activeInput) {
        activeInput.onmidimessage = null;
      }

      if (access) {
        access.onstatechange = null;
      }
    },
    selectInput(inputId: string) {
      preferredInputId = inputId;

      if (!access) {
        return;
      }

      bindInput(access.inputs.get(inputId) ?? null);
    },
  };
}

function midiNoteNumberToKey(noteNumber: number) {
  const noteName = NOTE_NAMES[noteNumber % 12];
  const octave = Math.floor(noteNumber / 12) - 1;

  return `${noteName}/${octave}`;
}
