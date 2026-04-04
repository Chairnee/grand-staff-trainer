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
  heldKeys: string[];
  heldNotes: number[];
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
  const heldNotes = new Set<number>();

  function emit(state: Partial<MidiState>) {
    const midiState: MidiState = {
      status: "idle",
      deviceId: activeInput?.id ?? null,
      deviceName: activeInput?.name ?? null,
      availableInputs: getAvailableInputs(),
      heldKeys: getHeldKeys(),
      heldNotes: getHeldNotes(),
      lastEvent: null,
      errorMessage: null,
      ...state,
    };

    onStateChange(midiState);
  }

  function getHeldNotes() {
    return [...heldNotes].sort((left, right) => left - right);
  }

  function getHeldKeys() {
    return getHeldNotes().map(midiNoteNumberToKey);
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
    heldNotes.clear();

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
        heldNotes.add(noteNumber);
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
        heldNotes.delete(noteNumber);
        emit({
          lastEvent: {
            noteNumber,
            type: "noteoff",
            velocity,
          },
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
