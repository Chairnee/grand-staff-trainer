import "./styles.css";
import {
  Accidental,
  Formatter,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  Voice,
} from "vexflow";
import { connectMidi, type MidiState } from "./midi";

const ATTEMPT_WINDOW_MS = 40;
const MIDI_DEVICE_STORAGE_KEY = "piano-tool-midi-device-id";
const SETTINGS_STORAGE_KEY = "piano-tool-settings";
const PROMPT_QUEUE_LENGTH = 8;
const KEYBOARD_START_MIDI_NOTE = 21;
const KEYBOARD_END_MIDI_NOTE = 108;
const GENERATED_NOTE_POOL = createKeyboardNotePool();
const DEFAULT_RANGE_START = "c/2";
const DEFAULT_RANGE_END = "c/6";
const SHARP_KEY_SIGNATURE_ORDER = ["f", "c", "g", "d", "a", "e", "b"];
const FLAT_KEY_SIGNATURE_ORDER = ["b", "e", "a", "d", "g", "c", "f"];

type PromptSlot = {
  duration: string;
  trebleKeys?: string[];
  bassKeys?: string[];
};

type PromptAttempt = {
  midiNotes: number[];
};

type AttemptResult = "correct" | "incorrect" | null;
type PracticeMode = "random-notes" | "scales";
type ScaleHands = "treble" | "bass" | "together";
type ScaleOctaves = 1 | 2;
type NoteSourceMode = "chromatic" | "in-scale";
type AccidentalSpellingMode = "sharps" | "flats";
type KeySignature =
  | "C"
  | "G"
  | "D"
  | "A"
  | "E"
  | "B"
  | "F#"
  | "C#"
  | "F"
  | "Bb"
  | "Eb"
  | "Ab"
  | "Db"
  | "Gb"
  | "Cb";
type ScaleType = "major" | "natural-minor" | "harmonic-minor" | "melodic-minor";
type MajorTonic =
  | "C"
  | "G"
  | "D"
  | "A"
  | "E"
  | "B"
  | "F#"
  | "C#"
  | "F"
  | "Bb"
  | "Eb"
  | "Ab"
  | "Db"
  | "Gb"
  | "Cb";
type MinorTonic =
  | "A"
  | "E"
  | "B"
  | "F#"
  | "C#"
  | "G#"
  | "D#"
  | "A#"
  | "D"
  | "G"
  | "C"
  | "F"
  | "Bb"
  | "Eb"
  | "Ab";
type Tonic = MajorTonic | MinorTonic;

type GenerationSettings = {
  practiceMode: PracticeMode;
  scaleHands: ScaleHands;
  scaleOctaves: ScaleOctaves;
  rangeStart: string;
  rangeEnd: string;
  noteSourceMode: NoteSourceMode;
  accidentalSpellingMode: AccidentalSpellingMode;
  tonic: Tonic;
  scaleType: ScaleType;
};

const MAJOR_KEY_SIGNATURE_BY_TONIC: Record<MajorTonic, KeySignature> = {
  C: "C",
  G: "G",
  D: "D",
  A: "A",
  E: "E",
  B: "B",
  "F#": "F#",
  "C#": "C#",
  F: "F",
  Bb: "Bb",
  Eb: "Eb",
  Ab: "Ab",
  Db: "Db",
  Gb: "Gb",
  Cb: "Cb",
};
const MINOR_KEY_SIGNATURE_BY_TONIC: Record<MinorTonic, KeySignature> = {
  A: "C",
  E: "G",
  B: "D",
  "F#": "A",
  "C#": "E",
  "G#": "B",
  "D#": "F#",
  "A#": "C#",
  D: "F",
  G: "Bb",
  C: "Eb",
  F: "Ab",
  Bb: "Db",
  Eb: "Gb",
  Ab: "Cb",
};
const MAJOR_TONICS = Object.keys(MAJOR_KEY_SIGNATURE_BY_TONIC) as MajorTonic[];
const MINOR_TONICS = Object.keys(MINOR_KEY_SIGNATURE_BY_TONIC) as MinorTonic[];

type AppState = {
  promptQueue: PromptSlot[];
  currentPromptIndex: number;
  lastAttemptResult: AttemptResult;
  attemptFeedbackCount: number;
  generationSettings: GenerationSettings;
  isSettingsOpen: boolean;
  isDebugVisible: boolean;
  midi: MidiState;
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Could not find app container.");
}

app.innerHTML = `
  <main class="layout">
    <header class="toolbar">
      <div class="toolbar-actions">
        <button id="settings-toggle" class="toolbar-button" type="button">
          Settings
        </button>
        <button id="debug-toggle" class="toolbar-button" type="button">
          Debug
        </button>
      </div>
      <label class="midi-picker">
        <span>MIDI Input</span>
        <select id="midi-input-select"></select>
      </label>
      <div id="midi-status" class="status-pill"></div>
    </header>

    <section class="practice-area">
      <div id="midi-debug" class="midi-debug" hidden></div>
      <div id="notation" class="notation"></div>
    </section>

    <div id="settings-backdrop" class="settings-backdrop" hidden></div>

    <aside
      id="settings-drawer"
      class="settings-drawer"
      aria-hidden="true"
      aria-label="Settings"
    >
      <div class="settings-header">
        <h2>Settings</h2>
        <button id="settings-close" class="toolbar-button" type="button">
          Close
        </button>
      </div>

      <section class="settings-section">
        <h3>Generation</h3>
        <label class="settings-field">
          <span>Practice mode</span>
          <select id="practice-mode-select">
            <option value="random-notes">Random notes</option>
            <option value="scales">Scales</option>
          </select>
        </label>
        <label id="scale-hands-field" class="settings-field" hidden>
          <span>Hands</span>
          <select id="scale-hands-select">
            <option value="treble">Treble only</option>
            <option value="bass">Bass only</option>
            <option value="together">Together</option>
          </select>
        </label>
        <label id="scale-octaves-field" class="settings-field" hidden>
          <span>Octaves</span>
          <select id="scale-octaves-select">
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </label>
        <label id="range-start-field" class="settings-field">
          <span>Lowest note</span>
          <select id="range-start-select"></select>
        </label>
        <label id="range-end-field" class="settings-field">
          <span>Highest note</span>
          <select id="range-end-select"></select>
        </label>
        <label class="settings-field">
          <span>Tonic</span>
          <select id="tonic-select"></select>
        </label>
        <label class="settings-field">
          <span>Scale type</span>
          <select id="scale-type-select">
            <option value="major">Major</option>
            <option value="natural-minor">Natural minor</option>
            <option value="harmonic-minor">Harmonic minor</option>
            <option value="melodic-minor">Melodic minor</option>
          </select>
        </label>
        <label id="note-source-field" class="settings-field">
          <span>Note source</span>
          <select id="note-source-select">
            <option value="chromatic">Chromatic</option>
            <option value="in-scale">In scale</option>
          </select>
        </label>
        <label
          id="accidental-spelling-field"
          class="settings-field"
        >
          <span>Accidental spelling</span>
          <select id="accidental-spelling-select">
            <option value="sharps">Sharps</option>
            <option value="flats">Flats</option>
          </select>
        </label>
      </section>

      <section class="settings-section">
        <h3>Display</h3>
        <label class="settings-toggle">
          <input id="settings-debug-toggle" type="checkbox" />
          <span>Show debug panel</span>
        </label>
      </section>
    </aside>
  </main>
`;

const notation = document.querySelector<HTMLDivElement>("#notation");
const midiInputSelect =
  document.querySelector<HTMLSelectElement>("#midi-input-select");
const midiDebug = document.querySelector<HTMLDivElement>("#midi-debug");
const settingsToggle =
  document.querySelector<HTMLButtonElement>("#settings-toggle");
const debugToggle = document.querySelector<HTMLButtonElement>("#debug-toggle");
const midiStatus = document.querySelector<HTMLDivElement>("#midi-status");
const settingsBackdrop =
  document.querySelector<HTMLDivElement>("#settings-backdrop");
const settingsDrawer = document.querySelector<HTMLElement>("#settings-drawer");
const settingsClose =
  document.querySelector<HTMLButtonElement>("#settings-close");
const practiceModeSelect = document.querySelector<HTMLSelectElement>(
  "#practice-mode-select",
);
const scaleModeNote =
  document.querySelector<HTMLParagraphElement>("#scale-mode-note");
const scaleHandsField =
  document.querySelector<HTMLLabelElement>("#scale-hands-field");
const scaleHandsSelect = document.querySelector<HTMLSelectElement>(
  "#scale-hands-select",
);
const scaleOctavesField = document.querySelector<HTMLLabelElement>(
  "#scale-octaves-field",
);
const scaleOctavesSelect = document.querySelector<HTMLSelectElement>(
  "#scale-octaves-select",
);
const rangeStartField =
  document.querySelector<HTMLLabelElement>("#range-start-field");
const rangeStartSelect = document.querySelector<HTMLSelectElement>(
  "#range-start-select",
);
const rangeEndField =
  document.querySelector<HTMLLabelElement>("#range-end-field");
const rangeEndSelect =
  document.querySelector<HTMLSelectElement>("#range-end-select");
const noteSourceField =
  document.querySelector<HTMLLabelElement>("#note-source-field");
const noteSourceSelect = document.querySelector<HTMLSelectElement>(
  "#note-source-select",
);
const accidentalSpellingSelect = document.querySelector<HTMLSelectElement>(
  "#accidental-spelling-select",
);
const accidentalSpellingField = document.querySelector<HTMLLabelElement>(
  "#accidental-spelling-field",
);
const tonicSelect = document.querySelector<HTMLSelectElement>("#tonic-select");
const scaleTypeSelect =
  document.querySelector<HTMLSelectElement>("#scale-type-select");
const settingsDebugToggle = document.querySelector<HTMLInputElement>(
  "#settings-debug-toggle",
);

if (
  !notation ||
  !midiInputSelect ||
  !midiDebug ||
  !settingsToggle ||
  !debugToggle ||
  !midiStatus ||
  !settingsBackdrop ||
  !settingsDrawer ||
  !settingsClose ||
  !practiceModeSelect ||
  !scaleHandsField ||
  !scaleHandsSelect ||
  !scaleOctavesField ||
  !scaleOctavesSelect ||
  !rangeStartField ||
  !rangeStartSelect ||
  !rangeEndField ||
  !rangeEndSelect ||
  !noteSourceField ||
  !noteSourceSelect ||
  !accidentalSpellingSelect ||
  !accidentalSpellingField ||
  !tonicSelect ||
  !scaleTypeSelect ||
  !settingsDebugToggle
) {
  throw new Error("Could not find app elements.");
}

const notationElement = notation;
const midiInputSelectElement = midiInputSelect;
const midiDebugElement = midiDebug;
const settingsToggleElement = settingsToggle;
const debugToggleElement = debugToggle;
const midiStatusElement = midiStatus;
const settingsBackdropElement = settingsBackdrop;
const settingsDrawerElement = settingsDrawer;
const settingsCloseElement = settingsClose;
const practiceModeSelectElement = practiceModeSelect;
const scaleHandsFieldElement = scaleHandsField;
const scaleHandsSelectElement = scaleHandsSelect;
const scaleOctavesFieldElement = scaleOctavesField;
const scaleOctavesSelectElement = scaleOctavesSelect;
const rangeStartFieldElement = rangeStartField;
const rangeStartSelectElement = rangeStartSelect;
const rangeEndFieldElement = rangeEndField;
const rangeEndSelectElement = rangeEndSelect;
const noteSourceFieldElement = noteSourceField;
const noteSourceSelectElement = noteSourceSelect;
const accidentalSpellingSelectElement = accidentalSpellingSelect;
const accidentalSpellingFieldElement = accidentalSpellingField;
const tonicSelectElement = tonicSelect;
const scaleTypeSelectElement = scaleTypeSelect;
const settingsDebugToggleElement = settingsDebugToggle;
let renderedAttemptFeedbackCount = 0;
let attemptTimer: ReturnType<typeof setTimeout> | null = null;
const pendingAttemptMidiNotes = new Set<number>();
const initialGenerationSettings: GenerationSettings = {
  practiceMode: "random-notes",
  scaleHands: "treble",
  scaleOctaves: 1,
  rangeStart: DEFAULT_RANGE_START,
  rangeEnd: DEFAULT_RANGE_END,
  noteSourceMode: "in-scale",
  accidentalSpellingMode: "sharps",
  tonic: "C",
  scaleType: "major",
};
const initialStoredSettings = loadStoredSettings();
const initialPromptQueue = createPromptQueue(PROMPT_QUEUE_LENGTH, {
  ...initialStoredSettings.generationSettings,
});

const state: AppState = {
  promptQueue: [...initialPromptQueue],
  currentPromptIndex: 0,
  lastAttemptResult: null,
  attemptFeedbackCount: 0,
  generationSettings: {
    ...initialStoredSettings.generationSettings,
  },
  isSettingsOpen: false,
  isDebugVisible: initialStoredSettings.isDebugVisible,
  midi: {
    status: "idle",
    deviceId: null,
    deviceName: null,
    availableInputs: [],
    heldKeys: [],
    heldNotes: [],
    lastEvent: null,
    errorMessage: null,
  },
};

notationElement.addEventListener("click", handlePromptAttempt);
const midiConnection = connectMidi(handleMidiStateChange, {
  onNoteOn: handleMidiNoteOn,
  preferredInputId: loadPreferredMidiDeviceId(),
});
midiInputSelectElement.addEventListener("change", handleMidiInputChange);
settingsToggleElement.addEventListener("click", toggleSettingsDrawer);
settingsCloseElement.addEventListener("click", closeSettingsDrawer);
settingsBackdropElement.addEventListener("click", closeSettingsDrawer);
debugToggleElement.addEventListener("click", toggleDebugPanel);
settingsDebugToggleElement.addEventListener("change", handleDebugToggleChange);
practiceModeSelectElement.addEventListener("change", handlePracticeModeChange);
scaleHandsSelectElement.addEventListener("change", handleScaleHandsChange);
scaleOctavesSelectElement.addEventListener("change", handleScaleOctavesChange);
rangeStartSelectElement.addEventListener("change", handleRangeStartChange);
rangeEndSelectElement.addEventListener("change", handleRangeEndChange);
noteSourceSelectElement.addEventListener("change", handleNoteSourceChange);
accidentalSpellingSelectElement.addEventListener(
  "change",
  handleAccidentalSpellingChange,
);
tonicSelectElement.addEventListener("change", handleTonicChange);
scaleTypeSelectElement.addEventListener("change", handleScaleTypeChange);

if (state.promptQueue.length === 0) {
  throw new Error("Prompt queue is empty.");
}

renderApp();

function renderApp() {
  notationElement.dataset.lastAttemptResult = state.lastAttemptResult ?? "none";
  notationElement.dataset.midiStatus = state.midi.status;
  notationElement.dataset.midiHeldKeys = state.midi.heldKeys.join(",");
  notationElement.title = [
    `MIDI: ${state.midi.status}`,
    `Device: ${state.midi.deviceName ?? "none"}`,
    `Held: ${state.midi.heldKeys.join(", ") || "none"}`,
  ].join("\n");
  renderMidiInputOptions();
  renderToolbar();
  renderSettingsDrawer();
  renderMidiDebug();
  updateAttemptFeedback();
  renderGrandStaff(notationElement, state);
}

function handleMidiStateChange(midiState: MidiState) {
  state.midi = midiState;
  renderApp();
}

function handleMidiInputChange() {
  if (!midiInputSelectElement.value) {
    return;
  }

  savePreferredMidiDeviceId(midiInputSelectElement.value);
  midiConnection.selectInput(midiInputSelectElement.value);
}

function renderMidiInputOptions() {
  midiInputSelectElement.replaceChildren();

  if (state.midi.availableInputs.length === 0) {
    const emptyOption = document.createElement("option");
    emptyOption.textContent = "No MIDI inputs";
    emptyOption.value = "";
    midiInputSelectElement.append(emptyOption);
    midiInputSelectElement.disabled = true;
    return;
  }

  midiInputSelectElement.disabled = false;

  for (const input of state.midi.availableInputs) {
    const option = document.createElement("option");
    option.value = input.id;
    option.textContent = input.name;
    option.selected = input.id === state.midi.deviceId;
    midiInputSelectElement.append(option);
  }
}

function renderToolbar() {
  midiStatusElement.textContent =
    `${state.midi.status} ${state.midi.deviceName ? `• ${state.midi.deviceName}` : ""}`.trim();
  debugToggleElement.textContent = state.isDebugVisible
    ? "Hide Debug"
    : "Show Debug";
  settingsToggleElement.setAttribute(
    "aria-expanded",
    String(state.isSettingsOpen),
  );
}

function renderSettingsDrawer() {
  settingsDrawerElement.classList.toggle("is-open", state.isSettingsOpen);
  settingsDrawerElement.setAttribute(
    "aria-hidden",
    String(!state.isSettingsOpen),
  );
  settingsBackdropElement.hidden = !state.isSettingsOpen;
  settingsBackdropElement.classList.toggle("is-open", state.isSettingsOpen);
  settingsDebugToggleElement.checked = state.isDebugVisible;
  practiceModeSelectElement.value = state.generationSettings.practiceMode;
  scaleHandsSelectElement.value = state.generationSettings.scaleHands;
  scaleOctavesSelectElement.value =
    state.generationSettings.scaleOctaves.toString();
  noteSourceSelectElement.value = state.generationSettings.noteSourceMode;
  accidentalSpellingSelectElement.value =
    state.generationSettings.accidentalSpellingMode;
  scaleTypeSelectElement.value = state.generationSettings.scaleType;
  const isRandomNotesMode =
    state.generationSettings.practiceMode === "random-notes";
  if (scaleModeNote) {
    scaleModeNote.hidden = isRandomNotesMode;
  }
  scaleHandsFieldElement.hidden = isRandomNotesMode;
  scaleOctavesFieldElement.hidden = isRandomNotesMode;
  rangeStartFieldElement.hidden = !isRandomNotesMode;
  rangeEndFieldElement.hidden = !isRandomNotesMode;
  noteSourceFieldElement.hidden = !isRandomNotesMode;
  accidentalSpellingFieldElement.hidden =
    !isRandomNotesMode ||
    state.generationSettings.noteSourceMode !== "chromatic";
  renderTonicOptions();
  renderRangeOptions();
}

function renderMidiDebug() {
  midiDebugElement.hidden = !state.isDebugVisible;

  const currentPrompt = state.promptQueue[state.currentPromptIndex] ?? null;
  const expectedMidiNotes = currentPrompt
    ? getPromptMidiNotes(currentPrompt)
    : [];
  const lastEvent = state.midi.lastEvent
    ? `${state.midi.lastEvent.type} ${state.midi.lastEvent.noteNumber} velocity ${state.midi.lastEvent.velocity}`
    : "none";
  const lines = [
    `Status: ${state.midi.status}`,
    `Device: ${state.midi.deviceName ?? "none"}`,
    `Practice mode: ${state.generationSettings.practiceMode}`,
    `Scale hands: ${state.generationSettings.scaleHands}`,
    `Scale octaves: ${state.generationSettings.scaleOctaves}`,
    `Note source: ${state.generationSettings.noteSourceMode}`,
    `Accidental spelling: ${state.generationSettings.accidentalSpellingMode}`,
    `Tonic: ${state.generationSettings.tonic}`,
    `Scale type: ${state.generationSettings.scaleType}`,
    `Key signature: ${getDerivedKeySignature(state.generationSettings)}`,
    `Range: ${formatKeyLabel(state.generationSettings.rangeStart)} to ${formatKeyLabel(state.generationSettings.rangeEnd)}`,
    `Held keys: ${state.midi.heldKeys.join(", ") || "none"}`,
    `Held notes: ${
      state.midi.heldNotes.map((note) => note.toString()).join(", ") || "none"
    }`,
    `Last event: ${lastEvent}`,
    `Pending attempt: ${
      [...pendingAttemptMidiNotes].map((note) => note.toString()).join(", ") ||
      "none"
    }`,
    `Current prompt: ${formatPromptSlot(currentPrompt)}`,
    `Expected MIDI: ${expectedMidiNotes.join(", ") || "none"}`,
    `Error: ${state.midi.errorMessage ?? "none"}`,
  ];

  midiDebugElement.textContent = lines.join("\n");
}

function renderRangeOptions() {
  renderRangeSelect(
    rangeStartSelectElement,
    state.generationSettings.rangeStart,
    "Lowest note",
  );
  renderRangeSelect(
    rangeEndSelectElement,
    state.generationSettings.rangeEnd,
    "Highest note",
  );
}

function renderTonicOptions() {
  tonicSelectElement.replaceChildren();

  for (const tonic of getTonicsForScaleType(
    state.generationSettings.scaleType,
  )) {
    const option = document.createElement("option");
    option.value = tonic;
    option.textContent = tonic;
    option.selected = tonic === state.generationSettings.tonic;
    tonicSelectElement.append(option);
  }
}

function renderRangeSelect(
  selectElement: HTMLSelectElement,
  selectedKey: string,
  labelPrefix: string,
) {
  selectElement.replaceChildren();

  for (const key of GENERATED_NOTE_POOL) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = formatKeyLabel(key);
    option.selected = key === selectedKey;
    selectElement.append(option);
  }

  selectElement.setAttribute(
    "aria-label",
    `${labelPrefix}: ${formatKeyLabel(selectedKey)}`,
  );
}

function updateAttemptFeedback() {
  if (
    !state.lastAttemptResult ||
    state.attemptFeedbackCount === renderedAttemptFeedbackCount
  ) {
    return;
  }

  renderedAttemptFeedbackCount = state.attemptFeedbackCount;
  notationElement.classList.remove("attempt-correct", "attempt-incorrect");
  void notationElement.offsetWidth;
  notationElement.classList.add(`attempt-${state.lastAttemptResult}`);
}

function handlePromptAttempt() {
  const currentPrompt = state.promptQueue[state.currentPromptIndex];

  if (!currentPrompt) {
    return;
  }

  const attempt = createFakeAttempt(currentPrompt);

  processPromptAttempt(currentPrompt, attempt);
}

function toggleSettingsDrawer() {
  state.isSettingsOpen = !state.isSettingsOpen;
  renderApp();
}

function closeSettingsDrawer() {
  state.isSettingsOpen = false;
  renderApp();
}

function toggleDebugPanel() {
  state.isDebugVisible = !state.isDebugVisible;
  saveStoredSettings();
  renderApp();
}

function handleDebugToggleChange() {
  state.isDebugVisible = settingsDebugToggleElement.checked;
  saveStoredSettings();
  renderApp();
}

function handlePracticeModeChange() {
  state.generationSettings.practiceMode =
    practiceModeSelectElement.value as PracticeMode;
  saveStoredSettings();
  resetPromptQueue();
}

function handleScaleHandsChange() {
  state.generationSettings.scaleHands =
    scaleHandsSelectElement.value as ScaleHands;
  saveStoredSettings();
  resetPromptQueue();
}

function handleScaleOctavesChange() {
  state.generationSettings.scaleOctaves = Number.parseInt(
    scaleOctavesSelectElement.value,
    10,
  ) as ScaleOctaves;
  saveStoredSettings();
  resetPromptQueue();
}

function handleRangeStartChange() {
  updateGenerationRange(
    rangeStartSelectElement.value,
    state.generationSettings.rangeEnd,
  );
}

function handleRangeEndChange() {
  updateGenerationRange(
    state.generationSettings.rangeStart,
    rangeEndSelectElement.value,
  );
}

function handleNoteSourceChange() {
  state.generationSettings.noteSourceMode =
    noteSourceSelectElement.value as NoteSourceMode;
  saveStoredSettings();
  resetPromptQueue();
}

function handleAccidentalSpellingChange() {
  state.generationSettings.accidentalSpellingMode =
    accidentalSpellingSelectElement.value as AccidentalSpellingMode;
  saveStoredSettings();
  resetPromptQueue();
}

function handleTonicChange() {
  state.generationSettings.tonic = tonicSelectElement.value as Tonic;
  saveStoredSettings();
  resetPromptQueue();
}

function handleScaleTypeChange() {
  state.generationSettings.scaleType =
    scaleTypeSelectElement.value as ScaleType;
  saveStoredSettings();
  resetPromptQueue();
}

function updateGenerationRange(nextStart: string, nextEnd: string) {
  const nextStartIndex = GENERATED_NOTE_POOL.indexOf(nextStart);
  const nextEndIndex = GENERATED_NOTE_POOL.indexOf(nextEnd);

  if (nextStartIndex === -1 || nextEndIndex === -1) {
    return;
  }

  if (nextStartIndex <= nextEndIndex) {
    state.generationSettings.rangeStart = nextStart;
    state.generationSettings.rangeEnd = nextEnd;
  } else {
    state.generationSettings.rangeStart = nextEnd;
    state.generationSettings.rangeEnd = nextStart;
  }

  saveStoredSettings();
  resetPromptQueue();
}

function createFakeAttempt(prompt: PromptSlot): PromptAttempt {
  return {
    midiNotes: getPromptMidiNotes(prompt),
  };
}

function isPromptMatch(prompt: PromptSlot, attempt: PromptAttempt) {
  const expectedMidiNotes = [...getPromptMidiNotes(prompt)].sort(
    (left, right) => left - right,
  );
  const attemptedMidiNotes = [...attempt.midiNotes].sort(
    (left, right) => left - right,
  );

  if (expectedMidiNotes.length !== attemptedMidiNotes.length) {
    return false;
  }

  return expectedMidiNotes.every(
    (noteNumber, index) => noteNumber === attemptedMidiNotes[index],
  );
}

function handleMidiNoteOn(noteNumber: number) {
  pendingAttemptMidiNotes.add(noteNumber);

  if (attemptTimer) {
    clearTimeout(attemptTimer);
  }

  attemptTimer = setTimeout(finalizeMidiAttempt, ATTEMPT_WINDOW_MS);
}

function finalizeMidiAttempt() {
  if (attemptTimer) {
    clearTimeout(attemptTimer);
    attemptTimer = null;
  }

  const currentPrompt = state.promptQueue[state.currentPromptIndex];

  if (!currentPrompt || pendingAttemptMidiNotes.size === 0) {
    pendingAttemptMidiNotes.clear();
    return;
  }

  const attempt: PromptAttempt = {
    midiNotes: [...pendingAttemptMidiNotes].sort((left, right) => left - right),
  };
  pendingAttemptMidiNotes.clear();

  processPromptAttempt(currentPrompt, attempt);
}

function processPromptAttempt(prompt: PromptSlot, attempt: PromptAttempt) {
  const isMatch = isPromptMatch(prompt, attempt);

  state.lastAttemptResult = isMatch ? "correct" : "incorrect";
  state.attemptFeedbackCount += 1;

  if (isMatch) {
    consumeCurrentPrompt();
    return;
  }

  renderApp();
}

function consumeCurrentPrompt() {
  if (state.promptQueue.length === 0) {
    return;
  }

  const consumedPrompt = state.promptQueue.splice(
    state.currentPromptIndex,
    1,
  )[0];
  state.currentPromptIndex = 0;

  if (state.generationSettings.practiceMode === "scales") {
    if (consumedPrompt) {
      state.promptQueue.push(consumedPrompt);
    }

    renderApp();
    return;
  }

  fillQueueToLength(
    state.promptQueue,
    PROMPT_QUEUE_LENGTH,
    state.generationSettings,
  );

  renderApp();
}

function resetPromptQueue() {
  if (attemptTimer) {
    clearTimeout(attemptTimer);
    attemptTimer = null;
  }

  pendingAttemptMidiNotes.clear();
  state.promptQueue = createPromptQueue(
    PROMPT_QUEUE_LENGTH,
    state.generationSettings,
  );
  state.currentPromptIndex = 0;
  renderApp();
}

function createRest(
  clef: "treble" | "bass",
  duration: string,
  isVisible = false,
) {
  const restKey = clef === "bass" ? "r/3" : "r/4";

  const rest = new StaveNote({
    clef,
    keys: [restKey],
    duration: `${duration}r`,
  });

  rest.renderOptions.draw = isVisible;

  return rest;
}

function createPromptStaveNote(
  clef: "treble" | "bass",
  keys: string[],
  duration: string,
  displayedKeySignature: KeySignature | null,
) {
  const note = new StaveNote({
    clef,
    keys,
    duration,
  });

  for (const [index, key] of keys.entries()) {
    const accidental = getRenderedAccidentalForKey(key, displayedKeySignature);

    if (accidental) {
      note.addModifier(new Accidental(accidental), index);
    }
  }

  return note;
}

function renderGrandStaff(container: HTMLDivElement, appState: AppState) {
  container.replaceChildren();

  const promptKeys = getPromptQueueKeys(appState.promptQueue);
  const topMidiNoteNumber = getHighestMidiNoteNumber(promptKeys) ?? 79;
  const bottomMidiNoteNumber = getLowestMidiNoteNumber(promptKeys) ?? 43;
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  const width = Math.max(520, Math.min(container.clientWidth, 760));
  const topOverflow = Math.max(0, topMidiNoteNumber - 79) * 6;
  const bottomOverflow = Math.max(0, 43 - bottomMidiNoteNumber) * 6;
  const staveTopY = 50 + topOverflow;
  const staveGap = 90;
  const bassStaveY = staveTopY + staveGap;
  const height = bassStaveY + 90 + bottomOverflow;

  renderer.resize(width, height);

  const context = renderer.getContext();
  const staveX = 110;
  const staveWidth = width - 150;
  const trebleStave = new Stave(staveX, staveTopY, staveWidth);
  const bassStave = new Stave(staveX, bassStaveY, staveWidth);
  const displayedKeySignature = getDisplayedKeySignature(appState);

  trebleStave.addClef("treble");
  bassStave.addClef("bass");

  if (displayedKeySignature) {
    trebleStave.addKeySignature(displayedKeySignature);
    bassStave.addKeySignature(displayedKeySignature);
  }

  trebleStave.setContext(context).draw();
  bassStave.setContext(context).draw();

  new StaveConnector(trebleStave, bassStave)
    .setType(StaveConnector.type.BRACE)
    .setContext(context)
    .draw();

  new StaveConnector(trebleStave, bassStave)
    .setType(StaveConnector.type.SINGLE_LEFT)
    .setContext(context)
    .draw();

  if (appState.promptQueue.length === 0) {
    return;
  }

  const trebleNotes: StaveNote[] = [];
  const bassNotes: StaveNote[] = [];

  for (const [index, prompt] of appState.promptQueue.entries()) {
    const displayedPrompt = getDisplayedPromptSlot(prompt, appState);
    const trebleNote = displayedPrompt.trebleKeys
      ? createPromptStaveNote(
          "treble",
          displayedPrompt.trebleKeys,
          displayedPrompt.duration,
          displayedKeySignature,
        )
      : createRest("treble", displayedPrompt.duration);
    const bassNote = displayedPrompt.bassKeys
      ? createPromptStaveNote(
          "bass",
          displayedPrompt.bassKeys,
          displayedPrompt.duration,
          displayedKeySignature,
        )
      : createRest("bass", displayedPrompt.duration);

    if (index === appState.currentPromptIndex) {
      trebleNote.setStyle({
        fillStyle: "#a6401f",
        strokeStyle: "#a6401f",
      });
      bassNote.setStyle({
        fillStyle: "#a6401f",
        strokeStyle: "#a6401f",
      });
    }

    trebleNotes.push(trebleNote);
    bassNotes.push(bassNote);
  }

  const trebleVoice = new Voice()
    .setMode(Voice.Mode.SOFT)
    .addTickables(trebleNotes);

  const bassVoice = new Voice()
    .setMode(Voice.Mode.SOFT)
    .addTickables(bassNotes);

  const formatter = new Formatter();

  formatter
    .joinVoices([trebleVoice])
    .joinVoices([bassVoice])
    .formatToStave([trebleVoice, bassVoice], trebleStave);

  trebleVoice.draw(context, trebleStave);
  bassVoice.draw(context, bassStave);
}

function getPromptQueueKeys(promptQueue: PromptSlot[]) {
  return promptQueue.flatMap((prompt) => {
    return [...(prompt.trebleKeys ?? []), ...(prompt.bassKeys ?? [])];
  });
}

function getHighestMidiNoteNumber(keys: string[]) {
  const midiNoteNumbers = keys.map(keyToMidiNoteNumber);

  if (midiNoteNumbers.length === 0) {
    return null;
  }

  return Math.max(...midiNoteNumbers);
}

function getLowestMidiNoteNumber(keys: string[]) {
  const midiNoteNumbers = keys.map(keyToMidiNoteNumber);

  if (midiNoteNumbers.length === 0) {
    return null;
  }

  return Math.min(...midiNoteNumbers);
}

function getDisplayedPromptSlot(
  prompt: PromptSlot,
  appState: AppState,
): PromptSlot {
  if (appState.generationSettings.practiceMode !== "scales") {
    return prompt;
  }

  const displayedTrebleKeys = [
    ...(prompt.trebleKeys ?? []),
    ...(prompt.bassKeys ?? []),
  ]
    .filter((key) => getClefForKey(key) === "treble")
    .sort(compareKeysByMidiNumber);
  const displayedBassKeys = [
    ...(prompt.trebleKeys ?? []),
    ...(prompt.bassKeys ?? []),
  ]
    .filter((key) => getClefForKey(key) === "bass")
    .sort(compareKeysByMidiNumber);

  return {
    duration: prompt.duration,
    trebleKeys:
      displayedTrebleKeys.length > 0 ? displayedTrebleKeys : undefined,
    bassKeys: displayedBassKeys.length > 0 ? displayedBassKeys : undefined,
  };
}

function getDisplayedKeySignature(appState: AppState) {
  if (
    appState.generationSettings.practiceMode === "random-notes" &&
    appState.generationSettings.noteSourceMode !== "in-scale"
  ) {
    return null;
  }

  return getDerivedKeySignature(appState.generationSettings);
}

function getPromptMidiNotes(prompt: PromptSlot) {
  return [...(prompt.trebleKeys ?? []), ...(prompt.bassKeys ?? [])].map(
    keyToMidiNoteNumber,
  );
}

function compareKeysByMidiNumber(left: string, right: string) {
  return keyToMidiNoteNumber(left) - keyToMidiNoteNumber(right);
}

function formatPromptSlot(prompt: PromptSlot | null) {
  if (!prompt) {
    return "none";
  }

  const parts = [];

  if (prompt.trebleKeys && prompt.trebleKeys.length > 0) {
    parts.push(`treble: ${prompt.trebleKeys.join(", ")}`);
  }

  if (prompt.bassKeys && prompt.bassKeys.length > 0) {
    parts.push(`bass: ${prompt.bassKeys.join(", ")}`);
  }

  return parts.join(" | ") || "none";
}

function keyToMidiNoteNumber(key: string) {
  const [noteName, octaveText] = key.split("/");

  if (!noteName || !octaveText) {
    throw new Error(`Invalid key format: ${key}`);
  }

  const naturalSemitone = getNaturalSemitoneForNoteName(noteName);
  const accidentalOffset = getAccidentalOffsetForNoteName(noteName);
  const octave = Number.parseInt(octaveText, 10);

  if (Number.isNaN(octave)) {
    throw new Error(`Invalid octave in key: ${key}`);
  }

  return (octave + 1) * 12 + naturalSemitone + accidentalOffset;
}

function getNaturalSemitoneForNoteName(noteName: string) {
  const baseNote = noteName.charAt(0).toLowerCase();
  const semitonesByName: Record<string, number> = {
    c: 0,
    d: 2,
    e: 4,
    f: 5,
    g: 7,
    a: 9,
    b: 11,
  };

  const semitone = semitonesByName[baseNote];

  if (semitone === undefined) {
    throw new Error(`Unsupported note name: ${noteName}`);
  }

  return semitone;
}

function getAccidentalOffsetForNoteName(noteName: string) {
  const accidentalText = noteName.slice(1);
  let accidentalOffset = 0;

  for (const character of accidentalText) {
    if (character === "#") {
      accidentalOffset += 1;
      continue;
    }

    if (character === "b") {
      accidentalOffset -= 1;
      continue;
    }

    throw new Error(`Unsupported accidental in note name: ${noteName}`);
  }

  return accidentalOffset;
}

function getRenderedAccidentalForKey(
  key: string,
  keySignature: KeySignature | null,
) {
  const [noteName] = key.split("/");

  if (!noteName) {
    return null;
  }

  const actualAccidental = noteName.slice(1);

  if (!keySignature) {
    return actualAccidental || null;
  }

  const impliedAccidentals = getKeySignatureAccidentals(keySignature);
  const impliedAccidental =
    impliedAccidentals[noteName.charAt(0).toLowerCase()] ?? "";

  if (actualAccidental === impliedAccidental) {
    return null;
  }

  if (!actualAccidental && impliedAccidental) {
    return "n";
  }

  return actualAccidental || null;
}

function getKeySignatureAccidentals(keySignature: KeySignature) {
  const accidentals: Record<string, string> = {};
  const sharpKeySignatureCount: Partial<Record<KeySignature, number>> = {
    G: 1,
    D: 2,
    A: 3,
    E: 4,
    B: 5,
    "F#": 6,
    "C#": 7,
  };
  const flatKeySignatureCount: Partial<Record<KeySignature, number>> = {
    F: 1,
    Bb: 2,
    Eb: 3,
    Ab: 4,
    Db: 5,
    Gb: 6,
    Cb: 7,
  };
  const sharpCount = sharpKeySignatureCount[keySignature] ?? 0;
  const flatCount = flatKeySignatureCount[keySignature] ?? 0;

  for (const noteName of SHARP_KEY_SIGNATURE_ORDER.slice(0, sharpCount)) {
    accidentals[noteName] = "#";
  }

  for (const noteName of FLAT_KEY_SIGNATURE_ORDER.slice(0, flatCount)) {
    accidentals[noteName] = "b";
  }

  return accidentals;
}

function getDerivedKeySignature(generationSettings: GenerationSettings) {
  if (generationSettings.scaleType === "major") {
    return MAJOR_KEY_SIGNATURE_BY_TONIC[generationSettings.tonic as MajorTonic];
  }

  return MINOR_KEY_SIGNATURE_BY_TONIC[generationSettings.tonic as MinorTonic];
}

function getTonicsForScaleType(scaleType: ScaleType): Tonic[] {
  if (scaleType === "major") {
    return MAJOR_TONICS;
  }

  return MINOR_TONICS;
}

function createKeyboardNotePool() {
  const notePool: string[] = [];

  for (
    let midiNoteNumber = KEYBOARD_START_MIDI_NOTE;
    midiNoteNumber <= KEYBOARD_END_MIDI_NOTE;
    midiNoteNumber += 1
  ) {
    notePool.push(midiNoteNumberToKey(midiNoteNumber, "sharps"));
  }

  return notePool;
}

function createPromptQueue(
  length: number,
  generationSettings: GenerationSettings,
) {
  if (generationSettings.practiceMode === "scales") {
    return createScalePracticeQueue(generationSettings);
  }

  const promptQueue: PromptSlot[] = [];

  fillQueueToLength(promptQueue, length, generationSettings);

  return promptQueue;
}

function fillQueueToLength(
  promptQueue: PromptSlot[],
  length: number,
  generationSettings: GenerationSettings,
) {
  if (generationSettings.practiceMode === "scales") {
    return;
  }

  while (promptQueue.length < length) {
    promptQueue.push(
      generatePrompt(promptQueue.at(-1) ?? null, generationSettings),
    );
  }
}

function generatePrompt(
  previousPrompt: PromptSlot | null,
  generationSettings: GenerationSettings,
): PromptSlot {
  const generatedNotePool = getAllowedGeneratedNotes(generationSettings);
  const previousKey =
    previousPrompt?.trebleKeys?.[0] ?? previousPrompt?.bassKeys?.[0] ?? null;
  const availableKeys = generatedNotePool.filter((key) => key !== previousKey);
  const key = pickRandomItem(
    availableKeys.length > 0 ? availableKeys : generatedNotePool,
  );

  if (getClefForKey(key) === "treble") {
    return {
      duration: "q",
      trebleKeys: [key],
    };
  }

  return {
    duration: "q",
    bassKeys: [key],
  };
}

function createScalePracticeQueue(generationSettings: GenerationSettings) {
  const trebleStartingOctave = getScaleStartingOctave(generationSettings.tonic);
  const trebleAscendingKeys = getAscendingScaleKeys(
    generationSettings.tonic,
    generationSettings.scaleType,
    trebleStartingOctave,
    generationSettings.scaleOctaves,
  );
  const bassAscendingKeys = getAscendingScaleKeys(
    generationSettings.tonic,
    generationSettings.scaleType,
    trebleStartingOctave - 1,
    generationSettings.scaleOctaves,
  );
  const ascendingPrompts = createScalePromptsForHands(
    trebleAscendingKeys,
    bassAscendingKeys,
    generationSettings.scaleHands,
  );
  const descendingPrompts = createScalePromptsForHands(
    [...trebleAscendingKeys].slice(0, -1).reverse(),
    [...bassAscendingKeys].slice(0, -1).reverse(),
    generationSettings.scaleHands,
  );

  return [...ascendingPrompts, ...descendingPrompts.slice(0, -1)];
}

function getScaleStartingOctave(tonic: Tonic) {
  return isTrebleScaleStartWithinUpperLimit(tonic.toLowerCase()) ? 4 : 3;
}

function isTrebleScaleStartWithinUpperLimit(noteName: string) {
  const baseLetter = noteName.charAt(0).toLowerCase();
  const accidentalOffset = getAccidentalOffsetForNoteName(noteName);
  const allowedBaseLetters = ["c", "d", "e"];

  if (allowedBaseLetters.includes(baseLetter)) {
    return true;
  }

  if (baseLetter === "f") {
    return accidentalOffset <= 1;
  }

  if (["g", "a", "b"].includes(baseLetter)) {
    return false;
  }

  throw new Error(`Unsupported tonic note name: ${noteName}`);
}

function getAscendingScaleKeys(
  tonic: Tonic,
  scaleType: ScaleType,
  startingOctave: number,
  scaleOctaves: ScaleOctaves,
) {
  const scaleNoteNames = getScaleNoteNames(tonic, scaleType);
  const ascendingNoteNames = Array.from({ length: scaleOctaves }).flatMap(
    () => {
      return scaleNoteNames;
    },
  );
  ascendingNoteNames.push(tonic.toLowerCase());
  const ascendingKeys: string[] = [];
  let currentOctave = startingOctave;
  let previousMidiNoteNumber = -Infinity;

  for (const noteName of ascendingNoteNames) {
    let key = `${noteName}/${currentOctave}`;
    let midiNoteNumber = keyToMidiNoteNumber(key);

    while (midiNoteNumber <= previousMidiNoteNumber) {
      currentOctave += 1;
      key = `${noteName}/${currentOctave}`;
      midiNoteNumber = keyToMidiNoteNumber(key);
    }

    ascendingKeys.push(key);
    previousMidiNoteNumber = midiNoteNumber;
  }

  return ascendingKeys;
}

function createScalePromptsForHands(
  trebleKeys: string[],
  bassKeys: string[],
  scaleHands: ScaleHands,
) {
  if (scaleHands === "treble") {
    return trebleKeys.map((key) => ({
      duration: "q",
      trebleKeys: [key],
    }));
  }

  if (scaleHands === "bass") {
    return bassKeys.map((key) => ({
      duration: "q",
      bassKeys: [key],
    }));
  }

  return trebleKeys.map((trebleKey, index) => {
    const bassKey = bassKeys[index];

    if (!bassKey) {
      throw new Error("Could not find matching bass scale note.");
    }

    return {
      duration: "q",
      trebleKeys: [trebleKey],
      bassKeys: [bassKey],
    };
  });
}

function getClefForKey(key: string): "treble" | "bass" {
  return keyToMidiNoteNumber(key) < 60 ? "bass" : "treble";
}

function getAllowedGeneratedNotes(generationSettings: GenerationSettings) {
  if (generationSettings.noteSourceMode === "in-scale") {
    return getNotesInScale(
      generationSettings.rangeStart,
      generationSettings.rangeEnd,
      generationSettings.tonic,
      generationSettings.scaleType,
    );
  }

  const notePoolInRange = getGeneratedNotePool(
    generationSettings.rangeStart,
    generationSettings.rangeEnd,
    generationSettings.accidentalSpellingMode,
  );

  return notePoolInRange;
}

function getNotesInScale(
  rangeStart: string,
  rangeEnd: string,
  tonic: Tonic,
  scaleType: ScaleType,
) {
  const startMidiNoteNumber = keyToMidiNoteNumber(rangeStart);
  const endMidiNoteNumber = keyToMidiNoteNumber(rangeEnd);
  const scaleNoteNames = getScaleNoteNames(tonic, scaleType);
  const notesInKey: Array<{ key: string; midiNoteNumber: number }> = [];

  for (
    let octave = getOctaveForKey(rangeStart) - 1;
    octave <= getOctaveForKey(rangeEnd) + 1;
    octave += 1
  ) {
    for (const noteName of scaleNoteNames) {
      const key = `${noteName}/${octave}`;
      const midiNoteNumber = keyToMidiNoteNumber(key);

      if (
        midiNoteNumber < startMidiNoteNumber ||
        midiNoteNumber > endMidiNoteNumber
      ) {
        continue;
      }

      notesInKey.push({
        key,
        midiNoteNumber,
      });
    }
  }

  notesInKey.sort((left, right) => left.midiNoteNumber - right.midiNoteNumber);

  return notesInKey.map((note) => note.key);
}

function getScaleNoteNames(tonic: Tonic, scaleType: ScaleType) {
  const tonicNoteName = tonic.toLowerCase();
  const tonicMidiNoteNumber = keyToMidiNoteNumber(`${tonicNoteName}/4`);
  const letterSequence = getScaleLetterSequence(tonicNoteName.charAt(0));
  const semitoneOffsetsByScaleType: Record<ScaleType, number[]> = {
    major: [0, 2, 4, 5, 7, 9, 11],
    "natural-minor": [0, 2, 3, 5, 7, 8, 10],
    "harmonic-minor": [0, 2, 3, 5, 7, 8, 11],
    "melodic-minor": [0, 2, 3, 5, 7, 9, 11],
  };

  return semitoneOffsetsByScaleType[scaleType].map((semitoneOffset, index) => {
    const targetPitchClass = (tonicMidiNoteNumber + semitoneOffset) % 12;
    const letterName = letterSequence[index];

    if (!letterName) {
      throw new Error("Could not determine scale letter.");
    }

    return getSpelledNoteName(letterName, targetPitchClass);
  });
}

function getScaleLetterSequence(startLetter: string) {
  const noteLetters = ["c", "d", "e", "f", "g", "a", "b"];
  const startIndex = noteLetters.indexOf(startLetter.toLowerCase());

  if (startIndex === -1) {
    throw new Error(`Unsupported tonic letter: ${startLetter}`);
  }

  return Array.from({ length: 7 }, (_, index) => {
    return noteLetters[(startIndex + index) % noteLetters.length];
  });
}

function getSpelledNoteName(letterName: string, targetPitchClass: number) {
  const naturalPitchClass = getNaturalSemitoneForNoteName(letterName);

  for (const accidentalOffset of [-2, -1, 0, 1, 2]) {
    if ((naturalPitchClass + accidentalOffset + 12) % 12 !== targetPitchClass) {
      continue;
    }

    return `${letterName}${getAccidentalText(accidentalOffset)}`;
  }

  throw new Error(
    `Could not spell note for ${letterName} at ${targetPitchClass}.`,
  );
}

function getAccidentalText(accidentalOffset: number) {
  if (accidentalOffset > 0) {
    return "#".repeat(accidentalOffset);
  }

  if (accidentalOffset < 0) {
    return "b".repeat(Math.abs(accidentalOffset));
  }

  return "";
}

function getGeneratedNotePool(
  rangeStart: string,
  rangeEnd: string,
  accidentalSpellingMode: AccidentalSpellingMode,
) {
  const startIndex = GENERATED_NOTE_POOL.indexOf(rangeStart);
  const endIndex = GENERATED_NOTE_POOL.indexOf(rangeEnd);

  if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
    throw new Error("Invalid generated note range.");
  }

  return GENERATED_NOTE_POOL.slice(startIndex, endIndex + 1).map((key) =>
    midiNoteNumberToKey(keyToMidiNoteNumber(key), accidentalSpellingMode),
  );
}

function pickRandomItem<Item>(items: Item[]) {
  const randomIndex = Math.floor(Math.random() * items.length);
  const item = items[randomIndex];

  if (item === undefined) {
    throw new Error("Cannot pick a random item from an empty list.");
  }

  return item;
}

function getOctaveForKey(key: string) {
  const [, octaveText] = key.split("/");

  if (!octaveText) {
    throw new Error(`Invalid key format: ${key}`);
  }

  const octave = Number.parseInt(octaveText, 10);

  if (Number.isNaN(octave)) {
    throw new Error(`Invalid octave in key: ${key}`);
  }

  return octave;
}

function formatKeyLabel(key: string) {
  const [noteName, octaveText] = key.split("/");

  if (!noteName || !octaveText) {
    return key;
  }

  const firstCharacter = noteName.charAt(0).toUpperCase();
  const accidental = noteName.slice(1);

  return `${firstCharacter}${accidental}${octaveText}`;
}

function midiNoteNumberToKey(
  noteNumber: number,
  accidentalSpellingMode: AccidentalSpellingMode,
) {
  const sharpNoteNames = [
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
  const flatNoteNames = [
    "c",
    "db",
    "d",
    "eb",
    "e",
    "f",
    "gb",
    "g",
    "ab",
    "a",
    "bb",
    "b",
  ];
  const noteNames =
    accidentalSpellingMode === "flats" ? flatNoteNames : sharpNoteNames;
  const noteName = noteNames[noteNumber % 12];
  const octave = Math.floor(noteNumber / 12) - 1;

  if (!noteName) {
    throw new Error(`Invalid MIDI note number: ${noteNumber}`);
  }

  return `${noteName}/${octave}`;
}

function loadPreferredMidiDeviceId() {
  try {
    return localStorage.getItem(MIDI_DEVICE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function savePreferredMidiDeviceId(deviceId: string) {
  try {
    localStorage.setItem(MIDI_DEVICE_STORAGE_KEY, deviceId);
  } catch {
    // Ignore storage issues and continue without persistence.
  }
}

function loadStoredSettings() {
  try {
    const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);

    if (!storedSettings) {
      return {
        generationSettings: {
          ...initialGenerationSettings,
        },
        isDebugVisible: false,
      };
    }

    const parsedSettings = JSON.parse(storedSettings);
    const storedGenerationSettings = parsedSettings?.generationSettings;

    return {
      generationSettings: {
        ...initialGenerationSettings,
        ...storedGenerationSettings,
      },
      isDebugVisible:
        typeof parsedSettings?.isDebugVisible === "boolean"
          ? parsedSettings.isDebugVisible
          : false,
    };
  } catch {
    return {
      generationSettings: {
        ...initialGenerationSettings,
      },
      isDebugVisible: false,
    };
  }
}

function saveStoredSettings() {
  try {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        generationSettings: state.generationSettings,
        isDebugVisible: state.isDebugVisible,
      }),
    );
  } catch {
    // Ignore storage issues and continue without persistence.
  }
}
