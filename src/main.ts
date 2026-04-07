import "./styles.css";
import {
  Accidental,
  ClefNote,
  Formatter,
  ModifierContext,
  NoteSubGroup,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  TextBracket,
  Voice,
} from "vexflow";
import { renderInputNameDisplay } from "./display/inputName";
import { renderKeyboardDisplay } from "./display/keyboard";
import {
  createExercisePromptQueue,
  fillExercisePromptQueue,
} from "./exercises";
import type { PromptSlot } from "./exercises/types";
import { analyzeHeldInput } from "./inputAnalysis";
import { connectMidi, type MidiState } from "./midi";
import {
  type AccidentalSpellingMode,
  compareKeysByMidiNumber,
  createKeyboardNotePool,
  formatKeyLabel,
  type GenerationSettings,
  getAllTonics,
  getClefForKey,
  getDerivedKeySignature,
  getHeldOverlayKey,
  getPracticalTonic,
  getRenderedAccidentalForKey,
  getScaleRenderingNotice,
  getTriadRenderingNotice,
  type KeySignature,
  keyToMidiNoteNumber,
  type NoteSourceMode,
  type PracticeMode,
  type ScaleHands,
  type ScaleOctaves,
  type ScaleType,
  type Tonic,
  type TriadType,
} from "./music";

const DEFAULT_ATTEMPT_WINDOW_MS = 40;
const MIN_ATTEMPT_WINDOW_MS = 10;
const MAX_ATTEMPT_WINDOW_MS = 250;
const MIDI_DEVICE_STORAGE_KEY = "piano-tool-midi-device-id";
const SETTINGS_STORAGE_KEY = "piano-tool-settings";
const PROMPT_QUEUE_LENGTH = 8;
const KEYBOARD_START_MIDI_NOTE = 21;
const KEYBOARD_END_MIDI_NOTE = 108;
const STAGE_WIDTH = 1280;
const STAGE_HEIGHT = 720;
const STAGE_HORIZONTAL_PADDING = 0;
const STAGE_VERTICAL_PADDING = 4;
const DEFAULT_RENDER_HEIGHT = 340;
const DEFAULT_TOP_VISIBLE_MIDI_NOTE = 84;
const DEFAULT_BOTTOM_VISIBLE_MIDI_NOTE = 36;
const SCALE_TOP_VISIBLE_MIDI_NOTE = 90;
const SCALE_BOTTOM_VISIBLE_MIDI_NOTE = 44;
const MIDI_OVERFLOW_PIXELS = 4;
const STAVE_GAP = 76;
const STAVE_CONNECTOR_THICKNESS = 3;
const STAVE_SIDE_MARGIN = 56;
const STAVE_REFERENCE = new Stave(0, 0, 0);
const STAVE_BRACE_TOP_OFFSET = STAVE_REFERENCE.getYForLine(0);
const STAVE_BRACE_BOTTOM_OFFSET =
  STAVE_GAP +
  STAVE_REFERENCE.getYForLine(STAVE_REFERENCE.getNumLines() - 1) +
  STAVE_CONNECTOR_THICKNESS;
const STAVE_BRACE_CENTER_OFFSET =
  (STAVE_BRACE_TOP_OFFSET + STAVE_BRACE_BOTTOM_OFFSET) / 2;
const STAVE_VERTICAL_OPTICAL_OFFSET = 1;
const GENERATED_NOTE_POOL = createKeyboardNotePool(
  KEYBOARD_START_MIDI_NOTE,
  KEYBOARD_END_MIDI_NOTE,
);
const DEFAULT_RANGE_START = "c/2";
const DEFAULT_RANGE_END = "c/6";

type PromptAttempt = {
  midiNotes: number[];
};

type AttemptResult = "correct" | "incorrect" | null;

type AppState = {
  promptQueue: PromptSlot[];
  currentPromptIndex: number;
  lastAttemptResult: AttemptResult;
  attemptFeedbackCount: number;
  attemptWindowMs: number;
  generationSettings: GenerationSettings;
  isSettingsOpen: boolean;
  isDebugVisible: boolean;
  isExerciseVisible: boolean;
  isInputNameVisible: boolean;
  isKeyboardVisible: boolean;
  midi: MidiState;
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Could not find app container.");
}

app.innerHTML = `
  <div class="stage-shell">
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
        <label class="attempt-window-picker">
          <span>Chord window</span>
          <input
            id="attempt-window-input"
            type="number"
            min="${MIN_ATTEMPT_WINDOW_MS}"
            max="${MAX_ATTEMPT_WINDOW_MS}"
            step="5"
          />
          <span>ms</span>
        </label>
        <div id="midi-status" class="status-pill"></div>
      </header>

      <section class="practice-area">
        <div id="input-name-display" class="input-name-display" hidden></div>
        <div id="notation" class="notation">
          <div id="exercise-notice" class="exercise-notice" hidden></div>
          <div id="notation-canvas" class="notation-canvas"></div>
        </div>
        <div id="keyboard-display" class="keyboard-display" hidden></div>
      </section>
    </main>
  </div>

  <div id="midi-debug" class="midi-debug" hidden></div>

  <div id="settings-backdrop" class="settings-backdrop" hidden></div>

  <aside
    id="settings-drawer"
    class="settings-drawer"
    aria-hidden="true"
    aria-label="Settings"
  >
    <div class="settings-header">
      <h2>Display Settings</h2>
      <button id="settings-close" class="toolbar-button" type="button">
        Close
      </button>
    </div>

    <section class="settings-section">
      <label class="settings-toggle">
        <input id="settings-exercise-toggle" type="checkbox" />
        <span>Show exercise options</span>
      </label>
      <label class="settings-toggle">
        <input id="settings-input-name-toggle" type="checkbox" />
        <span>Show input name</span>
      </label>
      <label class="settings-toggle">
        <input id="settings-keyboard-toggle" type="checkbox" />
        <span>Show keyboard</span>
      </label>
    </section>

    <section class="settings-section">
      <h3 id="exercise-settings-heading">Exercise Settings</h3>
      <label class="settings-field">
        <span>Practice mode</span>
        <select id="practice-mode-select">
          <option value="random-notes">Random notes</option>
          <option value="scales">Scales</option>
          <option value="triads">Triads</option>
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
      <label id="triad-type-field" class="settings-field" hidden>
        <span>Triad type</span>
        <select id="triad-type-select">
          <option value="major">Major</option>
          <option value="minor">Minor</option>
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
  </aside>
`;

const practiceArea = document.querySelector<HTMLElement>(".practice-area");
const notation = document.querySelector<HTMLDivElement>("#notation");
const exerciseNotice =
  document.querySelector<HTMLDivElement>("#exercise-notice");
const notationCanvas =
  document.querySelector<HTMLDivElement>("#notation-canvas");
const inputNameDisplay = document.querySelector<HTMLDivElement>(
  "#input-name-display",
);
const keyboardDisplay =
  document.querySelector<HTMLDivElement>("#keyboard-display");
const midiInputSelect =
  document.querySelector<HTMLSelectElement>("#midi-input-select");
const attemptWindowInput = document.querySelector<HTMLInputElement>(
  "#attempt-window-input",
);
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
const triadTypeField =
  document.querySelector<HTMLLabelElement>("#triad-type-field");
const triadTypeSelect =
  document.querySelector<HTMLSelectElement>("#triad-type-select");
const settingsExerciseToggle = document.querySelector<HTMLInputElement>(
  "#settings-exercise-toggle",
);
const exerciseSettingsHeading = document.querySelector<HTMLHeadingElement>(
  "#exercise-settings-heading",
);
const settingsKeyboardToggle = document.querySelector<HTMLInputElement>(
  "#settings-keyboard-toggle",
);
const settingsInputNameToggle = document.querySelector<HTMLInputElement>(
  "#settings-input-name-toggle",
);

if (
  !practiceArea ||
  !notation ||
  !exerciseNotice ||
  !notationCanvas ||
  !inputNameDisplay ||
  !keyboardDisplay ||
  !midiInputSelect ||
  !attemptWindowInput ||
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
  !triadTypeField ||
  !triadTypeSelect ||
  !settingsExerciseToggle ||
  !exerciseSettingsHeading ||
  !settingsKeyboardToggle ||
  !settingsInputNameToggle
) {
  throw new Error("Could not find app elements.");
}

const practiceAreaElement = practiceArea;
const notationElement = notation;
const exerciseNoticeElement = exerciseNotice;
const notationCanvasElement = notationCanvas;
const inputNameDisplayElement = inputNameDisplay;
const keyboardDisplayElement = keyboardDisplay;
const midiInputSelectElement = midiInputSelect;
const attemptWindowInputElement = attemptWindowInput;
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
const triadTypeFieldElement = triadTypeField;
const triadTypeSelectElement = triadTypeSelect;
const settingsExerciseToggleElement = settingsExerciseToggle;
const exerciseSettingsHeadingElement = exerciseSettingsHeading;
const settingsKeyboardToggleElement = settingsKeyboardToggle;
const settingsInputNameToggleElement = settingsInputNameToggle;
const practiceModeField = practiceModeSelectElement.parentElement;
const tonicField = tonicSelectElement.parentElement;
const scaleTypeField = scaleTypeSelectElement.parentElement;

if (!practiceModeField || !tonicField || !scaleTypeField) {
  throw new Error("Could not find settings field elements.");
}

const practiceModeFieldElement = practiceModeField;
const tonicFieldElement = tonicField;
const scaleTypeFieldElement = scaleTypeField;

let renderedAttemptFeedbackCount = 0;
let attemptTimer: ReturnType<typeof setTimeout> | null = null;
const pendingAttemptMidiNotes = new Set<number>();
const initialGenerationSettings: GenerationSettings = {
  practiceMode: "scales",
  scaleHands: "together",
  scaleOctaves: 2,
  rangeStart: DEFAULT_RANGE_START,
  rangeEnd: DEFAULT_RANGE_END,
  noteSourceMode: "in-scale",
  accidentalSpellingMode: "sharps",
  tonic: "C",
  scaleType: "major",
  triadType: "major",
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
  attemptWindowMs: initialStoredSettings.attemptWindowMs,
  generationSettings: {
    ...initialStoredSettings.generationSettings,
  },
  isSettingsOpen: false,
  isDebugVisible: initialStoredSettings.isDebugVisible,
  isExerciseVisible: initialStoredSettings.isExerciseVisible,
  isInputNameVisible: initialStoredSettings.isInputNameVisible,
  isKeyboardVisible: initialStoredSettings.isKeyboardVisible,
  midi: {
    status: "idle",
    deviceId: null,
    deviceName: null,
    availableInputs: [],
    sustainPedalDown: false,
    heldKeys: [],
    heldNotes: [],
    analysisHeldKeys: [],
    analysisHeldNotes: [],
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
attemptWindowInputElement.addEventListener("change", handleAttemptWindowChange);
settingsToggleElement.addEventListener("click", toggleSettingsDrawer);
settingsCloseElement.addEventListener("click", closeSettingsDrawer);
settingsBackdropElement.addEventListener("click", closeSettingsDrawer);
debugToggleElement.addEventListener("click", toggleDebugPanel);
settingsExerciseToggleElement.addEventListener(
  "change",
  handleExerciseToggleChange,
);
settingsInputNameToggleElement.addEventListener(
  "change",
  handleInputNameToggleChange,
);
settingsKeyboardToggleElement.addEventListener(
  "change",
  handleKeyboardToggleChange,
);
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
triadTypeSelectElement.addEventListener("change", handleTriadTypeChange);
window.addEventListener("resize", handleWindowResize);

if (state.promptQueue.length === 0) {
  throw new Error("Prompt queue is empty.");
}

renderApp();

function renderApp() {
  const stageScale = getStageScale();
  document.documentElement.style.setProperty(
    "--stage-scale",
    stageScale.toFixed(3),
  );
  document.documentElement.style.setProperty(
    "--stage-shell-padding-inline",
    `${(STAGE_HORIZONTAL_PADDING * stageScale).toFixed(2)}px`,
  );
  document.documentElement.style.setProperty(
    "--stage-shell-padding-block",
    `${(STAGE_VERTICAL_PADDING * stageScale).toFixed(2)}px`,
  );

  notationElement.dataset.lastAttemptResult = state.lastAttemptResult ?? "none";
  notationElement.dataset.midiStatus = state.midi.status;
  notationElement.dataset.midiHeldKeys = state.midi.heldKeys.join(",");
  notationElement.title = [
    `MIDI: ${state.midi.status}`,
    `Device: ${state.midi.deviceName ?? "none"}`,
    `Held: ${state.midi.heldKeys.join(", ") || "none"}`,
  ].join("\n");
  practiceAreaElement.dataset.exerciseVisible = String(state.isExerciseVisible);
  practiceAreaElement.dataset.keyboardVisible = String(state.isKeyboardVisible);
  practiceAreaElement.dataset.inputNameVisible = String(
    state.isInputNameVisible,
  );
  practiceAreaElement.dataset.debugVisible = String(state.isDebugVisible);
  renderMidiInputOptions();
  renderToolbar();
  renderSettingsDrawer();
  renderMidiDebug();
  renderExerciseNotice();
  renderInputName();
  renderNotation();
  renderKeyboard();
}

function handleWindowResize() {
  renderApp();
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
  attemptWindowInputElement.value = state.attemptWindowMs.toString();
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
  settingsExerciseToggleElement.checked = state.isExerciseVisible;
  settingsInputNameToggleElement.checked = state.isInputNameVisible;
  settingsKeyboardToggleElement.checked = state.isKeyboardVisible;
  practiceModeSelectElement.value = state.generationSettings.practiceMode;
  scaleHandsSelectElement.value = state.generationSettings.scaleHands;
  scaleOctavesSelectElement.value =
    state.generationSettings.scaleOctaves.toString();
  noteSourceSelectElement.value = state.generationSettings.noteSourceMode;
  accidentalSpellingSelectElement.value =
    state.generationSettings.accidentalSpellingMode;
  scaleTypeSelectElement.value = state.generationSettings.scaleType;
  triadTypeSelectElement.value = state.generationSettings.triadType;
  const isRandomNotesMode =
    state.generationSettings.practiceMode === "random-notes";
  const isScalesMode = state.generationSettings.practiceMode === "scales";
  const isTriadsMode = state.generationSettings.practiceMode === "triads";
  const areExerciseSettingsVisible = state.isExerciseVisible;
  if (scaleModeNote) {
    scaleModeNote.hidden = !areExerciseSettingsVisible || isRandomNotesMode;
  }
  exerciseSettingsHeadingElement.hidden = !areExerciseSettingsVisible;
  practiceModeFieldElement.hidden = !areExerciseSettingsVisible;
  scaleHandsFieldElement.hidden =
    !areExerciseSettingsVisible || isRandomNotesMode;
  scaleOctavesFieldElement.hidden =
    !areExerciseSettingsVisible || isRandomNotesMode;
  rangeStartFieldElement.hidden =
    !areExerciseSettingsVisible || !isRandomNotesMode;
  rangeEndFieldElement.hidden =
    !areExerciseSettingsVisible || !isRandomNotesMode;
  tonicFieldElement.hidden = !areExerciseSettingsVisible;
  scaleTypeFieldElement.hidden = !areExerciseSettingsVisible || !isScalesMode;
  triadTypeFieldElement.hidden = !areExerciseSettingsVisible || !isTriadsMode;
  noteSourceFieldElement.hidden =
    !areExerciseSettingsVisible || !isRandomNotesMode;
  accidentalSpellingFieldElement.hidden =
    !areExerciseSettingsVisible ||
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
    `Sustain pedal: ${state.midi.sustainPedalDown ? "down" : "up"}`,
    `Practice mode: ${state.generationSettings.practiceMode}`,
    `Scale hands: ${state.generationSettings.scaleHands}`,
    `Scale octaves: ${state.generationSettings.scaleOctaves}`,
    `Note source: ${state.generationSettings.noteSourceMode}`,
    `Accidental spelling: ${state.generationSettings.accidentalSpellingMode}`,
    `Tonic: ${state.generationSettings.tonic}`,
    `Scale type: ${state.generationSettings.scaleType}`,
    `Triad type: ${state.generationSettings.triadType}`,
    `Attempt window: ${state.attemptWindowMs}ms`,
    `Key signature: ${getDerivedKeySignature(state.generationSettings)}`,
    `Range: ${formatKeyLabel(state.generationSettings.rangeStart)} to ${formatKeyLabel(state.generationSettings.rangeEnd)}`,
    `Held keys: ${state.midi.heldKeys.join(", ") || "none"}`,
    `Held notes: ${
      state.midi.heldNotes.map((note) => note.toString()).join(", ") || "none"
    }`,
    `Analysis held keys: ${state.midi.analysisHeldKeys.join(", ") || "none"}`,
    `Analysis held notes: ${
      state.midi.analysisHeldNotes.map((note) => note.toString()).join(", ") ||
      "none"
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

function renderExerciseNotice() {
  let exerciseNotice: string | null = null;

  if (state.isExerciseVisible) {
    if (state.generationSettings.practiceMode === "scales") {
      exerciseNotice = getScaleRenderingNotice(state.generationSettings);
    } else if (state.generationSettings.practiceMode === "triads") {
      exerciseNotice = getTriadRenderingNotice(state.generationSettings);
    } else if (state.generationSettings.noteSourceMode === "in-scale") {
      exerciseNotice = getScaleRenderingNotice(state.generationSettings);
    }
  }

  notationElement.dataset.exerciseNoticeVisible = String(
    Boolean(exerciseNotice),
  );
  exerciseNoticeElement.hidden = !exerciseNotice;
  exerciseNoticeElement.textContent = exerciseNotice ?? "";
}

function renderNotation() {
  notationElement.hidden = !state.isExerciseVisible;

  if (!state.isExerciseVisible) {
    notationCanvasElement.replaceChildren();
    return;
  }

  renderGrandStaff(notationCanvasElement, state);
}

function renderKeyboard() {
  keyboardDisplayElement.hidden = !state.isKeyboardVisible;

  if (!state.isKeyboardVisible) {
    keyboardDisplayElement.replaceChildren();
    return;
  }

  const currentPrompt = state.promptQueue[state.currentPromptIndex];

  renderKeyboardDisplay(keyboardDisplayElement, {
    activeNotes:
      state.isExerciseVisible && currentPrompt
        ? getPromptMidiNotes(currentPrompt)
        : [],
    heldNotes: state.midi.heldNotes,
    startMidiNote: KEYBOARD_START_MIDI_NOTE,
    endMidiNote: KEYBOARD_END_MIDI_NOTE,
  });
}

function renderInputName() {
  inputNameDisplayElement.hidden = !state.isInputNameVisible;

  if (!state.isInputNameVisible) {
    inputNameDisplayElement.replaceChildren();
    return;
  }

  const analysis = analyzeHeldInput(state.midi.analysisHeldNotes);

  renderInputNameDisplay(inputNameDisplayElement, analysis);
}

function getStageScale() {
  const totalLogicalWidth = STAGE_WIDTH + STAGE_HORIZONTAL_PADDING * 2;
  const totalLogicalHeight = STAGE_HEIGHT + STAGE_VERTICAL_PADDING * 2;

  return Math.max(
    0.5,
    Math.min(
      window.innerWidth / totalLogicalWidth,
      window.innerHeight / totalLogicalHeight,
    ),
  );
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

  for (const tonic of getAllTonics()) {
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

function handleKeyboardToggleChange() {
  state.isKeyboardVisible = settingsKeyboardToggleElement.checked;
  saveStoredSettings();
  renderApp();
}

function handleExerciseToggleChange() {
  state.isExerciseVisible = settingsExerciseToggleElement.checked;
  saveStoredSettings();
  renderApp();
}

function handleInputNameToggleChange() {
  state.isInputNameVisible = settingsInputNameToggleElement.checked;
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

function handleTriadTypeChange() {
  state.generationSettings.triadType =
    triadTypeSelectElement.value as TriadType;
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

  attemptTimer = setTimeout(finalizeMidiAttempt, state.attemptWindowMs);
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

  if (
    state.generationSettings.practiceMode === "scales" ||
    state.generationSettings.practiceMode === "triads"
  ) {
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

function clampAttemptWindowMs(value: number) {
  return Math.min(
    MAX_ATTEMPT_WINDOW_MS,
    Math.max(MIN_ATTEMPT_WINDOW_MS, value),
  );
}

function handleAttemptWindowChange() {
  const parsedValue = Number.parseInt(attemptWindowInputElement.value, 10);
  const nextAttemptWindowMs = Number.isNaN(parsedValue)
    ? DEFAULT_ATTEMPT_WINDOW_MS
    : clampAttemptWindowMs(parsedValue);

  state.attemptWindowMs = nextAttemptWindowMs;
  attemptWindowInputElement.value = nextAttemptWindowMs.toString();
  saveStoredSettings();
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
  inlineClefChangeBefore?: "treble" | "bass",
) {
  const note = new StaveNote({
    clef,
    keys,
    duration,
  });

  if (inlineClefChangeBefore) {
    note.addModifier(
      new NoteSubGroup([new ClefNote(inlineClefChangeBefore, "small")]),
      0,
    );
  }

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
  const defaultTopVisibleMidiNote =
    appState.generationSettings.practiceMode === "scales" ||
    appState.generationSettings.practiceMode === "triads"
      ? SCALE_TOP_VISIBLE_MIDI_NOTE
      : DEFAULT_TOP_VISIBLE_MIDI_NOTE;
  const defaultBottomVisibleMidiNote =
    appState.generationSettings.practiceMode === "scales" ||
    appState.generationSettings.practiceMode === "triads"
      ? SCALE_BOTTOM_VISIBLE_MIDI_NOTE
      : DEFAULT_BOTTOM_VISIBLE_MIDI_NOTE;
  const topMidiNoteNumber =
    getHighestMidiNoteNumber(promptKeys) ?? defaultTopVisibleMidiNote;
  const bottomMidiNoteNumber =
    getLowestMidiNoteNumber(promptKeys) ?? defaultBottomVisibleMidiNote;
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  const width = Math.max(640, container.clientWidth - 8);
  const topOverflow =
    Math.max(0, topMidiNoteNumber - defaultTopVisibleMidiNote) *
    MIDI_OVERFLOW_PIXELS;
  const bottomOverflow =
    Math.max(0, defaultBottomVisibleMidiNote - bottomMidiNoteNumber) *
    MIDI_OVERFLOW_PIXELS;
  const systemHeight = STAVE_GAP + 92;
  const contentHeight = systemHeight + topOverflow + bottomOverflow;
  const availableHeight =
    container.clientHeight > 0 ? container.clientHeight : DEFAULT_RENDER_HEIGHT;
  const height = Math.max(availableHeight, contentHeight);
  const centeredBraceTopY =
    height / 2 - STAVE_BRACE_CENTER_OFFSET + STAVE_VERTICAL_OPTICAL_OFFSET;
  const minStaveTopY = topOverflow;
  const maxStaveTopY = Math.max(
    minStaveTopY,
    height - (systemHeight + bottomOverflow),
  );
  const staveTopY = Math.min(
    maxStaveTopY,
    Math.max(minStaveTopY, centeredBraceTopY),
  );
  const bassStaveY = staveTopY + STAVE_GAP;

  renderer.resize(width, height);

  const context = renderer.getContext();
  const staveX = STAVE_SIDE_MARGIN;
  const staveWidth = width - STAVE_SIDE_MARGIN * 2;
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

  const displayedPrompts = appState.promptQueue.map((prompt) =>
    getDisplayedPromptSlot(prompt, appState),
  );
  const trebleNotes: StaveNote[] = [];
  const bassNotes: StaveNote[] = [];
  let currentTrebleTickable: StaveNote | null = null;
  let currentBassTickable: StaveNote | null = null;
  let currentTreblePromptNote: StaveNote | null = null;
  let currentBassPromptNote: StaveNote | null = null;
  const currentTrebleHeldOverlayNotes: StaveNote[] = [];
  const currentBassHeldOverlayNotes: StaveNote[] = [];

  for (const [index, prompt] of appState.promptQueue.entries()) {
    const displayedPrompt = displayedPrompts[index];

    if (!displayedPrompt) {
      continue;
    }

    const trebleNote = displayedPrompt.trebleKeys
      ? createPromptStaveNote(
          displayedPrompt.trebleDisplayedClef ?? "treble",
          displayedPrompt.trebleKeys,
          displayedPrompt.duration,
          displayedKeySignature,
        )
      : createRest(
          displayedPrompt.trebleDisplayedClef ?? "treble",
          displayedPrompt.duration,
        );
    const bassNote = displayedPrompt.bassKeys
      ? createPromptStaveNote(
          displayedPrompt.bassDisplayedClef ?? "bass",
          displayedPrompt.bassKeys,
          displayedPrompt.duration,
          displayedKeySignature,
          getStaffClefChangeBefore(displayedPrompts, index, "bass"),
        )
      : createRest(
          displayedPrompt.bassDisplayedClef ?? "bass",
          displayedPrompt.duration,
        );

    if (index === appState.currentPromptIndex) {
      trebleNote.setStyle({
        fillStyle: "#a6401f",
        strokeStyle: "#a6401f",
      });
      bassNote.setStyle({
        fillStyle: "#a6401f",
        strokeStyle: "#a6401f",
      });

      currentTrebleTickable = trebleNote;
      currentBassTickable = bassNote;
      currentTreblePromptNote = displayedPrompt.trebleKeys ? trebleNote : null;
      currentBassPromptNote = displayedPrompt.bassKeys ? bassNote : null;

      for (const heldNoteNumber of [...appState.midi.heldNotes].sort(
        (left, right) => left - right,
      )) {
        const heldOverlayPresentation = getHeldOverlayPresentation(
          prompt,
          displayedPrompt,
          heldNoteNumber,
          displayedKeySignature,
        );
        const heldOverlayNote = createHeldInputOverlayNote(
          heldOverlayPresentation.clef,
          heldOverlayPresentation.key,
          displayedPrompt.duration,
          displayedKeySignature,
        );

        if (heldOverlayPresentation.hand === "treble") {
          currentTrebleHeldOverlayNotes.push(heldOverlayNote);
        } else {
          currentBassHeldOverlayNotes.push(heldOverlayNote);
        }
      }
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

  drawTrebleOttavaBracket(
    appState.promptQueue,
    trebleNotes,
    context,
  );

  if (currentTrebleTickable) {
    for (const currentTrebleHeldOverlayNote of currentTrebleHeldOverlayNotes) {
      drawHeldOverlayNote(
        currentTrebleHeldOverlayNote,
        currentTrebleTickable,
        trebleStave,
        context,
      );
    }
  }

  if (currentBassTickable) {
    for (const currentBassHeldOverlayNote of currentBassHeldOverlayNotes) {
      drawHeldOverlayNote(
        currentBassHeldOverlayNote,
        currentBassTickable,
        bassStave,
        context,
      );
    }
  }

  applyWrongAttemptFeedback([currentTreblePromptNote, currentBassPromptNote]);
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
  if (appState.generationSettings.practiceMode === "scales") {
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

  return {
    duration: prompt.duration,
    trebleKeys: prompt.displayedTrebleKeys ?? prompt.trebleKeys,
    bassKeys: prompt.displayedBassKeys ?? prompt.bassKeys,
    trebleDisplayedClef: prompt.trebleDisplayedClef,
    bassDisplayedClef: prompt.bassDisplayedClef,
    trebleOttavaStart: prompt.trebleOttavaStart,
    trebleOttavaEnd: prompt.trebleOttavaEnd,
  };
}

function getStaffClefChangeBefore(
  promptQueue: PromptSlot[],
  index: number,
  hand: "treble" | "bass",
): "treble" | "bass" | undefined {
  const currentPrompt = promptQueue[index];

  if (!currentPrompt || promptQueue.length < 2) {
    return undefined;
  }

  const previousPrompt = promptQueue.at(
    (index - 1 + promptQueue.length) % promptQueue.length,
  );

  if (!previousPrompt) {
    return undefined;
  }

  const currentKeys =
    hand === "treble" ? currentPrompt.trebleKeys : currentPrompt.bassKeys;
  const previousKeys =
    hand === "treble" ? previousPrompt.trebleKeys : previousPrompt.bassKeys;

  if (
    !currentKeys ||
    currentKeys.length === 0 ||
    !previousKeys ||
    previousKeys.length === 0
  ) {
    return undefined;
  }

  const currentClef =
    hand === "treble"
      ? currentPrompt.trebleDisplayedClef ?? "treble"
      : currentPrompt.bassDisplayedClef ?? "bass";
  const previousClef =
    hand === "treble"
      ? previousPrompt.trebleDisplayedClef ?? "treble"
      : previousPrompt.bassDisplayedClef ?? "bass";

  return currentClef !== previousClef ? currentClef : undefined;
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

function getHeldOverlayPresentation(
  prompt: PromptSlot,
  displayedPrompt: PromptSlot,
  heldNoteNumber: number,
  displayedKeySignature: KeySignature | null,
) {
  const matchedTrebleDisplayKey = getMatchedDisplayedPromptKey(
    prompt.trebleKeys,
    prompt.displayedTrebleKeys,
    heldNoteNumber,
  );

  if (matchedTrebleDisplayKey) {
    return {
      hand: "treble" as const,
      key: matchedTrebleDisplayKey,
      clef: displayedPrompt.trebleDisplayedClef ?? "treble",
    };
  }

  const matchedBassDisplayKey = getMatchedDisplayedPromptKey(
    prompt.bassKeys,
    prompt.displayedBassKeys,
    heldNoteNumber,
  );

  if (matchedBassDisplayKey) {
    return {
      hand: "bass" as const,
      key: matchedBassDisplayKey,
      clef: displayedPrompt.bassDisplayedClef ?? "bass",
    };
  }

  const activeNotationContext = getActiveNotationContext(prompt, displayedPrompt);
  const fallbackHand = resolveHeldOverlayHand(prompt, heldNoteNumber);
  let key = getHeldOverlayKey(prompt, heldNoteNumber, displayedKeySignature);

  if (fallbackHand === "treble" && activeNotationContext.trebleOttavaActive) {
    key = shiftKeyByOctaves(key, -1);
  }

  return {
    hand: fallbackHand,
    key,
    clef:
      fallbackHand === "treble"
        ? activeNotationContext.trebleClef
        : activeNotationContext.bassClef,
  };
}

function getMatchedDisplayedPromptKey(
  actualKeys: string[] | undefined,
  displayedKeys: string[] | undefined,
  heldNoteNumber: number,
) {
  if (!actualKeys) {
    return null;
  }

  const matchingKeyIndex = actualKeys.findIndex(
    (key) => keyToMidiNoteNumber(key) === heldNoteNumber,
  );

  if (matchingKeyIndex === -1) {
    return null;
  }

  return displayedKeys?.[matchingKeyIndex] ?? actualKeys[matchingKeyIndex] ?? null;
}

function getActiveNotationContext(
  prompt: PromptSlot,
  displayedPrompt: PromptSlot,
) {
  return {
    trebleClef: displayedPrompt.trebleDisplayedClef ?? "treble",
    bassClef: displayedPrompt.bassDisplayedClef ?? "bass",
    trebleOttavaActive: Boolean(prompt.displayedTrebleKeys),
  };
}

function resolveHeldOverlayHand(prompt: PromptSlot, heldNoteNumber: number) {
  const hasTreblePrompt = (prompt.trebleKeys?.length ?? 0) > 0;
  const hasBassPrompt = (prompt.bassKeys?.length ?? 0) > 0;

  if (hasTreblePrompt && !hasBassPrompt) {
    return "treble" as const;
  }

  if (hasBassPrompt && !hasTreblePrompt) {
    return "bass" as const;
  }

  const trebleMidiNoteNumbers = (prompt.trebleKeys ?? []).map(keyToMidiNoteNumber);
  const bassMidiNoteNumbers = (prompt.bassKeys ?? []).map(keyToMidiNoteNumber);
  const lowestTrebleMidiNoteNumber = Math.min(...trebleMidiNoteNumbers);
  const highestBassMidiNoteNumber = Math.max(...bassMidiNoteNumbers);

  if (heldNoteNumber >= lowestTrebleMidiNoteNumber) {
    return "treble" as const;
  }

  if (heldNoteNumber <= highestBassMidiNoteNumber) {
    return "bass" as const;
  }

  const midpoint =
    (lowestTrebleMidiNoteNumber + highestBassMidiNoteNumber) / 2;

  return heldNoteNumber >= midpoint ? ("treble" as const) : ("bass" as const);
}

function shiftKeyByOctaves(key: string, octaveDelta: number) {
  const [noteName, octaveText] = key.split("/");

  if (!noteName || !octaveText) {
    throw new Error(`Invalid key format: ${key}`);
  }

  const octave = Number.parseInt(octaveText, 10);

  if (Number.isNaN(octave)) {
    throw new Error(`Invalid octave in key: ${key}`);
  }

  return `${noteName}/${octave + octaveDelta}`;
}

function createHeldInputOverlayNote(
  clef: "treble" | "bass",
  key: string,
  duration: string,
  displayedKeySignature: KeySignature | null,
) {
  const note = createPromptStaveNote(
    clef,
    [key],
    duration,
    displayedKeySignature,
  );

  note.setStyle({
    fillStyle: "#4c75a3",
    strokeStyle: "#4c75a3",
  });
  note.setStemStyle({
    fillStyle: "transparent",
    strokeStyle: "transparent",
  });
  note.renderOptions.drawStem = false;

  return note;
}

function drawHeldOverlayNote(
  note: StaveNote,
  anchorTickable: StaveNote,
  stave: Stave,
  context: ReturnType<Renderer["getContext"]>,
) {
  const modifierContext = new ModifierContext();

  note.addToModifierContext(modifierContext);
  modifierContext.preFormat();
  note.setTickContext(anchorTickable.getTickContext());
  note.setStave(stave);
  note.preFormat();
  note.setContext(context).draw();
}

function drawTrebleOttavaBracket(
  promptQueue: PromptSlot[],
  trebleNotes: StaveNote[],
  context: ReturnType<Renderer["getContext"]>,
) {
  const ottavaStartIndex = promptQueue.findIndex(
    (prompt) => prompt.trebleOttavaStart,
  );
  const ottavaEndIndex = promptQueue.findIndex((prompt) => prompt.trebleOttavaEnd);

  if (ottavaStartIndex === -1 || ottavaEndIndex === -1) {
    return;
  }

  if (ottavaStartIndex <= ottavaEndIndex) {
    drawOttavaBracketSegment(
      trebleNotes[ottavaStartIndex],
      trebleNotes[ottavaEndIndex],
      trebleNotes.slice(ottavaStartIndex, ottavaEndIndex + 1),
      context,
      true,
    );
    return;
  }

  drawOttavaBracketSegment(
    trebleNotes[ottavaStartIndex],
    trebleNotes.at(-1),
    trebleNotes.slice(ottavaStartIndex),
    context,
    true,
  );
  drawOttavaBracketSegment(
    trebleNotes[0],
    trebleNotes[ottavaEndIndex],
    trebleNotes.slice(0, ottavaEndIndex + 1),
    context,
    false,
  );
}

function drawOttavaBracketSegment(
  ottavaStartNote: StaveNote | undefined,
  ottavaEndNote: StaveNote | undefined,
  segmentNotes: StaveNote[],
  context: ReturnType<Renderer["getContext"]>,
  showLabel: boolean,
) {
  if (!ottavaStartNote || !ottavaEndNote) {
    return;
  }

  const textBracket = new TextBracket({
    start: ottavaStartNote,
    stop: ottavaEndNote,
    text: showLabel ? "8" : "",
    superscript: showLabel ? "va" : "",
    position: TextBracket.Position.TOP,
  })
    .setDashed(false);
  const safeTopTextLine = getSafeTopTextLineForNotes(
    ottavaStartNote,
    segmentNotes,
  );

  textBracket.setLine(safeTopTextLine).setContext(context).draw();
}

function getSafeTopTextLineForNotes(
  referenceNote: StaveNote,
  notes: StaveNote[],
) {
  const stave = referenceNote.checkStave();
  const noteTopPadding = 8;
  const minimumVisibleY = 18;
  const topMostOccupiedY = Math.min(
    ...notes.map((note) => {
      const stemTopY = note.getStemExtents().topY;
      const noteHeadTopY = Math.min(...note.getYs());

      return Math.min(stemTopY, noteHeadTopY);
    }),
  );
  const targetTopTextY = topMostOccupiedY - noteTopPadding;
  let line = 1;

  while (
    line < 12 &&
    stave.getYForTopText(line + 0.5) > targetTopTextY &&
    stave.getYForTopText(line + 0.5) >= minimumVisibleY
  ) {
    line += 0.5;
  }

  return line;
}

function applyWrongAttemptFeedback(notes: Array<StaveNote | null>) {
  const shouldAnimateWrongAttempt =
    state.lastAttemptResult === "incorrect" &&
    state.attemptFeedbackCount !== renderedAttemptFeedbackCount;

  if (!shouldAnimateWrongAttempt) {
    if (state.attemptFeedbackCount !== renderedAttemptFeedbackCount) {
      renderedAttemptFeedbackCount = state.attemptFeedbackCount;
    }

    return;
  }

  for (const note of notes) {
    const noteElement = note?.getSVGElement();

    if (!noteElement) {
      continue;
    }

    noteElement.classList.remove("current-prompt-wiggle");
    void noteElement.getBoundingClientRect();
    noteElement.classList.add("current-prompt-wiggle");
  }

  renderedAttemptFeedbackCount = state.attemptFeedbackCount;
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

function createPromptQueue(
  length: number,
  generationSettings: GenerationSettings,
) {
  return createExercisePromptQueue(
    length,
    generationSettings,
    GENERATED_NOTE_POOL,
  );
}

function fillQueueToLength(
  promptQueue: PromptSlot[],
  length: number,
  generationSettings: GenerationSettings,
) {
  fillExercisePromptQueue(
    promptQueue,
    length,
    generationSettings,
    GENERATED_NOTE_POOL,
  );
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

function loadStoredSettings(): {
  generationSettings: GenerationSettings;
  attemptWindowMs: number;
  isDebugVisible: boolean;
  isExerciseVisible: boolean;
  isInputNameVisible: boolean;
  isKeyboardVisible: boolean;
} {
  try {
    const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);

    if (!storedSettings) {
      const generationSettings = {
        ...initialGenerationSettings,
      };
      generationSettings.tonic = getPracticalTonic(generationSettings.tonic);

      return {
        generationSettings,
        attemptWindowMs: DEFAULT_ATTEMPT_WINDOW_MS,
        isDebugVisible: false,
        isExerciseVisible: false,
        isInputNameVisible: false,
        isKeyboardVisible: false,
      };
    }

    const parsedSettings = JSON.parse(storedSettings);
    const storedGenerationSettings = parsedSettings?.generationSettings;
    const generationSettings = {
      ...initialGenerationSettings,
      ...storedGenerationSettings,
    };
    generationSettings.tonic = getPracticalTonic(generationSettings.tonic);

    return {
      generationSettings,
      attemptWindowMs:
        typeof parsedSettings?.attemptWindowMs === "number"
          ? clampAttemptWindowMs(parsedSettings.attemptWindowMs)
          : DEFAULT_ATTEMPT_WINDOW_MS,
      isDebugVisible:
        typeof parsedSettings?.isDebugVisible === "boolean"
          ? parsedSettings.isDebugVisible
          : false,
      isExerciseVisible:
        typeof parsedSettings?.isExerciseVisible === "boolean"
          ? parsedSettings.isExerciseVisible
          : true,
      isInputNameVisible:
        typeof parsedSettings?.isInputNameVisible === "boolean"
          ? parsedSettings.isInputNameVisible
          : false,
      isKeyboardVisible:
        typeof parsedSettings?.isKeyboardVisible === "boolean"
          ? parsedSettings.isKeyboardVisible
          : false,
    };
  } catch {
    const generationSettings = {
      ...initialGenerationSettings,
    };
    generationSettings.tonic = getPracticalTonic(generationSettings.tonic);

    return {
      generationSettings,
      attemptWindowMs: DEFAULT_ATTEMPT_WINDOW_MS,
      isDebugVisible: false,
      isExerciseVisible: false,
      isInputNameVisible: false,
      isKeyboardVisible: false,
    };
  }
}

function saveStoredSettings() {
  try {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        generationSettings: state.generationSettings,
        attemptWindowMs: state.attemptWindowMs,
        isDebugVisible: state.isDebugVisible,
        isExerciseVisible: state.isExerciseVisible,
        isInputNameVisible: state.isInputNameVisible,
        isKeyboardVisible: state.isKeyboardVisible,
      }),
    );
  } catch {
    // Ignore storage issues and continue without persistence.
  }
}
