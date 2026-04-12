import "./styles.css";
import {
  Accidental,
  ClefNote,
  Font,
  Formatter,
  ModifierContext,
  NoteSubGroup,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  VexFlow,
  Voice,
} from "vexflow/core";
// @ts-expect-error Probe local VexFlow font payload imports for bundle sizing.
import { Academico } from "../node_modules/vexflow/build/esm/src/fonts/academico.js";
// @ts-expect-error Probe local VexFlow font payload imports for bundle sizing.
import { AcademicoBold } from "../node_modules/vexflow/build/esm/src/fonts/academicobold.js";
// @ts-expect-error Probe local VexFlow font payload imports for bundle sizing.
import { Bravura } from "../node_modules/vexflow/build/esm/src/fonts/bravura.js";
import {
  analyzeHeldInput,
  getInputNameVariantKey,
  type InputAnalysis,
} from "./analysis/inputAnalysis";
import { renderInputNameDisplay } from "./display/inputName";
import { renderKeyboardDisplay } from "./display/keyboard";
import {
  createExercisePromptQueue,
  fillExercisePromptQueue,
  getExerciseNotationProfile,
} from "./exercises";
import type { PromptAccidentalOverride, PromptSlot } from "./exercises/types";
import { connectMidi, type MidiState } from "./midi";
import {
  compareKeysByMidiNumber,
  type GenerationSettings,
  getAllTonics,
  getArpeggioRenderingNotice,
  getArpeggioRenderingOptions,
  getCadenceRenderingNotice,
  getCadenceRenderingOptions,
  getClefForKey,
  getDerivedKeySignature,
  getHeldOverlayKey,
  getPracticalTonic,
  getRenderedAccidentalForKey,
  getScaleRenderingNotice,
  getScaleRenderingOptions,
  getTriadRenderingNotice,
  getTriadRenderingOptions,
  type KeySignature,
  keyToMidiNoteNumber,
  midiNoteNumberToKey,
  type PracticeMode,
  type RenderingPreference,
  type ScaleDirection,
  type ScaleHands,
  type ScaleMotion,
  type ScaleOctaves,
  type ScaleType,
  type Tonic,
  type TriadType,
} from "./theory/music";

const DEFAULT_ATTEMPT_WINDOW_MS = 40;
const MIN_ATTEMPT_WINDOW_MS = 10;
const MAX_ATTEMPT_WINDOW_MS = 250;
const DEFAULT_OCTAVE_OFFSET = 0;
const MIN_OCTAVE_OFFSET = -3;
const MAX_OCTAVE_OFFSET = 3;
const MIDI_NOTE_NUMBER_MIN = 0;
const MIDI_NOTE_NUMBER_MAX = 127;
const MIDI_DEVICE_STORAGE_KEY = "piano-tool-midi-device-id";
const SETTINGS_STORAGE_KEY = "piano-tool-settings";
const SETTINGS_SCHEMA_VERSION = 1;
const DEFAULT_GUIDE_URL =
  "https://github.com/Chairnee/grand-staff-trainer/blob/main/README.md";
const SETTINGS_COACHMARK_FIRST_RUN_INTRO =
  "The input analysis, exercise and keyboard panels are currently visible. You can change what's shown in Settings.";
const SETTINGS_COACHMARK_RETURNING_INTRO =
  "This app can show three main panels. You can choose what’s visible in Settings.";
const SETTINGS_COACHMARK_MESSAGE_SUFFIX =
  "Press the Full Guide button below for full app capabilities.";
const PROMPT_QUEUE_LENGTH = 8;
const KEYBOARD_START_MIDI_NOTE = 21;
const KEYBOARD_END_MIDI_NOTE = 108;
const UI_BASE_WIDTH = 1280;
const UI_BASE_HEIGHT = 720;
const UI_SHELL_PADDING_INLINE = 7;
const UI_SHELL_PADDING_BLOCK = 4;
const NOTATION_ZOOM_MIN = 1;
const NOTATION_ZOOM_MAX = 3;
const PORTRAIT_UI_BASE_HEIGHT = 568;
const PORTRAIT_UI_SCALE_MIN = 1;
const PORTRAIT_UI_SCALE_MAX = 10;
const DEFAULT_RENDER_HEIGHT = 340;
const MIN_RENDER_WIDTH = 640;
const PORTRAIT_MIN_RENDER_WIDTH = 0;
const PORTRAIT_RENDER_WIDTH_RATIO = 0.6;
const INPUT_NAME_POPOUT_BASE_WIDTH = 270;
const INPUT_NAME_POPOUT_BASE_HEIGHT = 72;
const KEYBOARD_POPOUT_BASE_WIDTH = 1080;
const KEYBOARD_POPOUT_BASE_HEIGHT = 220;
const KEYBOARD_POPOUT_ROOT_PADDING = 0;
const STAFF_ANNOTATION_MAX_ABOVE_TOP_TEXT_LINE = 1.8;
const OTTAVA_VIEWPORT_PADDING = 18;
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
const IS_DEV = import.meta.env.DEV;
const GUIDE_URL = import.meta.env.VITE_DOCUMENTATION_URL || DEFAULT_GUIDE_URL;
const SHOW_GUIDE_BUTTON = IS_DEV || Boolean(GUIDE_URL);
const PRACTICE_MODES: PracticeMode[] = [
  "scales",
  "triads",
  "arpeggios",
  "cadences",
];
const SCALE_HANDS_OPTIONS: ScaleHands[] = ["treble", "bass", "together"];
const SCALE_MOTION_OPTIONS: ScaleMotion[] = ["parallel", "contrary"];
const SCALE_DIRECTION_OPTIONS: ScaleDirection[] = ["ascending", "descending"];
const SCALE_OCTAVES_OPTIONS: ScaleOctaves[] = [1, 2];
const SCALE_TYPES: ScaleType[] = [
  "major",
  "natural-minor",
  "harmonic-minor",
  "melodic-minor",
];
const TRIAD_TYPES: TriadType[] = ["major", "minor", "augmented", "diminished"];

type PromptAttempt = {
  midiNotes: number[];
};

type AttemptResult = "correct" | "incorrect" | null;
type LayoutMode = "responsive";
type PanelPopoutMode = "none" | "panel";
type PanelDisplayState = {
  visibleInApp: boolean;
  popoutMode: PanelPopoutMode;
};
type HeldOverlayPresentation = {
  hand: "treble" | "bass";
  key: string;
  clef: "treble" | "bass";
};

type AppState = {
  promptQueue: PromptSlot[];
  currentPromptIndex: number;
  currentMeasureOffsetBeats: number;
  lastAttemptResult: AttemptResult;
  attemptFeedbackCount: number;
  attemptWindowMs: number;
  generationSettings: GenerationSettings;
  isSettingsOpen: boolean;
  isDebugVisible: boolean;
  isExerciseVisible: boolean;
  octaveOffset: number;
  selectedInputNameVariantKey: string | null;
  inputNameDisplay: PanelDisplayState;
  keyboardDisplay: PanelDisplayState;
  hasSeenLandscapeSettingsCoachmark: boolean;
  isSettingsCoachmarkOpen: boolean;
  midi: MidiState;
  simulatedHeldNotes: number[];
  heldOverlayPresentations: Map<number, HeldOverlayPresentation>;
};

type StoredSettingsSnapshot = {
  version: number;
  generationSettings: Omit<GenerationSettings, "renderingPreference">;
  attemptWindowMs: number;
  isDebugVisible: boolean;
  isExerciseVisible: boolean;
  octaveOffset: number;
  isInputNameVisible: boolean;
  isKeyboardVisible: boolean;
  hasSeenLandscapeSettingsCoachmark: boolean;
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Could not find app container.");
}

document.body.classList.add("grand-staff-trainer-app");

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
        <div class="octave-offset-picker" aria-label="Octave offset">
          <span>Octave offset</span>
          <div class="octave-offset-controls">
            <button
              id="octave-offset-decrease"
              class="toolbar-button"
              type="button"
              aria-label="Decrease octave offset"
            >
              -
            </button>
            <span id="octave-offset-value" class="octave-offset-value">0</span>
            <button
              id="octave-offset-increase"
              class="toolbar-button"
              type="button"
              aria-label="Increase octave offset"
            >
              +
            </button>
          </div>
        </div>
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
          <label class="midi-picker">
          <span>MIDI Input</span>
          <select id="midi-input-select"></select>
        </label>
        <div id="midi-status" class="status-pill"></div>
      </header>

      <section class="practice-area">
        <div id="input-name-display" class="input-name-display" hidden></div>
        <div id="notation" class="notation">
          <div id="exercise-notice" class="exercise-notice" hidden></div>
          <div id="exercise-summary" class="exercise-summary" hidden></div>
          <div id="notation-canvas" class="notation-canvas"></div>
        </div>
        <div id="keyboard-display" class="keyboard-display" hidden></div>
      </section>
    </main>
  </div>

  <div id="midi-debug" class="midi-debug" hidden></div>

  <div
    id="settings-coachmark-overlay"
    class="settings-coachmark-overlay"
    hidden
  ></div>
  <div
    id="settings-coachmark-callout"
    class="settings-coachmark-callout"
    hidden
    role="note"
    aria-live="polite"
  ></div>

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

    <div class="settings-top-grid">
      <section class="settings-section">
        <h3>Display</h3>
        <label class="settings-toggle">
          <input id="settings-exercise-toggle" type="checkbox" />
          <span>Exercise panel</span>
        </label>
        <label class="settings-toggle">
          <input id="settings-input-name-toggle" type="checkbox" />
          <span>Input analysis</span>
        </label>
        <label class="settings-toggle">
          <input id="settings-keyboard-toggle" type="checkbox" />
          <span>Keyboard</span>
        </label>
      </section>

      <section class="settings-section">
        <h3>Popouts</h3>
        <div class="settings-actions">
          <button
            id="settings-input-name-popout"
            class="toolbar-button settings-action-button"
            type="button"
          >
            Input analysis
          </button>
          <button
            id="settings-keyboard-popout"
            class="toolbar-button settings-action-button"
            type="button"
          >
            Keyboard
          </button>
          <button
            id="settings-combined-popout"
            class="toolbar-button settings-action-button"
            type="button"
          >
            Both
          </button>
        </div>
      </section>
    </div>

    <section class="settings-section">
      <h3 id="exercise-settings-heading">Exercise Settings</h3>
      <label class="settings-field">
        <span>Practice mode</span>
        <select id="practice-mode-select">
          <option value="scales">Scales</option>
          <option value="triads">Triads</option>
          <option value="arpeggios">Arpeggios</option>
          <option value="cadences">Cadences</option>
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
      <label id="scale-motion-field" class="settings-field" hidden>
        <span>Motion</span>
        <select id="scale-motion-select">
          <option value="parallel">Parallel</option>
          <option value="contrary">Contrary</option>
        </select>
      </label>
      <label id="scale-direction-field" class="settings-field" hidden>
        <span>Direction</span>
        <select id="scale-direction-select">
          <option value="ascending">Ascending</option>
          <option value="descending">Descending</option>
        </select>
      </label>
      <label id="scale-octaves-field" class="settings-field" hidden>
        <span>Octaves</span>
        <select id="scale-octaves-select">
          <option value="1">1</option>
          <option value="2">2</option>
        </select>
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
        <span id="triad-type-label">Triad type</span>
        <select id="triad-type-select">
          <option value="major">Major</option>
          <option value="minor">Minor</option>
          <option value="augmented">Augmented</option>
          <option value="diminished">Diminished</option>
        </select>
      </label>
    </section>
  </aside>
`;

const practiceArea = document.querySelector<HTMLElement>(".practice-area");
const notation = document.querySelector<HTMLDivElement>("#notation");
const exerciseNotice =
  document.querySelector<HTMLDivElement>("#exercise-notice");
const exerciseSummary =
  document.querySelector<HTMLDivElement>("#exercise-summary");
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
const octaveOffsetDecrease = document.querySelector<HTMLButtonElement>(
  "#octave-offset-decrease",
);
const octaveOffsetValue = document.querySelector<HTMLSpanElement>(
  "#octave-offset-value",
);
const octaveOffsetIncrease = document.querySelector<HTMLButtonElement>(
  "#octave-offset-increase",
);
const midiDebug = document.querySelector<HTMLDivElement>("#midi-debug");
const toolbar = document.querySelector<HTMLElement>(".toolbar");
const settingsCoachmarkOverlay = document.querySelector<HTMLDivElement>(
  "#settings-coachmark-overlay",
);
const settingsCoachmarkCallout = document.querySelector<HTMLDivElement>(
  "#settings-coachmark-callout",
);
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
const scaleMotionField = document.querySelector<HTMLLabelElement>(
  "#scale-motion-field",
);
const scaleMotionSelect = document.querySelector<HTMLSelectElement>(
  "#scale-motion-select",
);
const scaleDirectionField = document.querySelector<HTMLLabelElement>(
  "#scale-direction-field",
);
const scaleDirectionSelect = document.querySelector<HTMLSelectElement>(
  "#scale-direction-select",
);
const scaleOctavesField = document.querySelector<HTMLLabelElement>(
  "#scale-octaves-field",
);
const scaleOctavesSelect = document.querySelector<HTMLSelectElement>(
  "#scale-octaves-select",
);
const tonicSelect = document.querySelector<HTMLSelectElement>("#tonic-select");
const scaleTypeSelect =
  document.querySelector<HTMLSelectElement>("#scale-type-select");
const triadTypeField =
  document.querySelector<HTMLLabelElement>("#triad-type-field");
const triadTypeLabel =
  document.querySelector<HTMLSpanElement>("#triad-type-label");
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
const settingsInputNamePopoutButton = document.querySelector<HTMLButtonElement>(
  "#settings-input-name-popout",
);
const settingsKeyboardPopoutButton = document.querySelector<HTMLButtonElement>(
  "#settings-keyboard-popout",
);
const settingsCombinedPopoutButton = document.querySelector<HTMLButtonElement>(
  "#settings-combined-popout",
);

if (
  !practiceArea ||
  !notation ||
  !exerciseNotice ||
  !exerciseSummary ||
  !notationCanvas ||
  !inputNameDisplay ||
  !keyboardDisplay ||
  !midiInputSelect ||
  !attemptWindowInput ||
  !octaveOffsetDecrease ||
  !octaveOffsetValue ||
  !octaveOffsetIncrease ||
  !midiDebug ||
  !settingsCoachmarkOverlay ||
  !settingsCoachmarkCallout ||
  !settingsToggle ||
  !debugToggle ||
  !midiStatus ||
  !settingsBackdrop ||
  !settingsDrawer ||
  !settingsClose ||
  !practiceModeSelect ||
  !scaleHandsField ||
  !scaleHandsSelect ||
  !scaleMotionField ||
  !scaleMotionSelect ||
  !scaleDirectionField ||
  !scaleDirectionSelect ||
  !scaleOctavesField ||
  !scaleOctavesSelect ||
  !tonicSelect ||
  !scaleTypeSelect ||
  !triadTypeField ||
  !triadTypeLabel ||
  !triadTypeSelect ||
  !settingsExerciseToggle ||
  !exerciseSettingsHeading ||
  !settingsKeyboardToggle ||
  !settingsInputNameToggle ||
  !settingsInputNamePopoutButton ||
  !settingsKeyboardPopoutButton ||
  !settingsCombinedPopoutButton
) {
  throw new Error("Could not find app elements.");
}

const practiceAreaElement = practiceArea;
const notationElement = notation;
const exerciseNoticeElement = exerciseNotice;
const exerciseSummaryElement = exerciseSummary;
const notationCanvasElement = notationCanvas;
const inputNameDisplayElement = inputNameDisplay;
const keyboardDisplayElement = keyboardDisplay;
const midiInputSelectElement = midiInputSelect;
const attemptWindowInputElement = attemptWindowInput;
const octaveOffsetDecreaseElement = octaveOffsetDecrease;
const octaveOffsetValueElement = octaveOffsetValue;
const octaveOffsetIncreaseElement = octaveOffsetIncrease;
const midiDebugElement = midiDebug;
const settingsCoachmarkOverlayElement = settingsCoachmarkOverlay;
const settingsCoachmarkCalloutElement = settingsCoachmarkCallout;
const settingsToggleElement = settingsToggle;
const debugToggleElement = debugToggle;
const midiStatusElement = midiStatus;
const settingsBackdropElement = settingsBackdrop;
const settingsDrawerElement = settingsDrawer;
const settingsCloseElement = settingsClose;
const practiceModeSelectElement = practiceModeSelect;
const scaleHandsFieldElement = scaleHandsField;
const scaleHandsSelectElement = scaleHandsSelect;
const scaleMotionFieldElement = scaleMotionField;
const scaleMotionSelectElement = scaleMotionSelect;
const scaleDirectionFieldElement = scaleDirectionField;
const scaleDirectionSelectElement = scaleDirectionSelect;
const scaleOctavesFieldElement = scaleOctavesField;
const scaleOctavesSelectElement = scaleOctavesSelect;
const tonicSelectElement = tonicSelect;
const scaleTypeSelectElement = scaleTypeSelect;
const triadTypeFieldElement = triadTypeField;
const triadTypeLabelElement = triadTypeLabel;
const triadTypeSelectElement = triadTypeSelect;
const settingsExerciseToggleElement = settingsExerciseToggle;
const exerciseSettingsHeadingElement = exerciseSettingsHeading;
const settingsKeyboardToggleElement = settingsKeyboardToggle;
const settingsInputNameToggleElement = settingsInputNameToggle;
const settingsInputNamePopoutButtonElement = settingsInputNamePopoutButton;
const settingsKeyboardPopoutButtonElement = settingsKeyboardPopoutButton;
const settingsCombinedPopoutButtonElement = settingsCombinedPopoutButton;
const practiceModeField = practiceModeSelectElement.parentElement;
const tonicField = tonicSelectElement.parentElement;
const scaleTypeField = scaleTypeSelectElement.parentElement;

if (!practiceModeField || !tonicField || !scaleTypeField) {
  throw new Error("Could not find settings field elements.");
}

const practiceModeFieldElement = practiceModeField;
const tonicFieldElement = tonicField;
const scaleTypeFieldElement = scaleTypeField;

type InputNamePopoutHandle = {
  window: Window;
  container: HTMLDivElement;
  handleResize: () => void;
  handleBeforeUnload: () => void;
};

type KeyboardPopoutHandle = {
  window: Window;
  container: HTMLDivElement;
  fitButton: HTMLButtonElement;
  handleResize: () => void;
  handleBeforeUnload: () => void;
};

type CombinedPopoutHandle = {
  window: Window;
  inputContainer: HTMLDivElement;
  keyboardContainer: HTMLDivElement;
  handleResize: () => void;
  handleBeforeUnload: () => void;
};

let renderedAttemptFeedbackCount = 0;
let attemptTimer: ReturnType<typeof setTimeout> | null = null;
let areNotationFontsReady = !("fonts" in document);
let inputNamePopoutHandle: InputNamePopoutHandle | null = null;
let keyboardPopoutHandle: KeyboardPopoutHandle | null = null;
let combinedPopoutHandle: CombinedPopoutHandle | null = null;
let pendingRenderFrame: number | null = null;
let pendingRenderMask = 0;
const pendingAttemptMidiNotes = new Set<number>();
const RENDER_FULL = 1;
const RENDER_MIDI_PANELS = 2;
const RENDER_MIDI_CHROME = 4;
const initialGenerationSettings: GenerationSettings = {
  practiceMode: "triads",
  scaleHands: "together",
  scaleOctaves: 2,
  scaleMotion: "parallel",
  scaleDirection: "ascending",
  tonic: "C",
  scaleType: "major",
  triadType: "major",
  renderingPreference: "preferred",
};
const initialStoredSettings = loadStoredSettings();
const initialPromptQueue = createPromptQueue(PROMPT_QUEUE_LENGTH, {
  ...initialStoredSettings.generationSettings,
});

const state: AppState = {
  promptQueue: [...initialPromptQueue],
  currentPromptIndex: 0,
  currentMeasureOffsetBeats: 0,
  lastAttemptResult: null,
  attemptFeedbackCount: 0,
  attemptWindowMs: initialStoredSettings.attemptWindowMs,
  generationSettings: {
    ...initialStoredSettings.generationSettings,
  },
  isSettingsOpen: false,
  isDebugVisible: IS_DEV && initialStoredSettings.isDebugVisible,
  isExerciseVisible: initialStoredSettings.isExerciseVisible,
  octaveOffset: initialStoredSettings.octaveOffset,
  selectedInputNameVariantKey: null,
  inputNameDisplay: {
    visibleInApp: initialStoredSettings.isInputNameVisible,
    popoutMode: "none",
  },
  keyboardDisplay: {
    visibleInApp: initialStoredSettings.isKeyboardVisible,
    popoutMode: "none",
  },
  hasSeenLandscapeSettingsCoachmark:
    initialStoredSettings.hasSeenLandscapeSettingsCoachmark,
  isSettingsCoachmarkOpen:
    !initialStoredSettings.hasSeenLandscapeSettingsCoachmark,
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
  simulatedHeldNotes: [],
  heldOverlayPresentations: new Map(),
};

const midiConnection = connectMidi(handleMidiStateChange, {
  onNoteOn: handleMidiNoteOn,
  preferredInputId: loadPreferredMidiDeviceId(),
});
midiInputSelectElement.addEventListener("change", handleMidiInputChange);
attemptWindowInputElement.addEventListener("change", handleAttemptWindowChange);
octaveOffsetDecreaseElement.addEventListener("click", () => {
  changeOctaveOffset(-1);
});
octaveOffsetIncreaseElement.addEventListener("click", () => {
  changeOctaveOffset(1);
});
settingsToggleElement.addEventListener("click", toggleSettingsDrawer);
settingsCoachmarkOverlayElement.addEventListener(
  "click",
  handleSettingsCoachmarkDismiss,
);
settingsCoachmarkCalloutElement.addEventListener(
  "click",
  handleSettingsCoachmarkCalloutClick,
);
settingsCloseElement.addEventListener("click", closeSettingsDrawer);
settingsBackdropElement.addEventListener("click", closeSettingsDrawer);
debugToggleElement.addEventListener("click", handleUtilityButtonClick);
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
settingsInputNamePopoutButtonElement.addEventListener(
  "click",
  handleInputNamePopoutClick,
);
settingsKeyboardPopoutButtonElement.addEventListener(
  "click",
  handleKeyboardPopoutClick,
);
settingsCombinedPopoutButtonElement.addEventListener(
  "click",
  handleCombinedPopoutClick,
);
practiceModeSelectElement.addEventListener("change", handlePracticeModeChange);
scaleHandsSelectElement.addEventListener("change", handleScaleHandsChange);
scaleMotionSelectElement.addEventListener("change", handleScaleMotionChange);
scaleDirectionSelectElement.addEventListener(
  "change",
  handleScaleDirectionChange,
);
scaleOctavesSelectElement.addEventListener("change", handleScaleOctavesChange);
tonicSelectElement.addEventListener("change", handleTonicChange);
scaleTypeSelectElement.addEventListener("change", handleScaleTypeChange);
triadTypeSelectElement.addEventListener("change", handleTriadTypeChange);
window.addEventListener("resize", handleWindowResize);
window.addEventListener("beforeunload", handleWindowBeforeUnload);

VexFlow.setFonts("Bravura", "Academico");

if (state.promptQueue.length === 0) {
  throw new Error("Prompt queue is empty.");
}

if ("fonts" in document) {
  void Promise.allSettled([
    Font.load("Bravura", Bravura, { display: "block" }),
    Font.load("Academico", Academico, { display: "swap" }),
    Font.load("Academico", AcademicoBold, {
      display: "swap",
      weight: "bold",
    }),
  ])
    .then(() => document.fonts.ready)
    .then(() => {
      if (areNotationFontsReady) {
        return;
      }

      areNotationFontsReady = true;
      renderApp();
    });
}

renderApp();

function applyLayoutMetrics(layoutMetrics = getLayoutMetrics()) {
  document.documentElement.dataset.layoutMode = layoutMetrics.layoutMode;
  document.documentElement.style.setProperty(
    "--ui-scale",
    layoutMetrics.uiScale.toFixed(3),
  );
  document.documentElement.style.setProperty(
    "--stage-scale",
    layoutMetrics.stageScale.toFixed(3),
  );
  document.documentElement.style.setProperty(
    "--shell-scale",
    layoutMetrics.shellScale.toFixed(3),
  );
  document.documentElement.style.setProperty(
    "--overlay-scale",
    layoutMetrics.overlayScale.toFixed(3),
  );
  document.documentElement.style.setProperty(
    "--portrait-ui-scale",
    layoutMetrics.portraitUiScale.toFixed(3),
  );
  document.documentElement.style.setProperty(
    "--notation-zoom",
    layoutMetrics.notationZoom.toFixed(3),
  );
}

function renderNotationMetadata(displayedHeldKeys: string[]) {
  notationElement.dataset.lastAttemptResult = state.lastAttemptResult ?? "none";
  notationElement.dataset.midiStatus = state.midi.status;
  notationElement.dataset.midiHeldKeys = displayedHeldKeys.join(",");
  notationElement.title = [
    `MIDI: ${state.midi.status}`,
    `Device: ${state.midi.deviceName ?? "none"}`,
    `Held: ${displayedHeldKeys.join(", ") || "none"}`,
  ].join("\n");
}

function performMidiPanelsRender() {
  const displayedHeldNotes = getDisplayedHeldNotes(state);
  const displayedHeldKeys = getDisplayedHeldKeys(state, displayedHeldNotes);
  const analysis = getCurrentInputAnalysis();
  const keyboardOptions = getCurrentKeyboardDisplayOptions();

  renderNotationMetadata(displayedHeldKeys);
  renderInputName(analysis);
  renderNotation();
  renderKeyboard(keyboardOptions, analysis);
  if (IS_DEV) {
    renderMidiDebug();
  }
}

function performFullRender() {
  const layoutMetrics = getLayoutMetrics();
  const displayedHeldNotes = getDisplayedHeldNotes(state);
  const displayedHeldKeys = getDisplayedHeldKeys(state, displayedHeldNotes);
  const analysis = getCurrentInputAnalysis();
  const keyboardOptions = getCurrentKeyboardDisplayOptions();

  applyLayoutMetrics(layoutMetrics);
  renderNotationMetadata(displayedHeldKeys);
  practiceAreaElement.dataset.exerciseVisible = String(state.isExerciseVisible);
  practiceAreaElement.dataset.keyboardVisible = String(
    state.keyboardDisplay.visibleInApp,
  );
  practiceAreaElement.dataset.inputNameVisible = String(
    state.inputNameDisplay.visibleInApp,
  );
  practiceAreaElement.dataset.debugVisible = String(state.isDebugVisible);
  renderMidiInputOptions();
  renderToolbar();
  renderSettingsCoachmark();
  renderSettingsDrawer();
  if (IS_DEV) {
    renderMidiDebug();
  }
  renderExerciseNotice();
  renderExerciseSummary();
  renderInputName(analysis);
  renderNotation();
  renderKeyboard(keyboardOptions, analysis);
}

function performMidiChromeRender() {
  renderMidiInputOptions();
  renderToolbar();
}

function scheduleRender(mask: number) {
  pendingRenderMask |= mask;

  if (pendingRenderFrame !== null) {
    return;
  }

  pendingRenderFrame = window.requestAnimationFrame(() => {
    const renderMask = pendingRenderMask;
    pendingRenderFrame = null;
    pendingRenderMask = 0;

    if (renderMask & RENDER_FULL) {
      performFullRender();
      return;
    }

    if (renderMask & RENDER_MIDI_CHROME) {
      performMidiChromeRender();
    }

    if (renderMask & RENDER_MIDI_PANELS) {
      performMidiPanelsRender();
    }
  });
}

function renderApp() {
  scheduleRender(RENDER_FULL);
}

function getDisplayedSimulatedHeldNotes(appState: AppState) {
  return applyMidiInputOffsetToNotes(
    appState.simulatedHeldNotes,
    appState.octaveOffset,
  );
}

function getDisplayedHeldNotes(appState: AppState) {
  return [
    ...new Set([
      ...applyMidiInputOffsetToNotes(
        appState.midi.heldNotes,
        appState.octaveOffset,
      ),
      ...getDisplayedSimulatedHeldNotes(appState),
    ]),
  ].sort((left, right) => left - right);
}

function getDisplayedAnalysisHeldNotes(appState: AppState) {
  return [
    ...new Set([
      ...applyMidiInputOffsetToNotes(
        appState.midi.analysisHeldNotes,
        appState.octaveOffset,
      ),
      ...getDisplayedSimulatedHeldNotes(appState),
    ]),
  ].sort((left, right) => left - right);
}

function getDisplayedHeldKeys(
  appState: AppState,
  heldNotes = getDisplayedHeldNotes(appState),
) {
  return heldNotes.map((noteNumber) =>
    midiNoteNumberToKey(noteNumber, "sharps"),
  );
}

function getViewportBaselineScale() {
  const totalBaseWidth = UI_BASE_WIDTH + UI_SHELL_PADDING_INLINE * 2;
  const totalBaseHeight = UI_BASE_HEIGHT + UI_SHELL_PADDING_BLOCK * 2;

  return Math.min(
    window.innerWidth / totalBaseWidth,
    window.innerHeight / totalBaseHeight,
  );
}

function getLayoutMetrics(): {
  layoutMode: LayoutMode;
  uiScale: number;
  stageScale: number;
  shellScale: number;
  overlayScale: number;
  portraitUiScale: number;
  notationZoom: number;
} {
  const baselineScale = getViewportBaselineScale();
  const layoutMode: LayoutMode = "responsive";
  const uiScale = baselineScale;
  const stageScale = 1;
  const shellScale = uiScale;
  const overlayScale = uiScale;
  const portraitUiScale = isPortraitViewport()
    ? Math.min(
        PORTRAIT_UI_SCALE_MAX,
        Math.max(
          PORTRAIT_UI_SCALE_MIN,
          window.innerHeight / PORTRAIT_UI_BASE_HEIGHT,
        ),
      )
    : 1;
  const notationZoom = Math.min(
    NOTATION_ZOOM_MAX,
    Math.max(NOTATION_ZOOM_MIN, 1 / uiScale),
  );

  return {
    layoutMode,
    uiScale,
    stageScale,
    shellScale,
    overlayScale,
    portraitUiScale,
    notationZoom,
  };
}

function getUiScale() {
  return getLayoutMetrics().uiScale;
}

function isPortraitViewport() {
  return window.matchMedia("(orientation: portrait)").matches;
}

function handleWindowResize() {
  renderApp();
}

function handleMidiStateChange(midiState: MidiState) {
  const previousMidiState = state.midi;
  state.midi = midiState;
  syncHeldOverlayPresentations();
  scheduleRender(
    RENDER_MIDI_PANELS |
      (hasMidiChromeChanged(previousMidiState, midiState)
        ? RENDER_MIDI_CHROME
        : 0),
  );
}

function hasMidiChromeChanged(previous: MidiState, next: MidiState) {
  if (
    previous.status !== next.status ||
    previous.deviceId !== next.deviceId ||
    previous.deviceName !== next.deviceName
  ) {
    return true;
  }

  if (previous.availableInputs.length !== next.availableInputs.length) {
    return true;
  }

  return previous.availableInputs.some((input, index) => {
    const nextInput = next.availableInputs[index];
    return !nextInput || input.id !== nextInput.id || input.name !== nextInput.name;
  });
}

function syncHeldOverlayPresentations() {
  const activeHeldNotes = new Set(getDisplayedHeldNotes(state));

  for (const heldOverlayNoteNumber of state.heldOverlayPresentations.keys()) {
    if (!activeHeldNotes.has(heldOverlayNoteNumber)) {
      state.heldOverlayPresentations.delete(heldOverlayNoteNumber);
    }
  }
}

function handleMidiInputChange() {
  if (!midiInputSelectElement.value) {
    return;
  }

  savePreferredMidiDeviceId(midiInputSelectElement.value);
  midiConnection.selectInput(midiInputSelectElement.value);
}

function changeOctaveOffset(delta: number) {
  const nextOffset = clampOctaveOffset(state.octaveOffset + delta);

  if (nextOffset === state.octaveOffset) {
    return;
  }

  state.octaveOffset = nextOffset;
  pendingAttemptMidiNotes.clear();

  if (attemptTimer) {
    clearTimeout(attemptTimer);
    attemptTimer = null;
  }

  syncHeldOverlayPresentations();
  saveStoredSettings();
  renderApp();
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
  debugToggleElement.hidden = !SHOW_GUIDE_BUTTON;
  debugToggleElement.textContent = IS_DEV
    ? state.isDebugVisible
      ? "Hide Debug"
      : "Show Debug"
    : "Guide";
  attemptWindowInputElement.value = state.attemptWindowMs.toString();
  octaveOffsetValueElement.textContent =
    state.octaveOffset > 0
      ? `+${state.octaveOffset}`
      : state.octaveOffset.toString();
  octaveOffsetDecreaseElement.disabled =
    state.octaveOffset <= MIN_OCTAVE_OFFSET;
  octaveOffsetIncreaseElement.disabled =
    state.octaveOffset >= MAX_OCTAVE_OFFSET;
  settingsToggleElement.setAttribute(
    "aria-expanded",
    String(state.isSettingsOpen),
  );
  settingsToggleElement.classList.toggle(
    "is-coachmark-highlighted",
    isSettingsCoachmarkVisible(),
  );
}

function isSettingsCoachmarkVisible() {
  return state.isSettingsCoachmarkOpen && !state.isSettingsOpen;
}

function getSettingsCoachmarkMessage() {
  const intro = state.hasSeenLandscapeSettingsCoachmark
    ? SETTINGS_COACHMARK_RETURNING_INTRO
    : SETTINGS_COACHMARK_FIRST_RUN_INTRO;

  return `
    <p>
      ${intro} ${SETTINGS_COACHMARK_MESSAGE_SUFFIX} Click anywhere to close this popup.
    </p>
    <ol>
      <li>Input analysis: try play a chord! (AbaugM7/C perhaps?)</li>
      <li>Exercise: configure exactly what you want from Settings and play along (2700 permutations). The chord window setting in the toolbar determines how precisely you must push multiple keys down at once during exercises.</li>
      <li>
        Keyboard: shows both your played notes and also the expected exercise
        notes when the exercise panel is open.
      </li>
    </ol>
    <div class="settings-coachmark-actions">
      <button
        id="settings-coachmark-guide-button"
        type="button"
        class="toolbar-button"
      >
        Full Guide
      </button>
    </div>
  `;
}

function renderSettingsCoachmark() {
  const isVisible = isSettingsCoachmarkVisible();

  settingsCoachmarkOverlayElement.hidden = !isVisible;
  settingsCoachmarkCalloutElement.hidden = !isVisible;
  settingsCoachmarkCalloutElement.classList.toggle(
    "is-portrait",
    isVisible && isPortraitViewport(),
  );

  if (!isVisible) {
    settingsCoachmarkCalloutElement.style.removeProperty("top");
    settingsCoachmarkCalloutElement.style.removeProperty("left");
    settingsCoachmarkCalloutElement.style.removeProperty(
      "--settings-coachmark-arrow-left",
    );
    return;
  }

  settingsCoachmarkCalloutElement.innerHTML = getSettingsCoachmarkMessage();

  const { overlayScale, portraitUiScale } = getLayoutMetrics();
  const isPortrait = isPortraitViewport();

  if (isPortrait) {
    const toolbarRect = toolbar?.getBoundingClientRect();
    if (!toolbarRect) {
      return;
    }
    const coachmarkGap = 12 * portraitUiScale;
    const coachmarkMargin = 8 * portraitUiScale;
    const coachmarkRect =
      settingsCoachmarkCalloutElement.getBoundingClientRect();
    const coachmarkHeight = coachmarkRect.height;
    const top = Math.min(
      toolbarRect.bottom + coachmarkGap,
      Math.max(
        coachmarkMargin,
        window.innerHeight - coachmarkHeight - coachmarkMargin,
      ),
    );

    settingsCoachmarkCalloutElement.style.left = "50%";
    settingsCoachmarkCalloutElement.style.top = `${top}px`;
    settingsCoachmarkCalloutElement.style.removeProperty(
      "--settings-coachmark-arrow-left",
    );
    return;
  }

  const settingsButtonRect = settingsToggleElement.getBoundingClientRect();
  const coachmarkMargin = 16 * overlayScale;
  const coachmarkGap = 14 * overlayScale;
  const arrowSize = 16 * overlayScale;
  const coachmarkRect = settingsCoachmarkCalloutElement.getBoundingClientRect();
  const coachmarkWidth = coachmarkRect.width;
  const coachmarkHeight = coachmarkRect.height;
  const left = Math.min(
    Math.max(coachmarkMargin, settingsButtonRect.left),
    Math.max(
      coachmarkMargin,
      window.innerWidth - coachmarkWidth - coachmarkMargin,
    ),
  );
  const top = Math.min(
    settingsButtonRect.bottom + coachmarkGap,
    Math.max(
      coachmarkMargin,
      window.innerHeight - coachmarkHeight - coachmarkMargin,
    ),
  );
  const arrowLeft = Math.min(
    Math.max(
      20 * overlayScale,
      settingsButtonRect.left +
        settingsButtonRect.width / 2 -
        left -
        arrowSize / 2,
    ),
    Math.max(20 * overlayScale, coachmarkWidth - 20 * overlayScale - arrowSize),
  );

  settingsCoachmarkCalloutElement.style.left = `${left}px`;
  settingsCoachmarkCalloutElement.style.top = `${top}px`;
  settingsCoachmarkCalloutElement.style.setProperty(
    "--settings-coachmark-arrow-left",
    `${arrowLeft}px`,
  );
}

function renderSettingsDrawer() {
  settingsDrawerElement.classList.toggle("is-open", state.isSettingsOpen);
  settingsDrawerElement.setAttribute(
    "aria-hidden",
    String(!state.isSettingsOpen),
  );
  settingsDrawerElement.inert = !state.isSettingsOpen;
  settingsBackdropElement.hidden = !state.isSettingsOpen;
  settingsBackdropElement.classList.toggle("is-open", state.isSettingsOpen);
  settingsExerciseToggleElement.checked = state.isExerciseVisible;
  settingsInputNameToggleElement.checked = state.inputNameDisplay.visibleInApp;
  settingsKeyboardToggleElement.checked = state.keyboardDisplay.visibleInApp;
  practiceModeSelectElement.value = state.generationSettings.practiceMode;
  scaleHandsSelectElement.value = state.generationSettings.scaleHands;
  scaleMotionSelectElement.value = state.generationSettings.scaleMotion;
  scaleDirectionSelectElement.value = state.generationSettings.scaleDirection;
  scaleOctavesSelectElement.value =
    state.generationSettings.scaleOctaves.toString();
  scaleTypeSelectElement.value = state.generationSettings.scaleType;
  const isScalesMode = state.generationSettings.practiceMode === "scales";
  const isTriadsMode = state.generationSettings.practiceMode === "triads";
  const isArpeggiosMode = state.generationSettings.practiceMode === "arpeggios";
  const isCadencesMode = state.generationSettings.practiceMode === "cadences";
  const availableTriadTypes = getAvailableTriadTypesForPracticeMode(
    state.generationSettings.practiceMode,
  );

  if (!availableTriadTypes.includes(state.generationSettings.triadType)) {
    state.generationSettings.triadType = "major";
  }

  renderTriadTypeOptions(
    availableTriadTypes,
    state.generationSettings.triadType,
  );
  const isTogetherMotionMode =
    (isScalesMode || isTriadsMode || isArpeggiosMode) &&
    state.generationSettings.scaleHands === "together";
  const isSingleHandDirectionMode =
    (isScalesMode || isTriadsMode || isArpeggiosMode) &&
    state.generationSettings.scaleHands !== "together";
  const areExerciseSettingsVisible = state.isExerciseVisible;
  if (scaleModeNote) {
    scaleModeNote.hidden = !areExerciseSettingsVisible;
  }
  exerciseSettingsHeadingElement.hidden = !areExerciseSettingsVisible;
  practiceModeFieldElement.hidden = !areExerciseSettingsVisible;
  scaleHandsFieldElement.hidden = !areExerciseSettingsVisible;
  scaleMotionFieldElement.hidden =
    !areExerciseSettingsVisible || !isTogetherMotionMode;
  scaleDirectionFieldElement.hidden =
    !areExerciseSettingsVisible || !isSingleHandDirectionMode;
  scaleOctavesFieldElement.hidden =
    !areExerciseSettingsVisible || isCadencesMode;
  tonicFieldElement.hidden = !areExerciseSettingsVisible;
  scaleTypeFieldElement.hidden = !areExerciseSettingsVisible || !isScalesMode;
  triadTypeFieldElement.hidden =
    !areExerciseSettingsVisible ||
    (!isTriadsMode && !isArpeggiosMode && !isCadencesMode);
  triadTypeLabelElement.textContent = isCadencesMode
    ? "Cadence type"
    : isArpeggiosMode
      ? "Arpeggio type"
      : "Triad type";
  renderTonicOptions();
}

function renderMidiDebug() {
  if (!IS_DEV) {
    midiDebugElement.hidden = true;
    midiDebugElement.replaceChildren();
    return;
  }

  midiDebugElement.hidden = !state.isDebugVisible;

  const currentPrompt = state.promptQueue[state.currentPromptIndex] ?? null;
  const displayedHeldNotes = getDisplayedHeldNotes(state);
  const displayedAnalysisHeldNotes = getDisplayedAnalysisHeldNotes(state);
  const displayedSimulatedHeldNotes = getDisplayedSimulatedHeldNotes(state);
  const simulatedHeldKeys = displayedSimulatedHeldNotes.map((noteNumber) =>
    midiNoteNumberToKey(noteNumber, "sharps"),
  );
  const expectedMidiNotes = currentPrompt
    ? getPromptMidiNotes(currentPrompt)
    : [];
  const lastEvent = state.midi.lastEvent
    ? `${state.midi.lastEvent.type} ${applyMidiInputOffset(state.midi.lastEvent.noteNumber)} velocity ${state.midi.lastEvent.velocity}`
    : "none";
  const lines = [
    `Status: ${state.midi.status}`,
    `Device: ${state.midi.deviceName ?? "none"}`,
    `Sustain pedal: ${state.midi.sustainPedalDown ? "down" : "up"}`,
    `Practice mode: ${state.generationSettings.practiceMode}`,
    `Scale hands: ${state.generationSettings.scaleHands}`,
    `Scale motion: ${state.generationSettings.scaleMotion}`,
    `Scale direction: ${state.generationSettings.scaleDirection}`,
    `Scale octaves: ${state.generationSettings.scaleOctaves}`,
    `Tonic: ${state.generationSettings.tonic}`,
    `Scale type: ${state.generationSettings.scaleType}`,
    `Triad type: ${state.generationSettings.triadType}`,
    `Attempt window: ${state.attemptWindowMs}ms`,
    `Key signature: ${getDerivedKeySignature(state.generationSettings)}`,
    `Held keys: ${getDisplayedHeldKeys(state, displayedHeldNotes).join(", ") || "none"}`,
    `Held notes: ${
      displayedHeldNotes.map((note) => note.toString()).join(", ") || "none"
    }`,
    `Simulated held keys: ${simulatedHeldKeys.join(", ") || "none"}`,
    `Simulated held notes: ${
      displayedSimulatedHeldNotes.map((note) => note.toString()).join(", ") ||
      "none"
    }`,
    `Analysis held keys: ${
      displayedAnalysisHeldNotes
        .map((note) => midiNoteNumberToKey(note, "sharps"))
        .join(", ") || "none"
    }`,
    `Analysis held notes: ${
      displayedAnalysisHeldNotes.map((note) => note.toString()).join(", ") ||
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
  midiDebugElement.replaceChildren();

  const controls = document.createElement("div");
  controls.className = "midi-debug-controls";

  const nextPromptButton = document.createElement("button");
  nextPromptButton.type = "button";
  nextPromptButton.className = "midi-debug-button";
  nextPromptButton.textContent = "Next prompt";
  nextPromptButton.addEventListener("click", handlePromptAttempt);
  controls.append(nextPromptButton);

  const content = document.createElement("pre");
  content.className = "midi-debug-content";
  content.textContent = lines.join("\n");

  midiDebugElement.append(controls, content);
}

function renderExerciseNotice() {
  let exerciseNotice: string | null = null;
  let exerciseNoticeButtonText: string | null = null;
  let exerciseNoticeButtonActionText: string | null = null;
  let exerciseNoticeButtonTitle: string | null = null;

  if (state.isExerciseVisible) {
    if (state.generationSettings.practiceMode === "scales") {
      const renderingOptions = getScaleRenderingOptions(
        state.generationSettings,
      );
      const scaleLabel = formatScaleTypeLabelForDisplay(
        state.generationSettings.scaleType,
      );

      if (renderingOptions.alternate) {
        exerciseNoticeButtonText = `Showing as ${renderingOptions.active.tonic} ${scaleLabel}`;
        exerciseNoticeButtonActionText = "Swap";
        exerciseNoticeButtonTitle = `Click to view this exercise as ${renderingOptions.alternate.tonic} ${scaleLabel}.`;
      }

      exerciseNotice = getScaleRenderingNotice(state.generationSettings);
    } else if (state.generationSettings.practiceMode === "triads") {
      const renderingOptions = getTriadRenderingOptions(
        state.generationSettings,
      );
      const triadLabel = `${state.generationSettings.triadType} triads`;

      if (renderingOptions.alternate) {
        exerciseNoticeButtonText = `Showing as ${renderingOptions.active.tonic} ${triadLabel}`;
        exerciseNoticeButtonActionText = "Swap";
        exerciseNoticeButtonTitle = `Click to view this exercise as ${renderingOptions.alternate.tonic} ${triadLabel}.`;
      }

      exerciseNotice = getTriadRenderingNotice(state.generationSettings);
    } else if (state.generationSettings.practiceMode === "arpeggios") {
      const renderingOptions = getArpeggioRenderingOptions(
        state.generationSettings,
      );
      const arpeggioLabel = `${state.generationSettings.triadType} arpeggios`;

      if (renderingOptions.alternate) {
        exerciseNoticeButtonText = `Showing as ${renderingOptions.active.tonic} ${arpeggioLabel}`;
        exerciseNoticeButtonActionText = "Swap";
        exerciseNoticeButtonTitle = `Click to view this exercise as ${renderingOptions.alternate.tonic} ${arpeggioLabel}.`;
      }

      exerciseNotice = getArpeggioRenderingNotice(state.generationSettings);
    } else if (state.generationSettings.practiceMode === "cadences") {
      const renderingOptions = getCadenceRenderingOptions(
        state.generationSettings,
      );
      const cadenceLabel = `${state.generationSettings.triadType} cadences`;

      if (renderingOptions.alternate) {
        exerciseNoticeButtonText = `Showing as ${renderingOptions.active.tonic} ${cadenceLabel}`;
        exerciseNoticeButtonActionText = "Swap";
        exerciseNoticeButtonTitle = `Click to view this exercise as ${renderingOptions.alternate.tonic} ${cadenceLabel}.`;
      }

      exerciseNotice = getCadenceRenderingNotice(state.generationSettings);
    }
  }

  notationElement.dataset.exerciseNoticeVisible = String(
    Boolean(exerciseNotice || exerciseNoticeButtonText),
  );
  exerciseNoticeElement.hidden = !exerciseNotice && !exerciseNoticeButtonText;
  exerciseNoticeElement.dataset.interactive = String(
    Boolean(exerciseNoticeButtonText),
  );
  exerciseNoticeElement.replaceChildren();

  if (exerciseNoticeButtonText) {
    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "exercise-notice-button";
    toggleButton.title = exerciseNoticeButtonTitle ?? "";
    toggleButton.addEventListener("click", handleExerciseRenderingToggle);
    const primaryLine = document.createElement("span");
    primaryLine.className = "exercise-notice-button-primary";
    primaryLine.textContent = exerciseNoticeButtonText;
    toggleButton.append(primaryLine);

    if (exerciseNoticeButtonActionText) {
      const actionLine = document.createElement("span");
      actionLine.className = "exercise-notice-button-action";
      actionLine.textContent = exerciseNoticeButtonActionText;
      toggleButton.append(actionLine);
    }

    exerciseNoticeElement.append(toggleButton);
    return;
  }

  if (exerciseNotice) {
    const noticeChip = document.createElement("span");
    noticeChip.className = "exercise-notice-chip";
    noticeChip.textContent = exerciseNotice;
    exerciseNoticeElement.append(noticeChip);
  }
}

function renderExerciseSummary() {
  const summary = getExerciseSummaryText(state.generationSettings);

  exerciseSummaryElement.hidden = !state.isExerciseVisible || !summary;
  exerciseSummaryElement.replaceChildren();

  if (!state.isExerciseVisible || !summary) {
    return;
  }

  const summaryChip = document.createElement("span");
  summaryChip.className = "exercise-summary-chip";
  summaryChip.textContent = summary;
  exerciseSummaryElement.append(summaryChip);
}

function getExerciseSummaryText(generationSettings: GenerationSettings) {
  if (generationSettings.practiceMode === "scales") {
    const scaleLabel = formatCompactScaleLabel(
      generationSettings.tonic,
      generationSettings.scaleType,
    );
    const octaveLabel = `${generationSettings.scaleOctaves} ${
      generationSettings.scaleOctaves === 1 ? "octave" : "octaves"
    }`;

    if (generationSettings.scaleHands === "together") {
      return `${capitalizeWord(generationSettings.scaleMotion)} | ${scaleLabel} | ${octaveLabel}`;
    }

    return `${capitalizeWord(generationSettings.scaleDirection)} | ${scaleLabel} | ${octaveLabel}`;
  }

  if (generationSettings.practiceMode === "triads") {
    const triadLabel = formatCompactTriadLabel(
      generationSettings.tonic,
      generationSettings.triadType,
    );
    const octaveLabel = `${generationSettings.scaleOctaves} ${
      generationSettings.scaleOctaves === 1 ? "octave" : "octaves"
    }`;

    if (generationSettings.scaleHands === "together") {
      return `${capitalizeWord(generationSettings.scaleMotion)} | ${triadLabel} | ${octaveLabel}`;
    }

    return `${capitalizeWord(generationSettings.scaleDirection)} | ${triadLabel} | ${octaveLabel}`;
  }

  if (generationSettings.practiceMode === "arpeggios") {
    const arpeggioLabel = formatCompactArpeggioLabel(
      generationSettings.tonic,
      generationSettings.triadType,
    );
    const octaveLabel = `${generationSettings.scaleOctaves} ${
      generationSettings.scaleOctaves === 1 ? "octave" : "octaves"
    }`;

    if (generationSettings.scaleHands === "together") {
      return `${capitalizeWord(generationSettings.scaleMotion)} | ${arpeggioLabel} | ${octaveLabel}`;
    }

    return `${capitalizeWord(generationSettings.scaleDirection)} | ${arpeggioLabel} | ${octaveLabel}`;
  }

  if (generationSettings.practiceMode === "cadences") {
    const cadenceLabel = formatCompactCadenceLabel(
      generationSettings.tonic,
      generationSettings.triadType,
    );
    const handsLabel = capitalizeWord(generationSettings.scaleHands);

    return `${handsLabel} | ${cadenceLabel}`;
  }

  return null;
}

function handleExerciseRenderingToggle() {
  state.generationSettings.renderingPreference = getToggledRenderingPreference(
    state.generationSettings.renderingPreference,
  );
  saveStoredSettings();
  resetPromptQueue();
}

function getToggledRenderingPreference(
  renderingPreference: RenderingPreference,
): RenderingPreference {
  return renderingPreference === "preferred" ? "alternate" : "preferred";
}

function formatScaleTypeLabelForDisplay(scaleType: ScaleType) {
  if (scaleType === "major") {
    return "major";
  }

  return scaleType.replaceAll("-", " ");
}

function formatCompactScaleLabel(tonic: Tonic, scaleType: ScaleType) {
  if (scaleType === "major") {
    return `${tonic}M`;
  }

  if (scaleType === "natural-minor") {
    return `${tonic}m`;
  }

  if (scaleType === "harmonic-minor") {
    return `${tonic} harm min`;
  }

  return `${tonic} mel min`;
}

function formatCompactTriadLabel(tonic: Tonic, triadType: TriadType) {
  return `${formatCompactTriadTypeLabel(tonic, triadType)} triads`;
}

function formatCompactCadenceLabel(tonic: Tonic, triadType: TriadType) {
  return triadType === "major" ? `${tonic}M cadences` : `${tonic}m cadences`;
}

function formatCompactArpeggioLabel(tonic: Tonic, triadType: TriadType) {
  return `${formatCompactTriadTypeLabel(tonic, triadType)} arpeggios`;
}

function formatCompactTriadTypeLabel(tonic: Tonic, triadType: TriadType) {
  if (triadType === "major") {
    return `${tonic}M`;
  }

  if (triadType === "minor") {
    return `${tonic}m`;
  }

  if (triadType === "diminished") {
    return `${tonic}dim`;
  }

  return `${tonic}aug`;
}

function capitalizeWord(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function renderNotation() {
  notationElement.hidden = !state.isExerciseVisible;

  if (!state.isExerciseVisible) {
    notationCanvasElement.replaceChildren();
    return;
  }

  if (!areNotationFontsReady) {
    notationCanvasElement.replaceChildren();

    const loadingMessage = document.createElement("p");
    loadingMessage.className = "notation-loading";
    loadingMessage.textContent = "Loading notation...";
    notationCanvasElement.append(loadingMessage);
    return;
  }

  renderGrandStaff(notationCanvasElement, state);
}

function renderKeyboard(
  keyboardOptions = getCurrentKeyboardDisplayOptions(),
  analysis = getCurrentInputAnalysis(),
) {
  keyboardDisplayElement.hidden = !state.keyboardDisplay.visibleInApp;

  if (!state.keyboardDisplay.visibleInApp) {
    keyboardDisplayElement.replaceChildren();
  } else {
    renderKeyboardDisplay(keyboardDisplayElement, {
      ...keyboardOptions,
      fitMode: isPortraitViewport() ? "contain" : "width",
      showPopoutButton: true,
      onPopout: handleKeyboardPopoutClick,
      popoutButtonLabel: "Pop out",
      popoutButtonTitle: "Open the keyboard display in a separate window.",
      showSecondaryPopoutButton: true,
      onSecondaryPopout: handleCombinedPopoutClick,
      secondaryPopoutButtonLabel: "w/ input analysis",
      secondaryPopoutButtonTitle:
        "Open the keyboard with input naming in a separate window.",
    });
  }

  renderKeyboardPopout(keyboardOptions);
  renderCombinedPopout(analysis, keyboardOptions);
}

function getCurrentKeyboardDisplayOptions() {
  const currentPrompt = state.promptQueue[state.currentPromptIndex];

  return {
    activeNotes:
      state.isExerciseVisible && currentPrompt
        ? getPromptMidiNotes(currentPrompt)
        : [],
    heldNotes: getDisplayedHeldNotes(state),
    startMidiNote: KEYBOARD_START_MIDI_NOTE,
    endMidiNote: KEYBOARD_END_MIDI_NOTE,
  };
}

function renderInputName(analysis = getCurrentInputAnalysis()) {
  const selectedVariantKey = syncSelectedInputNameVariant(analysis);

  inputNameDisplayElement.hidden = !state.inputNameDisplay.visibleInApp;

  if (!state.inputNameDisplay.visibleInApp) {
    inputNameDisplayElement.replaceChildren();
  } else {
    renderInputNameDisplay(inputNameDisplayElement, analysis, {
      showPopoutButton: true,
      onPopout: handleInputNamePopoutClick,
      popoutButtonLabel: "Pop out",
      popoutButtonTitle: "Open the input name display in a separate window.",
      showSecondaryPopoutButton: true,
      onSecondaryPopout: handleCombinedPopoutClick,
      secondaryPopoutButtonLabel: "w/ keyboard",
      secondaryPopoutButtonTitle:
        "Open the input name display with the keyboard in a separate window.",
      selectedVariantKey,
      onSelectVariant: handleInputNameVariantSelect,
    });
  }

  renderInputNamePopout(analysis);
}

function getCurrentInputAnalysis() {
  return analyzeHeldInput(getDisplayedAnalysisHeldNotes(state));
}

function syncSelectedInputNameVariant(analysis: InputAnalysis) {
  const variants = analysis.primary
    ? [analysis.primary, ...analysis.alternates]
    : [];

  if (variants.length === 0) {
    state.selectedInputNameVariantKey = null;
    return null;
  }

  if (
    state.selectedInputNameVariantKey &&
    variants.some(
      (variant) =>
        getInputNameVariantKey(variant) === state.selectedInputNameVariantKey,
    )
  ) {
    return state.selectedInputNameVariantKey;
  }

  const primaryKey = getInputNameVariantKey(variants[0]);
  state.selectedInputNameVariantKey = primaryKey;
  return primaryKey;
}

function handleInputNameVariantSelect(variantKey: string) {
  if (state.selectedInputNameVariantKey === variantKey) {
    return;
  }

  state.selectedInputNameVariantKey = variantKey;
  renderApp();
}

function handleInputNamePopoutClick() {
  if (inputNamePopoutHandle && !inputNamePopoutHandle.window.closed) {
    state.inputNameDisplay.popoutMode = "panel";
    inputNamePopoutHandle.window.focus();
    renderInputNamePopout(getCurrentInputAnalysis());
    return;
  }

  const popoutWindow = window.open(
    "",
    "grand-staff-trainer-input-name",
    "popup=yes,width=1500,height=1500,resizable=yes,scrollbars=yes",
  );

  if (!popoutWindow) {
    return;
  }

  state.inputNameDisplay.popoutMode = "panel";

  popoutWindow.document.open();
  popoutWindow.document.write(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Input Name</title>
      </head>
      <body class="input-name-popout-body">
        <div id="input-name-popout-root"></div>
      </body>
    </html>
  `);
  popoutWindow.document.close();

  for (const node of document.head.querySelectorAll(
    'link[rel="stylesheet"], style',
  )) {
    popoutWindow.document.head.append(node.cloneNode(true));
  }

  const popoutStyle = popoutWindow.document.createElement("style");
  popoutStyle.textContent = `
    body.input-name-popout-body {
      margin: 0;
      min-height: 100vh;
      overflow: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: #f7f1e4;
      font-size: calc(1rem * var(--ui-scale));
    }

    #input-name-popout-root {
      flex: 1 1 auto;
      display: flex;
      width: 100%;
      height: 100%;
      min-height: 0;
      min-width: 0;
      align-items: center;
      justify-content: center;
    }

    #input-name-popout-root .input-name-display {
      flex: 1 1 auto;
      width: 100%;
      height: 100%;
      min-height: 0;
      max-width: 100%;
    }

    #input-name-popout-root .input-name-content-wrap,
    #input-name-popout-root .input-name-status-wrap {
      align-items: center;
      text-align: center;
    }

    #input-name-popout-root .input-name-reading-row {
      justify-content: center;
    }

    #input-name-popout-root .input-name-note-list,
    #input-name-popout-root .input-name-longhand,
    #input-name-popout-root .input-name-status {
      text-align: center;
    }

    #input-name-popout-root .input-name-longhand {
      max-width: min(100%, calc(640px * var(--ui-scale)));
      min-height: 0;
    }

    #input-name-popout-root .panel-popout-button {
      display: none;
    }
  `;
  popoutWindow.document.head.append(popoutStyle);

  const popoutContainer = popoutWindow.document.querySelector<HTMLDivElement>(
    "#input-name-popout-root",
  );

  if (!popoutContainer) {
    popoutWindow.close();
    return;
  }

  const handleResize = () => {
    syncInputNamePopoutScale();
    renderInputNamePopout(getCurrentInputAnalysis());
  };
  const handleBeforeUnload = () => {
    cleanupInputNamePopout();
  };

  popoutWindow.addEventListener("resize", handleResize);
  popoutWindow.addEventListener("beforeunload", handleBeforeUnload);

  inputNamePopoutHandle = {
    window: popoutWindow,
    container: popoutContainer,
    handleResize,
    handleBeforeUnload,
  };

  syncInputNamePopoutScale();
  renderInputNamePopout(getCurrentInputAnalysis());
  popoutWindow.focus();
}

function renderInputNamePopout(analysis = getCurrentInputAnalysis()) {
  if (state.inputNameDisplay.popoutMode === "none") {
    cleanupInputNamePopout();
    return;
  }

  if (!inputNamePopoutHandle || inputNamePopoutHandle.window.closed) {
    cleanupInputNamePopout();
    return;
  }

  renderInputNameDisplay(inputNamePopoutHandle.container, analysis, {
    selectedVariantKey: syncSelectedInputNameVariant(analysis),
    onSelectVariant: handleInputNameVariantSelect,
  });
}

function syncInputNamePopoutScale() {
  if (!inputNamePopoutHandle || inputNamePopoutHandle.window.closed) {
    cleanupInputNamePopout();
    return;
  }

  const availableWidth = Math.max(
    1,
    inputNamePopoutHandle.window.innerWidth - 32,
  );
  const availableHeight = Math.max(
    1,
    inputNamePopoutHandle.window.innerHeight - 32,
  );
  const widthScale = availableWidth / INPUT_NAME_POPOUT_BASE_WIDTH;
  const heightScale = availableHeight / INPUT_NAME_POPOUT_BASE_HEIGHT;
  const uiScale = Math.max(0.8, Math.min(widthScale, heightScale));

  inputNamePopoutHandle.window.document.documentElement.style.setProperty(
    "--ui-scale",
    uiScale.toFixed(3),
  );
}

function cleanupInputNamePopout() {
  if (!inputNamePopoutHandle) {
    if (state.inputNameDisplay.popoutMode !== "none") {
      state.inputNameDisplay.popoutMode = "none";
      renderApp();
    }
    return;
  }

  if (!inputNamePopoutHandle.window.closed) {
    inputNamePopoutHandle.window.removeEventListener(
      "resize",
      inputNamePopoutHandle.handleResize,
    );
    inputNamePopoutHandle.window.removeEventListener(
      "beforeunload",
      inputNamePopoutHandle.handleBeforeUnload,
    );
  }

  inputNamePopoutHandle = null;
  if (state.inputNameDisplay.popoutMode !== "none") {
    state.inputNameDisplay.popoutMode = "none";
    renderApp();
  }
}

function handleWindowBeforeUnload() {
  if (inputNamePopoutHandle && !inputNamePopoutHandle.window.closed) {
    inputNamePopoutHandle.window.close();
  }

  if (keyboardPopoutHandle && !keyboardPopoutHandle.window.closed) {
    keyboardPopoutHandle.window.close();
  }

  if (combinedPopoutHandle && !combinedPopoutHandle.window.closed) {
    combinedPopoutHandle.window.close();
  }
}

function handleCombinedPopoutClick() {
  if (combinedPopoutHandle && !combinedPopoutHandle.window.closed) {
    combinedPopoutHandle.window.focus();
    renderCombinedPopout(
      getCurrentInputAnalysis(),
      getCurrentKeyboardDisplayOptions(),
    );
    return;
  }

  const popoutWindow = window.open(
    "",
    "grand-staff-trainer-combined",
    "popup=yes,width=3500,height=1500,resizable=yes,scrollbars=yes",
  );

  if (!popoutWindow) {
    return;
  }

  popoutWindow.document.open();
  popoutWindow.document.write(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Input Naming + Keyboard</title>
      </head>
      <body class="combined-popout-body">
        <div id="combined-popout-root">
          <section id="combined-popout-input-section">
            <div id="combined-popout-input-content"></div>
          </section>
          <div id="combined-popout-keyboard-content"></div>
        </div>
      </body>
    </html>
  `);
  popoutWindow.document.close();

  for (const node of document.head.querySelectorAll(
    'link[rel="stylesheet"], style',
  )) {
    popoutWindow.document.head.append(node.cloneNode(true));
  }

  const popoutStyle = popoutWindow.document.createElement("style");
  popoutStyle.textContent = `
    body.combined-popout-body {
      margin: 0;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #f7f1e4;
    }

    #combined-popout-root {
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto;
      overflow: hidden;
    }

    #combined-popout-input-section {
      min-height: 0;
      display: flex;
      align-items: stretch;
      overflow: hidden;
      background: #f7f1e4;
    }

    #combined-popout-input-content {
      flex: 1 1 auto;
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      font-size: calc(1rem * var(--ui-scale));
    }

    #combined-popout-input-content .input-name-display {
      width: 100%;
      height: 100%;
      min-height: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      padding: 0;
    }

    #combined-popout-input-content .input-name-content-wrap,
    #combined-popout-input-content .input-name-status-wrap {
      align-items: center;
      text-align: center;
    }

    #combined-popout-input-content .input-name-reading-row {
      justify-content: center;
    }

    #combined-popout-input-content .input-name-note-list,
    #combined-popout-input-content .input-name-longhand,
    #combined-popout-input-content .input-name-status {
      text-align: center;
    }

    #combined-popout-input-content .input-name-longhand {
      max-width: min(100%, calc(760px * var(--ui-scale)));
    }

    #combined-popout-input-content .panel-popout-button {
      display: none;
    }

    #combined-popout-keyboard-content {
      min-width: 0;
      min-height: 0;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      overflow: hidden;
      background: #f7f1e4;
    }

    #combined-popout-keyboard-content .panel-popout-button {
      display: none;
    }
  `;
  popoutWindow.document.head.append(popoutStyle);

  const inputContainer = popoutWindow.document.querySelector<HTMLDivElement>(
    "#combined-popout-input-content",
  );
  const keyboardContainer = popoutWindow.document.querySelector<HTMLDivElement>(
    "#combined-popout-keyboard-content",
  );

  if (!inputContainer || !keyboardContainer) {
    popoutWindow.close();
    return;
  }

  const handleResize = () => {
    syncCombinedPopoutScale();
    renderCombinedPopout(
      getCurrentInputAnalysis(),
      getCurrentKeyboardDisplayOptions(),
    );
  };
  const handleBeforeUnload = () => {
    cleanupCombinedPopout();
  };

  popoutWindow.addEventListener("resize", handleResize);
  popoutWindow.addEventListener("beforeunload", handleBeforeUnload);

  combinedPopoutHandle = {
    window: popoutWindow,
    inputContainer,
    keyboardContainer,
    handleResize,
    handleBeforeUnload,
  };

  syncCombinedPopoutScale();
  renderCombinedPopout(
    getCurrentInputAnalysis(),
    getCurrentKeyboardDisplayOptions(),
  );
  popoutWindow.focus();
}

function handleKeyboardPopoutClick() {
  if (keyboardPopoutHandle && !keyboardPopoutHandle.window.closed) {
    state.keyboardDisplay.popoutMode = "panel";
    keyboardPopoutHandle.window.focus();
    renderKeyboardPopout(getCurrentKeyboardDisplayOptions());
    return;
  }

  const popoutWindow = window.open(
    "",
    "grand-staff-trainer-keyboard",
    "popup=yes,width=3500,height=600,resizable=yes,scrollbars=yes",
  );

  if (!popoutWindow) {
    return;
  }

  state.keyboardDisplay.popoutMode = "panel";

  popoutWindow.document.open();
  popoutWindow.document.write(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Keyboard</title>
      </head>
      <body class="keyboard-popout-body">
        <div id="keyboard-popout-root">
          <button
            id="keyboard-popout-fit-button"
            class="toolbar-button keyboard-popout-fit-button"
            type="button"
          >
            Fit window
          </button>
          <div id="keyboard-popout-content"></div>
        </div>
      </body>
    </html>
  `);
  popoutWindow.document.close();

  for (const node of document.head.querySelectorAll(
    'link[rel="stylesheet"], style',
  )) {
    popoutWindow.document.head.append(node.cloneNode(true));
  }

  const popoutStyle = popoutWindow.document.createElement("style");
  popoutStyle.textContent = `
    body.keyboard-popout-body {
      --keyboard-white-key-width: calc(18px * var(--ui-scale));
      --keyboard-white-key-height: calc(120px * var(--ui-scale));
      --keyboard-black-key-width: calc(11px * var(--ui-scale));
      --keyboard-black-key-height: calc(72px * var(--ui-scale));
      margin: 0;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f7f1e4;
      font-size: calc(1rem * var(--ui-scale));
    }

    #keyboard-popout-root {
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      display: grid;
      grid-template-rows: auto 1fr;
      align-items: stretch;
      justify-items: start;
      padding: ${KEYBOARD_POPOUT_ROOT_PADDING}px;
      overflow: hidden;
    }

    #keyboard-popout-content {
      box-sizing: border-box;
      width: 100%;
      min-height: 0;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      overflow: hidden;
    }

    #keyboard-popout-content .keyboard-frame {
      margin: 0;
    }

    #keyboard-popout-root .panel-popout-button {
      display: none;
    }

    .keyboard-popout-fit-button {
      z-index: 1;
    }
  `;
  popoutWindow.document.head.append(popoutStyle);

  const popoutContainer = popoutWindow.document.querySelector<HTMLDivElement>(
    "#keyboard-popout-content",
  );
  const fitWindowButton =
    popoutWindow.document.querySelector<HTMLButtonElement>(
      "#keyboard-popout-fit-button",
    );

  if (!popoutContainer || !fitWindowButton) {
    popoutWindow.close();
    return;
  }

  const handleResize = () => {
    syncKeyboardPopoutScale();
    renderKeyboardPopout(getCurrentKeyboardDisplayOptions());
  };
  const handleBeforeUnload = () => {
    cleanupKeyboardPopout();
  };

  popoutWindow.addEventListener("resize", handleResize);
  popoutWindow.addEventListener("beforeunload", handleBeforeUnload);
  fitWindowButton.addEventListener("click", () => {
    fitKeyboardPopoutWindow(2);
  });

  keyboardPopoutHandle = {
    window: popoutWindow,
    container: popoutContainer,
    fitButton: fitWindowButton,
    handleResize,
    handleBeforeUnload,
  };

  syncKeyboardPopoutScale();
  renderKeyboardPopout(getCurrentKeyboardDisplayOptions());
  fitKeyboardPopoutWindow(2);
  popoutWindow.focus();
}

function renderKeyboardPopout(options = getCurrentKeyboardDisplayOptions()) {
  if (state.keyboardDisplay.popoutMode === "none") {
    cleanupKeyboardPopout();
    return;
  }

  if (!keyboardPopoutHandle || keyboardPopoutHandle.window.closed) {
    cleanupKeyboardPopout();
    return;
  }

  renderKeyboardDisplay(keyboardPopoutHandle.container, {
    ...options,
    fitMode: "contain",
  });
}

function fitKeyboardPopoutWindow(settlePasses = 0) {
  if (!keyboardPopoutHandle || keyboardPopoutHandle.window.closed) {
    cleanupKeyboardPopout();
    return;
  }

  const popoutWindow = keyboardPopoutHandle.window;
  const fitButtonHeight = keyboardPopoutHandle.fitButton.offsetHeight;
  const renderedKeyboardFrame =
    keyboardPopoutHandle.container.querySelector<HTMLDivElement>(
      ".keyboard-frame",
    );

  if (!renderedKeyboardFrame) {
    return;
  }

  const idealKeyboardHeight = renderedKeyboardFrame.offsetHeight;
  const idealInnerHeight =
    KEYBOARD_POPOUT_ROOT_PADDING * 2 + fitButtonHeight + idealKeyboardHeight;
  const chromeHeight = Math.max(
    0,
    popoutWindow.outerHeight - popoutWindow.innerHeight,
  );

  try {
    popoutWindow.resizeTo(
      popoutWindow.outerWidth,
      Math.max(idealInnerHeight + chromeHeight, 220),
    );
  } catch {
    return;
  }

  if (settlePasses <= 0) {
    return;
  }

  popoutWindow.setTimeout(() => {
    if (!keyboardPopoutHandle || keyboardPopoutHandle.window !== popoutWindow) {
      return;
    }

    fitKeyboardPopoutWindow(settlePasses - 1);
  }, 120);
}

function syncKeyboardPopoutScale() {
  if (!keyboardPopoutHandle || keyboardPopoutHandle.window.closed) {
    cleanupKeyboardPopout();
    return;
  }

  const availableWidth = Math.max(
    1,
    keyboardPopoutHandle.window.innerWidth - KEYBOARD_POPOUT_ROOT_PADDING * 2,
  );
  const availableHeight = Math.max(
    1,
    keyboardPopoutHandle.window.innerHeight -
      KEYBOARD_POPOUT_ROOT_PADDING * 2 -
      keyboardPopoutHandle.fitButton.offsetHeight,
  );
  const widthScale = availableWidth / KEYBOARD_POPOUT_BASE_WIDTH;
  const heightScale = availableHeight / KEYBOARD_POPOUT_BASE_HEIGHT;
  const uiScale = Math.max(0.8, Math.min(widthScale, heightScale));

  keyboardPopoutHandle.window.document.documentElement.style.setProperty(
    "--ui-scale",
    uiScale.toFixed(3),
  );
}

function renderCombinedPopout(
  analysis = getCurrentInputAnalysis(),
  keyboardOptions = getCurrentKeyboardDisplayOptions(),
) {
  if (!combinedPopoutHandle) {
    return;
  }

  if (combinedPopoutHandle.window.closed) {
    cleanupCombinedPopout();
    return;
  }

  renderInputNameDisplay(combinedPopoutHandle.inputContainer, analysis, {
    selectedVariantKey: syncSelectedInputNameVariant(analysis),
    onSelectVariant: handleInputNameVariantSelect,
  });
  renderKeyboardDisplay(combinedPopoutHandle.keyboardContainer, {
    ...keyboardOptions,
    fitMode: "width",
  });
}

function syncCombinedPopoutScale() {
  if (!combinedPopoutHandle) {
    return;
  }

  if (combinedPopoutHandle.window.closed) {
    cleanupCombinedPopout();
    return;
  }

  const inputAvailableWidth = Math.max(
    1,
    combinedPopoutHandle.inputContainer.clientWidth,
  );
  const inputAvailableHeight = Math.max(
    1,
    combinedPopoutHandle.inputContainer.clientHeight,
  );
  const inputWidthScale = inputAvailableWidth / INPUT_NAME_POPOUT_BASE_WIDTH;
  const inputHeightScale = inputAvailableHeight / INPUT_NAME_POPOUT_BASE_HEIGHT;
  const inputScale = Math.max(0.8, Math.min(inputWidthScale, inputHeightScale));

  const keyboardAvailableWidth = Math.max(
    1,
    combinedPopoutHandle.keyboardContainer.clientWidth,
  );
  const keyboardScale = Math.max(
    0.8,
    keyboardAvailableWidth / KEYBOARD_POPOUT_BASE_WIDTH,
  );

  combinedPopoutHandle.inputContainer.style.setProperty(
    "--ui-scale",
    inputScale.toFixed(3),
  );
  combinedPopoutHandle.inputContainer.style.fontSize = `${inputScale.toFixed(3)}rem`;
  combinedPopoutHandle.keyboardContainer.style.setProperty(
    "--ui-scale",
    keyboardScale.toFixed(3),
  );
  combinedPopoutHandle.keyboardContainer.style.setProperty(
    "--keyboard-white-key-width",
    `calc(18px * ${keyboardScale.toFixed(3)})`,
  );
  combinedPopoutHandle.keyboardContainer.style.setProperty(
    "--keyboard-white-key-height",
    `calc(120px * ${keyboardScale.toFixed(3)})`,
  );
  combinedPopoutHandle.keyboardContainer.style.setProperty(
    "--keyboard-black-key-width",
    `calc(11px * ${keyboardScale.toFixed(3)})`,
  );
  combinedPopoutHandle.keyboardContainer.style.setProperty(
    "--keyboard-black-key-height",
    `calc(72px * ${keyboardScale.toFixed(3)})`,
  );
}

function cleanupCombinedPopout() {
  if (!combinedPopoutHandle) {
    return;
  }

  if (!combinedPopoutHandle.window.closed) {
    combinedPopoutHandle.window.removeEventListener(
      "resize",
      combinedPopoutHandle.handleResize,
    );
    combinedPopoutHandle.window.removeEventListener(
      "beforeunload",
      combinedPopoutHandle.handleBeforeUnload,
    );
  }

  combinedPopoutHandle = null;
}

function cleanupKeyboardPopout() {
  if (!keyboardPopoutHandle) {
    if (state.keyboardDisplay.popoutMode !== "none") {
      state.keyboardDisplay.popoutMode = "none";
      renderApp();
    }
    return;
  }

  if (!keyboardPopoutHandle.window.closed) {
    keyboardPopoutHandle.window.removeEventListener(
      "resize",
      keyboardPopoutHandle.handleResize,
    );
    keyboardPopoutHandle.window.removeEventListener(
      "beforeunload",
      keyboardPopoutHandle.handleBeforeUnload,
    );
  }

  keyboardPopoutHandle = null;
  if (state.keyboardDisplay.popoutMode !== "none") {
    state.keyboardDisplay.popoutMode = "none";
    renderApp();
  }
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

function handlePromptAttempt() {
  const currentPrompt = state.promptQueue[state.currentPromptIndex];

  if (!currentPrompt) {
    return;
  }

  state.simulatedHeldNotes = getPromptMidiNotes(currentPrompt).map(
    (noteNumber) => removeMidiInputOffset(noteNumber),
  );
  syncHeldOverlayPresentations();
  const attempt = createFakeAttempt(currentPrompt);

  processPromptAttempt(currentPrompt, attempt);
}

function toggleSettingsDrawer() {
  dismissSettingsCoachmark(false);
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

function handleUtilityButtonClick() {
  if (IS_DEV) {
    toggleDebugPanel();
    return;
  }

  if (!SHOW_GUIDE_BUTTON) {
    return;
  }

  state.isSettingsCoachmarkOpen = true;
  renderApp();
}

function handleSettingsCoachmarkDismiss() {
  dismissSettingsCoachmark();
}

function handleSettingsCoachmarkCalloutClick(event: MouseEvent) {
  const target = event.target;

  if (
    target instanceof Element &&
    target.closest("#settings-coachmark-guide-button")
  ) {
    event.stopPropagation();

    dismissSettingsCoachmark(false);

    if (!GUIDE_URL) {
      renderApp();
      return;
    }

    window.open(GUIDE_URL, "_blank", "noopener,noreferrer");
    renderApp();
    return;
  }

  dismissSettingsCoachmark(false);
  renderApp();
}

function handleKeyboardToggleChange() {
  state.keyboardDisplay.visibleInApp = settingsKeyboardToggleElement.checked;
  saveStoredSettings();
  renderApp();
}

function handleExerciseToggleChange() {
  state.isExerciseVisible = settingsExerciseToggleElement.checked;
  saveStoredSettings();
  renderApp();
}

function handleInputNameToggleChange() {
  state.inputNameDisplay.visibleInApp = settingsInputNameToggleElement.checked;
  saveStoredSettings();
  renderApp();
}

function handlePracticeModeChange() {
  state.generationSettings.practiceMode =
    practiceModeSelectElement.value as PracticeMode;

  if (
    state.generationSettings.practiceMode === "cadences" &&
    !isCadenceTriadType(state.generationSettings.triadType)
  ) {
    state.generationSettings.triadType = "major";
  }

  resetRenderingPreference();
  saveStoredSettings();
  resetPromptQueue();
}

function handleScaleHandsChange() {
  state.generationSettings.scaleHands =
    scaleHandsSelectElement.value as ScaleHands;

  if (state.generationSettings.scaleHands !== "together") {
    state.generationSettings.scaleMotion = "parallel";
  } else {
    state.generationSettings.scaleDirection = "ascending";
  }

  saveStoredSettings();
  resetPromptQueue();
}

function handleScaleMotionChange() {
  state.generationSettings.scaleMotion =
    scaleMotionSelectElement.value as ScaleMotion;
  saveStoredSettings();
  resetPromptQueue();
}

function handleScaleDirectionChange() {
  state.generationSettings.scaleDirection =
    scaleDirectionSelectElement.value as ScaleDirection;
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

function handleTonicChange() {
  state.generationSettings.tonic = tonicSelectElement.value as Tonic;
  resetRenderingPreference();
  saveStoredSettings();
  resetPromptQueue();
}

function handleScaleTypeChange() {
  state.generationSettings.scaleType =
    scaleTypeSelectElement.value as ScaleType;
  resetRenderingPreference();
  saveStoredSettings();
  resetPromptQueue();
}

function handleTriadTypeChange() {
  state.generationSettings.triadType =
    triadTypeSelectElement.value as TriadType;

  if (
    state.generationSettings.practiceMode === "cadences" &&
    !isCadenceTriadType(state.generationSettings.triadType)
  ) {
    state.generationSettings.triadType = "major";
  }

  resetRenderingPreference();
  saveStoredSettings();
  resetPromptQueue();
}

function getAvailableTriadTypesForPracticeMode(
  practiceMode: PracticeMode,
): readonly TriadType[] {
  if (practiceMode === "cadences") {
    return ["major", "minor"] as const;
  }

  if (practiceMode === "triads" || practiceMode === "arpeggios") {
    return ["major", "minor", "augmented", "diminished"] as const;
  }

  return [] as const;
}

function renderTriadTypeOptions(
  triadTypes: readonly TriadType[],
  selectedTriadType: TriadType,
) {
  const optionLabels: Record<TriadType, string> = {
    major: "Major",
    minor: "Minor",
    diminished: "Diminished",
    augmented: "Augmented",
  };

  triadTypeSelectElement.replaceChildren(
    ...triadTypes.map((triadType) => {
      const option = document.createElement("option");
      option.value = triadType;
      option.textContent = optionLabels[triadType];
      return option;
    }),
  );
  triadTypeSelectElement.value = selectedTriadType;
}

function isCadenceTriadType(
  triadType: TriadType,
): triadType is Extract<TriadType, "major" | "minor"> {
  return triadType === "major" || triadType === "minor";
}

function resetRenderingPreference() {
  state.generationSettings.renderingPreference = "preferred";
}

function createFakeAttempt(prompt: PromptSlot): PromptAttempt {
  return {
    midiNotes: applyMidiInputOffsetToNotes(
      getPromptMidiNotes(prompt).map((noteNumber) =>
        removeMidiInputOffset(noteNumber),
      ),
    ),
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
  pendingAttemptMidiNotes.add(applyMidiInputOffset(noteNumber));

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
    state.generationSettings.practiceMode === "triads" ||
    state.generationSettings.practiceMode === "arpeggios" ||
    state.generationSettings.practiceMode === "cadences"
  ) {
    if (consumedPrompt) {
      const notationProfile = getExerciseNotationProfile(
        state.generationSettings,
      );

      if (notationProfile) {
        state.currentMeasureOffsetBeats =
          (state.currentMeasureOffsetBeats +
            getDurationBeats(consumedPrompt.duration)) %
          notationProfile.beatsPerMeasure;
      }

      state.promptQueue.push(consumedPrompt);
    }

    advancePastNonPlayablePrompts();

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
  state.heldOverlayPresentations.clear();
  state.simulatedHeldNotes = [];
  state.promptQueue = createPromptQueue(
    PROMPT_QUEUE_LENGTH,
    state.generationSettings,
  );
  state.currentPromptIndex = 0;
  state.currentMeasureOffsetBeats = 0;
  advancePastNonPlayablePrompts();
  renderApp();
}

function advancePastNonPlayablePrompts() {
  const notationProfile = getExerciseNotationProfile(state.generationSettings);
  let safetyCounter = 0;

  while (
    state.promptQueue[0]?.isPlayable === false &&
    safetyCounter < state.promptQueue.length
  ) {
    const skippedPrompt = state.promptQueue.shift();

    if (!skippedPrompt) {
      break;
    }

    if (notationProfile) {
      state.currentMeasureOffsetBeats =
        (state.currentMeasureOffsetBeats +
          getDurationBeats(skippedPrompt.duration)) %
        notationProfile.beatsPerMeasure;
    }

    state.promptQueue.push(skippedPrompt);
    safetyCounter += 1;
  }
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
  stemDirection?: 1 | -1,
  accidentalOverrides?: PromptAccidentalOverride[],
) {
  const note = new StaveNote({
    clef,
    keys,
    duration,
    stemDirection,
  });

  if (inlineClefChangeBefore) {
    note.addModifier(
      new NoteSubGroup([new ClefNote(inlineClefChangeBefore, "small")]),
      0,
    );
  }

  for (const [index, key] of keys.entries()) {
    const accidentalOverride = accidentalOverrides?.find(
      (override) => override.key === key,
    );
    const accidental =
      accidentalOverride?.accidental ??
      getRenderedAccidentalForKey(key, displayedKeySignature);

    if (accidental) {
      note.addModifier(new Accidental(accidental), index);
    }
  }

  return note;
}

function getStemDirectionForPromptSource(
  sourceHand: "treble" | "bass",
  displayedClef: "treble" | "bass",
  isExplicitDisplayedClefShift = false,
) {
  if (
    sourceHand === "bass" &&
    displayedClef === "treble" &&
    isExplicitDisplayedClefShift
  ) {
    return 1;
  }

  return sourceHand === "treble" ? 1 : -1;
}

function getTogetherScaleDisplayedStaff(
  appState: AppState,
  sourceHand: "treble" | "bass",
  key: string,
) {
  if (
    appState.generationSettings.practiceMode === "arpeggios" ||
    appState.generationSettings.practiceMode === "scales"
  ) {
    if (appState.generationSettings.practiceMode === "scales") {
      return getDisplayedScaleStaff(appState, sourceHand, key);
    }

    if (appState.generationSettings.scaleMotion === "contrary") {
      return sourceHand;
    }

    return sourceHand === "treble" ? "treble" : getClefForKey(key);
  }

  return getClefForKey(key);
}

function getDisplayedScaleStaff(
  appState: AppState,
  sourceHand: "treble" | "bass",
  key: string,
) {
  if (
    appState.generationSettings.scaleHands === "together" &&
    appState.generationSettings.scaleMotion === "contrary"
  ) {
    return sourceHand;
  }

  const leadingHand =
    appState.generationSettings.scaleDirection === "descending"
      ? "bass"
      : "treble";

  if (sourceHand === leadingHand) {
    return sourceHand;
  }

  return getClefForKey(key);
}

function renderGrandStaff(container: HTMLDivElement, appState: AppState) {
  container.replaceChildren();

  const uiScale = getUiScale();
  const visualWidth = Math.max(MIN_RENDER_WIDTH, container.clientWidth - 8);
  const visualHeight =
    container.clientHeight > 0 ? container.clientHeight : DEFAULT_RENDER_HEIGHT;
  const renderWidthTarget = isPortraitViewport()
    ? visualWidth * PORTRAIT_RENDER_WIDTH_RATIO
    : visualWidth;
  const width = Math.max(
    isPortraitViewport() ? PORTRAIT_MIN_RENDER_WIDTH : MIN_RENDER_WIDTH,
    renderWidthTarget / uiScale,
  );
  const height = Math.max(DEFAULT_RENDER_HEIGHT, visualHeight / uiScale);

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  const centeredBraceTopY =
    height / 2 - STAVE_BRACE_CENTER_OFFSET + STAVE_VERTICAL_OPTICAL_OFFSET;
  const staveTopY = centeredBraceTopY;
  const bassStaveY = staveTopY + STAVE_GAP;

  renderer.resize(width, height);

  const context = renderer.getContext();
  const staveX = STAVE_SIDE_MARGIN;
  const staveWidth = width - STAVE_SIDE_MARGIN * 2;
  const trebleStave = new Stave(staveX, staveTopY, staveWidth);
  const bassStave = new Stave(staveX, bassStaveY, staveWidth);
  const displayedKeySignature = getDisplayedKeySignature(appState);
  const exerciseNotationProfile = getExerciseNotationProfile(
    appState.generationSettings,
  );

  trebleStave.addClef("treble");
  bassStave.addClef("bass");

  if (displayedKeySignature) {
    trebleStave.addKeySignature(displayedKeySignature);
    bassStave.addKeySignature(displayedKeySignature);
  }

  if (exerciseNotationProfile) {
    trebleStave.addTimeSignature(exerciseNotationProfile.timeSignature);
    bassStave.addTimeSignature(exerciseNotationProfile.timeSignature);
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
  const currentSecondaryPromptNotes: StaveNote[] = [];
  const currentTrebleHeldOverlayNotes: StaveNote[] = [];
  const currentBassHeldOverlayNotes: StaveNote[] = [];
  const promptAnnotationDrawInstructions: Array<{
    text: string;
    placement: "above" | "below";
    anchorStaff: "treble" | "bass";
    index: number;
  }> = [];
  const secondaryPromptDrawInstructions: Array<{
    note: StaveNote;
    anchorStaff: "treble" | "bass";
    index: number;
  }> = [];

  for (const [index, prompt] of appState.promptQueue.entries()) {
    const displayedPrompt = displayedPrompts[index];

    if (!displayedPrompt) {
      continue;
    }

    let trebleNote: StaveNote;
    let bassNote: StaveNote;
    let trebleSecondaryNote: StaveNote | null = null;
    let bassSecondaryNote: StaveNote | null = null;

    if (
      (appState.generationSettings.practiceMode === "scales" ||
        appState.generationSettings.practiceMode === "arpeggios") &&
      appState.generationSettings.scaleHands === "together"
    ) {
      const actualTrebleKey = prompt.trebleKeys?.[0];
      const actualBassKey = prompt.bassKeys?.[0];

      if (!actualTrebleKey || !actualBassKey) {
        throw new Error("Together-hand scale prompt is missing a hand note.");
      }

      const trebleDisplayedStaff = getTogetherScaleDisplayedStaff(
        appState,
        "treble",
        actualTrebleKey,
      );
      const bassDisplayedStaff = getTogetherScaleDisplayedStaff(
        appState,
        "bass",
        actualBassKey,
      );
      const trebleHandNote = createPromptStaveNote(
        trebleDisplayedStaff,
        [actualTrebleKey],
        displayedPrompt.duration,
        displayedKeySignature,
        undefined,
        getStemDirectionForPromptSource("treble", trebleDisplayedStaff),
        displayedPrompt.accidentalOverrides,
      );
      const bassHandNote = createPromptStaveNote(
        bassDisplayedStaff,
        [actualBassKey],
        displayedPrompt.duration,
        displayedKeySignature,
        undefined,
        getStemDirectionForPromptSource("bass", bassDisplayedStaff),
        displayedPrompt.accidentalOverrides,
      );

      if (
        trebleDisplayedStaff === "treble" &&
        bassDisplayedStaff === "treble"
      ) {
        trebleNote = trebleHandNote;
        trebleSecondaryNote = bassHandNote;
        bassNote = createRest("bass", displayedPrompt.duration);
      } else if (
        trebleDisplayedStaff === "bass" &&
        bassDisplayedStaff === "bass"
      ) {
        trebleNote = createRest("treble", displayedPrompt.duration);
        bassNote = bassHandNote;
        bassSecondaryNote = trebleHandNote;
      } else {
        trebleNote =
          trebleDisplayedStaff === "treble" ? trebleHandNote : bassHandNote;
        bassNote =
          trebleDisplayedStaff === "bass" ? trebleHandNote : bassHandNote;
      }
    } else {
      const treblePromptSourceHand =
        appState.generationSettings.practiceMode === "arpeggios" &&
        appState.generationSettings.scaleHands === "bass"
          ? "bass"
          : "treble";
      trebleNote = displayedPrompt.trebleKeys
        ? createPromptStaveNote(
            displayedPrompt.trebleDisplayedClef ?? "treble",
            displayedPrompt.trebleKeys,
            displayedPrompt.duration,
            displayedKeySignature,
            undefined,
            getStemDirectionForPromptSource(
              treblePromptSourceHand,
              displayedPrompt.trebleDisplayedClef ?? "treble",
            ),
            displayedPrompt.accidentalOverrides,
          )
        : createRest(
            displayedPrompt.trebleDisplayedClef ?? "treble",
            displayedPrompt.duration,
            displayedPrompt.trebleRestVisible,
          );
      bassNote = displayedPrompt.bassKeys
        ? createPromptStaveNote(
            displayedPrompt.bassDisplayedClef ?? "bass",
            displayedPrompt.bassKeys,
            displayedPrompt.duration,
            displayedKeySignature,
            getStaffClefChangeBefore(displayedPrompts, index, "bass"),
            getStemDirectionForPromptSource(
              "bass",
              displayedPrompt.bassDisplayedClef ?? "bass",
              (displayedPrompt.bassDisplayedClef ?? "bass") !== "bass",
            ),
            displayedPrompt.accidentalOverrides,
          )
        : createRest(
            displayedPrompt.bassDisplayedClef ?? "bass",
            displayedPrompt.duration,
            displayedPrompt.bassRestVisible,
          );
    }

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

      if (trebleSecondaryNote) {
        trebleSecondaryNote.setStyle({
          fillStyle: "#a6401f",
          strokeStyle: "#a6401f",
        });
        currentSecondaryPromptNotes.push(trebleSecondaryNote);
      }

      if (bassSecondaryNote) {
        bassSecondaryNote.setStyle({
          fillStyle: "#a6401f",
          strokeStyle: "#a6401f",
        });
        currentSecondaryPromptNotes.push(bassSecondaryNote);
      }

      for (const heldNoteNumber of getDisplayedHeldNotes(appState)) {
        const heldOverlayPresentation = getHeldOverlayPresentation(
          appState,
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

    if (trebleSecondaryNote) {
      secondaryPromptDrawInstructions.push({
        note: trebleSecondaryNote,
        anchorStaff: "treble",
        index,
      });
    }

    if (bassSecondaryNote) {
      secondaryPromptDrawInstructions.push({
        note: bassSecondaryNote,
        anchorStaff: "bass",
        index,
      });
    }

    for (const annotation of prompt.annotations ?? []) {
      promptAnnotationDrawInstructions.push({
        text: annotation.text,
        placement: annotation.placement,
        anchorStaff: annotation.staff,
        index,
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

  if (exerciseNotationProfile) {
    drawMeasureBarlines(
      appState.promptQueue,
      trebleNotes,
      trebleStave,
      bassStave,
      context,
      appState.currentMeasureOffsetBeats,
      exerciseNotationProfile.beatsPerMeasure,
    );
  }

  const promptAnnotationYPositions = getPromptAnnotationYPositions(
    promptAnnotationDrawInstructions,
    trebleNotes,
    bassNotes,
    trebleStave,
    bassStave,
    height,
  );

  for (const instruction of promptAnnotationDrawInstructions) {
    const anchorTickable =
      instruction.anchorStaff === "treble"
        ? trebleNotes[instruction.index]
        : bassNotes[instruction.index];

    if (!anchorTickable) {
      continue;
    }

    drawPromptAnnotation(
      instruction.text,
      anchorTickable,
      instruction.anchorStaff === "treble" ? trebleStave : bassStave,
      instruction.placement,
      promptAnnotationYPositions.get(
        `${instruction.anchorStaff}:${instruction.placement}`,
      ),
      context,
    );
  }

  for (const instruction of secondaryPromptDrawInstructions) {
    const anchorTickable =
      instruction.anchorStaff === "treble"
        ? trebleNotes[instruction.index]
        : bassNotes[instruction.index];

    if (!anchorTickable) {
      continue;
    }

    drawHeldOverlayNote(
      instruction.note,
      anchorTickable,
      instruction.anchorStaff === "treble" ? trebleStave : bassStave,
      context,
    );
  }

  drawTrebleOttavaBracket(
    appState.promptQueue,
    trebleNotes,
    trebleStave,
    context,
    height,
  );
  drawBassOttavaBracket(
    appState.promptQueue,
    bassNotes,
    bassStave,
    context,
    height,
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

  applyWrongAttemptFeedback([
    currentTreblePromptNote,
    currentBassPromptNote,
    ...currentSecondaryPromptNotes,
  ]);

  const svgElement = container.querySelector<SVGSVGElement>("svg");

  if (svgElement) {
    svgElement.removeAttribute("width");
    svgElement.removeAttribute("height");
    svgElement.style.width = "";
    svgElement.style.height = "";
    svgElement.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");
  }
}

function getDisplayedPromptSlot(
  prompt: PromptSlot,
  appState: AppState,
): PromptSlot {
  if (appState.generationSettings.practiceMode === "arpeggios") {
    if (appState.generationSettings.scaleHands !== "together") {
      return {
        isPlayable: prompt.isPlayable,
        duration: prompt.duration,
        trebleKeys: prompt.trebleKeys,
        bassKeys: prompt.bassKeys,
        trebleRestVisible: prompt.trebleRestVisible,
        bassRestVisible: prompt.bassRestVisible,
        annotations: prompt.annotations,
        accidentalOverrides: prompt.accidentalOverrides,
      };
    }

    if (
      appState.generationSettings.scaleHands === "together" &&
      appState.generationSettings.scaleMotion === "contrary"
    ) {
      return {
        isPlayable: prompt.isPlayable,
        duration: prompt.duration,
        trebleKeys: prompt.trebleKeys,
        bassKeys: prompt.bassKeys,
        trebleRestVisible: prompt.trebleRestVisible,
        bassRestVisible: prompt.bassRestVisible,
        annotations: prompt.annotations,
        accidentalOverrides: prompt.accidentalOverrides,
      };
    }

    const displayedTrebleKeys = [
      ...(prompt.trebleKeys ?? []),
      ...(prompt.bassKeys ?? []).filter(
        (key) => getClefForKey(key) === "treble",
      ),
    ].sort(compareKeysByMidiNumber);
    const displayedBassKeys = (prompt.bassKeys ?? [])
      .filter((key) => getClefForKey(key) === "bass")
      .sort(compareKeysByMidiNumber);

    return {
      isPlayable: prompt.isPlayable,
      duration: prompt.duration,
      trebleKeys:
        displayedTrebleKeys.length > 0 ? displayedTrebleKeys : undefined,
      bassKeys: displayedBassKeys.length > 0 ? displayedBassKeys : undefined,
      trebleRestVisible: prompt.trebleRestVisible,
      bassRestVisible: prompt.bassRestVisible,
      annotations: prompt.annotations,
      accidentalOverrides: prompt.accidentalOverrides,
    };
  }

  if (appState.generationSettings.practiceMode === "scales") {
    if (
      appState.generationSettings.scaleHands === "together" &&
      appState.generationSettings.scaleMotion === "contrary"
    ) {
      return {
        isPlayable: prompt.isPlayable,
        duration: prompt.duration,
        trebleKeys: prompt.trebleKeys,
        bassKeys: prompt.bassKeys,
        trebleRestVisible: prompt.trebleRestVisible,
        bassRestVisible: prompt.bassRestVisible,
        accidentalOverrides: prompt.accidentalOverrides,
      };
    }

    const displayedTrebleKeys = [
      ...(prompt.trebleKeys ?? []).filter(
        (key) => getDisplayedScaleStaff(appState, "treble", key) === "treble",
      ),
      ...(prompt.bassKeys ?? []).filter(
        (key) => getDisplayedScaleStaff(appState, "bass", key) === "treble",
      ),
    ].sort(compareKeysByMidiNumber);
    const displayedBassKeys = [
      ...(prompt.trebleKeys ?? []).filter(
        (key) => getDisplayedScaleStaff(appState, "treble", key) === "bass",
      ),
      ...(prompt.bassKeys ?? []).filter(
        (key) => getDisplayedScaleStaff(appState, "bass", key) === "bass",
      ),
    ].sort(compareKeysByMidiNumber);

    return {
      isPlayable: prompt.isPlayable,
      duration: prompt.duration,
      trebleKeys:
        displayedTrebleKeys.length > 0 ? displayedTrebleKeys : undefined,
      bassKeys: displayedBassKeys.length > 0 ? displayedBassKeys : undefined,
      trebleRestVisible: prompt.trebleRestVisible,
      bassRestVisible: prompt.bassRestVisible,
      annotations: prompt.annotations,
      accidentalOverrides: prompt.accidentalOverrides,
    };
  }

  return {
    isPlayable: prompt.isPlayable,
    duration: prompt.duration,
    trebleKeys: prompt.displayedTrebleKeys ?? prompt.trebleKeys,
    bassKeys: prompt.displayedBassKeys ?? prompt.bassKeys,
    trebleRestVisible: prompt.trebleRestVisible,
    bassRestVisible: prompt.bassRestVisible,
    accidentalOverrides: prompt.accidentalOverrides,
    trebleOttavaActive: prompt.trebleOttavaActive,
    bassOttavaActive: prompt.bassOttavaActive,
    trebleDisplayedClef: prompt.trebleDisplayedClef,
    bassDisplayedClef: prompt.bassDisplayedClef,
    trebleOttavaStart: prompt.trebleOttavaStart,
    trebleOttavaEnd: prompt.trebleOttavaEnd,
    bassOttavaStart: prompt.bassOttavaStart,
    bassOttavaEnd: prompt.bassOttavaEnd,
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

  if (!currentKeys || currentKeys.length === 0) {
    return undefined;
  }

  const currentClef =
    hand === "treble"
      ? (currentPrompt.trebleDisplayedClef ?? "treble")
      : (currentPrompt.bassDisplayedClef ?? "bass");
  const previousClef =
    hand === "treble"
      ? (previousPrompt.trebleDisplayedClef ?? "treble")
      : (previousPrompt.bassDisplayedClef ?? "bass");

  if (
    hand === "bass" &&
    index === 0 &&
    currentClef === "treble" &&
    previousClef === "treble"
  ) {
    return "treble";
  }

  if (hand === "bass" && index === 0 && currentClef === "bass") {
    return undefined;
  }

  return currentClef !== previousClef ? currentClef : undefined;
}

function getDisplayedKeySignature(appState: AppState) {
  return getDerivedKeySignature(appState.generationSettings);
}

function getPromptMidiNotes(prompt: PromptSlot) {
  if (prompt.isPlayable === false) {
    return [];
  }

  return [
    ...new Set(
      [...(prompt.trebleKeys ?? []), ...(prompt.bassKeys ?? [])].map(
        keyToMidiNoteNumber,
      ),
    ),
  ];
}

function getHeldOverlayPresentation(
  appState: AppState,
  prompt: PromptSlot,
  displayedPrompt: PromptSlot,
  heldNoteNumber: number,
  displayedKeySignature: KeySignature | null,
) {
  const cachedPresentation =
    appState.heldOverlayPresentations.get(heldNoteNumber);

  if (cachedPresentation) {
    return cachedPresentation;
  }

  let presentation: HeldOverlayPresentation | null = null;

  if (appState.generationSettings.practiceMode === "scales") {
    const scaleExactMatch = getExactScaleOverlayPresentation(
      appState,
      prompt,
      heldNoteNumber,
    );

    if (scaleExactMatch) {
      presentation = scaleExactMatch;
    }
  }

  if (
    !presentation &&
    appState.generationSettings.practiceMode === "arpeggios"
  ) {
    const arpeggioExactMatch = getExactArpeggioOverlayPresentation(
      appState,
      prompt,
      heldNoteNumber,
    );

    if (arpeggioExactMatch) {
      presentation = arpeggioExactMatch;
    }
  }

  if (presentation) {
    appState.heldOverlayPresentations.set(heldNoteNumber, presentation);
    return presentation;
  }

  const exactTrebleDisplayKey = getMatchedDisplayedPromptKey(
    prompt.trebleKeys,
    prompt.displayedTrebleKeys,
    heldNoteNumber,
  );

  if (exactTrebleDisplayKey) {
    presentation = {
      hand: "treble" as const,
      key: exactTrebleDisplayKey,
      clef: displayedPrompt.trebleDisplayedClef ?? "treble",
    };
    appState.heldOverlayPresentations.set(heldNoteNumber, presentation);
    return presentation;
  }

  const exactBassDisplayKey = getMatchedDisplayedPromptKey(
    prompt.bassKeys,
    prompt.displayedBassKeys,
    heldNoteNumber,
  );

  const assignedHand = assignHeldOverlayHand(
    appState,
    prompt,
    displayedPrompt,
    heldNoteNumber,
    displayedKeySignature,
    exactTrebleDisplayKey,
    exactBassDisplayKey,
  );

  presentation = getPresentationForAssignedHand(
    appState,
    prompt,
    displayedPrompt,
    heldNoteNumber,
    displayedKeySignature,
    assignedHand,
    exactTrebleDisplayKey,
    exactBassDisplayKey,
  );
  appState.heldOverlayPresentations.set(heldNoteNumber, presentation);

  return presentation;
}

function assignHeldOverlayHand(
  appState: AppState,
  prompt: PromptSlot,
  displayedPrompt: PromptSlot,
  heldNoteNumber: number,
  displayedKeySignature: KeySignature | null,
  exactTrebleDisplayKey: string | null,
  exactBassDisplayKey: string | null,
) {
  let assignedHand: "treble" | "bass";

  if (exactTrebleDisplayKey) {
    assignedHand = "treble";
  } else if (exactBassDisplayKey) {
    assignedHand = "bass";
  } else if (appState.generationSettings.practiceMode === "scales") {
    const scaleDisplayCandidates = getScaleDisplayCandidates(
      appState,
      prompt,
      heldNoteNumber,
      displayedKeySignature,
    );

    if (scaleDisplayCandidates.length > 0) {
      assignedHand = scaleDisplayCandidates.reduce(
        (bestCandidate, candidate) =>
          candidate.score < bestCandidate.score ? candidate : bestCandidate,
      ).hand;
    } else {
      const literalKey = getHeldOverlayKey(
        { duration: prompt.duration },
        heldNoteNumber,
        displayedKeySignature,
      );
      assignedHand = getClefForKey(literalKey);
    }
  } else if (appState.generationSettings.scaleHands === "together") {
    const specialContextCandidates = getSpecialNotationCandidates(
      prompt,
      displayedPrompt,
      heldNoteNumber,
      displayedKeySignature,
    );

    if (specialContextCandidates.length > 0) {
      assignedHand = specialContextCandidates.reduce(
        (bestCandidate, candidate) =>
          candidate.score < bestCandidate.score ? candidate : bestCandidate,
      ).hand;
    } else {
      const literalKey = getHeldOverlayKey(
        { duration: prompt.duration },
        heldNoteNumber,
        displayedKeySignature,
      );
      assignedHand = getClefForKey(literalKey);
    }
  } else {
    const specialNotationContext = getSpecialNotationContext(
      appState,
      prompt,
      displayedPrompt,
    );

    if (specialNotationContext === "treble-ottava") {
      assignedHand = "treble";
    } else if (specialNotationContext === "bass-ottava") {
      assignedHand = "bass";
    } else if (specialNotationContext === "bass-clef-shift") {
      assignedHand = "bass";
    } else {
      const literalKey = getHeldOverlayKey(
        { duration: prompt.duration },
        heldNoteNumber,
        displayedKeySignature,
      );
      assignedHand = getClefForKey(literalKey);
    }
  }

  return assignedHand;
}

function getPresentationForAssignedHand(
  appState: AppState,
  prompt: PromptSlot,
  displayedPrompt: PromptSlot,
  heldNoteNumber: number,
  displayedKeySignature: KeySignature | null,
  assignedHand: "treble" | "bass",
  exactTrebleDisplayKey: string | null,
  exactBassDisplayKey: string | null,
) {
  const literalKey = getHeldOverlayKey(
    { duration: prompt.duration },
    heldNoteNumber,
    displayedKeySignature,
  );

  if (assignedHand === "treble") {
    if (exactTrebleDisplayKey) {
      return {
        hand: "treble" as const,
        key: exactTrebleDisplayKey,
        clef: displayedPrompt.trebleDisplayedClef ?? "treble",
      };
    }

    if (isTrebleNotationTransformActive(appState, prompt)) {
      return {
        hand: "treble" as const,
        key: shiftKeyByOctaves(literalKey, -1),
        clef: displayedPrompt.trebleDisplayedClef ?? "treble",
      };
    }

    return {
      hand: "treble" as const,
      key: literalKey,
      clef: "treble" as const,
    };
  }

  if (exactBassDisplayKey) {
    return {
      hand: "bass" as const,
      key: exactBassDisplayKey,
      clef: displayedPrompt.bassDisplayedClef ?? "bass",
    };
  }

  if (isBassNotationTransformActive(appState, displayedPrompt)) {
    return {
      hand: "bass" as const,
      key: literalKey,
      clef: displayedPrompt.bassDisplayedClef ?? "bass",
    };
  }

  if (isBassOttavaTransformActive(appState, prompt)) {
    return {
      hand: "bass" as const,
      key: shiftKeyByOctaves(literalKey, 1),
      clef: displayedPrompt.bassDisplayedClef ?? "bass",
    };
  }

  return {
    hand: "bass" as const,
    key: literalKey,
    clef: "bass" as const,
  };
}

function getExactArpeggioOverlayPresentation(
  appState: AppState,
  prompt: PromptSlot,
  heldNoteNumber: number,
) {
  const exactTrebleKey = getMatchedDisplayedPromptKey(
    prompt.trebleKeys,
    prompt.displayedTrebleKeys,
    heldNoteNumber,
  );

  if (exactTrebleKey) {
    const displayedStaff =
      appState.generationSettings.scaleHands === "together"
        ? getTogetherScaleDisplayedStaff(appState, "treble", exactTrebleKey)
        : "treble";

    return {
      hand: displayedStaff,
      key: exactTrebleKey,
      clef: displayedStaff,
    };
  }

  const exactBassKey = getMatchedDisplayedPromptKey(
    prompt.bassKeys,
    prompt.displayedBassKeys,
    heldNoteNumber,
  );

  if (!exactBassKey) {
    return null;
  }

  const displayedStaff =
    appState.generationSettings.scaleHands === "bass"
      ? "bass"
      : appState.generationSettings.scaleHands === "together"
        ? getTogetherScaleDisplayedStaff(appState, "bass", exactBassKey)
        : getClefForKey(exactBassKey);

  return {
    hand: displayedStaff,
    key: exactBassKey,
    clef: displayedStaff,
  };
}

function getExactScaleOverlayPresentation(
  appState: AppState,
  prompt: PromptSlot,
  heldNoteNumber: number,
) {
  const exactTrebleKey = getMatchedDisplayedPromptKey(
    prompt.trebleKeys,
    prompt.displayedTrebleKeys,
    heldNoteNumber,
  );

  if (exactTrebleKey) {
    const displayedStaff = getDisplayedScaleStaff(
      appState,
      "treble",
      exactTrebleKey,
    );

    return {
      hand: displayedStaff,
      key: exactTrebleKey,
      clef: displayedStaff,
    };
  }

  const exactBassKey = getMatchedDisplayedPromptKey(
    prompt.bassKeys,
    prompt.displayedBassKeys,
    heldNoteNumber,
  );

  if (!exactBassKey) {
    return null;
  }

  const displayedStaff = getDisplayedScaleStaff(appState, "bass", exactBassKey);

  return {
    hand: displayedStaff,
    key: exactBassKey,
    clef: displayedStaff,
  };
}

function getScaleDisplayCandidates(
  appState: AppState,
  prompt: PromptSlot,
  heldNoteNumber: number,
  displayedKeySignature: KeySignature | null,
) {
  const literalKey = getHeldOverlayKey(
    { duration: prompt.duration },
    heldNoteNumber,
    displayedKeySignature,
  );
  const candidates: Array<{
    hand: "treble" | "bass";
    score: number;
  }> = [];

  if ((prompt.trebleKeys?.length ?? 0) > 0) {
    candidates.push({
      hand: getDisplayedScaleStaff(appState, "treble", literalKey),
      score: getClosestPromptDistance(prompt.trebleKeys, heldNoteNumber),
    });
  }

  if ((prompt.bassKeys?.length ?? 0) > 0) {
    candidates.push({
      hand: getDisplayedScaleStaff(appState, "bass", literalKey),
      score: getClosestPromptDistance(prompt.bassKeys, heldNoteNumber),
    });
  }

  return candidates;
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

  return (
    displayedKeys?.[matchingKeyIndex] ?? actualKeys[matchingKeyIndex] ?? null
  );
}

function getSpecialNotationContext(
  appState: AppState,
  prompt: PromptSlot,
  displayedPrompt: PromptSlot,
) {
  if (isTrebleNotationTransformActive(appState, prompt)) {
    return "treble-ottava" as const;
  }

  if (isBassOttavaTransformActive(appState, prompt)) {
    return "bass-ottava" as const;
  }

  if (isBassNotationTransformActive(appState, displayedPrompt)) {
    return "bass-clef-shift" as const;
  }

  return null;
}

function isTrebleNotationTransformActive(
  appState: AppState,
  prompt: PromptSlot,
) {
  return (
    Boolean(prompt.trebleOttavaActive) &&
    (appState.generationSettings.scaleHands === "treble" ||
      appState.generationSettings.scaleHands === "together")
  );
}

function isBassNotationTransformActive(
  appState: AppState,
  displayedPrompt: PromptSlot,
) {
  return (
    (displayedPrompt.bassDisplayedClef ?? "bass") !== "bass" &&
    (appState.generationSettings.scaleHands === "bass" ||
      appState.generationSettings.scaleHands === "together")
  );
}

function isBassOttavaTransformActive(appState: AppState, prompt: PromptSlot) {
  return (
    Boolean(prompt.bassOttavaActive) &&
    (appState.generationSettings.scaleHands === "bass" ||
      appState.generationSettings.scaleHands === "together")
  );
}

function getSpecialNotationCandidates(
  prompt: PromptSlot,
  displayedPrompt: PromptSlot,
  heldNoteNumber: number,
  displayedKeySignature: KeySignature | null,
) {
  const literalKey = getHeldOverlayKey(
    { duration: prompt.duration },
    heldNoteNumber,
    displayedKeySignature,
  );
  const candidates: Array<{
    hand: "treble" | "bass";
    key: string;
    clef: "treble" | "bass";
    score: number;
  }> = [];

  if ((prompt.trebleKeys?.length ?? 0) > 0 && prompt.trebleOttavaActive) {
    candidates.push({
      hand: "treble",
      key: shiftKeyByOctaves(literalKey, -1),
      clef: displayedPrompt.trebleDisplayedClef ?? "treble",
      score: getClosestPromptDistance(prompt.trebleKeys, heldNoteNumber),
    });
  }

  if ((prompt.bassKeys?.length ?? 0) > 0 && prompt.bassOttavaActive) {
    candidates.push({
      hand: "bass",
      key: shiftKeyByOctaves(literalKey, 1),
      clef: displayedPrompt.bassDisplayedClef ?? "bass",
      score: getClosestPromptDistance(prompt.bassKeys, heldNoteNumber),
    });
  }

  if (
    (prompt.bassKeys?.length ?? 0) > 0 &&
    (displayedPrompt.bassDisplayedClef ?? "bass") !== "bass"
  ) {
    candidates.push({
      hand: "bass",
      key: literalKey,
      clef: displayedPrompt.bassDisplayedClef ?? "bass",
      score: getClosestPromptDistance(prompt.bassKeys, heldNoteNumber),
    });
  }

  return candidates;
}

function getClosestPromptDistance(
  keys: string[] | undefined,
  heldNoteNumber: number,
) {
  if (!keys || keys.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.min(
    ...keys.map((key) => Math.abs(keyToMidiNoteNumber(key) - heldNoteNumber)),
  );
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

function drawPromptAnnotation(
  text: string,
  anchorNote: StaveNote,
  stave: Stave,
  placement: "above" | "below",
  fixedY: number | undefined,
  context: ReturnType<Renderer["getContext"]>,
) {
  const anchorX = anchorNote.getAbsoluteX() + anchorNote.getGlyphWidth() / 2;
  const noteYs = anchorNote.getYs();
  const stemExtents = anchorNote.getStemExtents();
  const topNoteY = Math.min(...noteYs, stemExtents.topY);
  const bottomNoteY = Math.max(...noteYs, stemExtents.baseY);
  const textY =
    fixedY ??
    (placement === "above"
      ? Math.max(stave.getYForTopText(1.5), topNoteY - 12)
      : Math.min(stave.getYForBottomText(1.5), bottomNoteY + 16));

  context.save();
  context.setFont(undefined, 13, "normal", "normal").setFillStyle("#000");
  const textWidth = context.measureText(text).width;
  context.fillText(text, anchorX - textWidth / 2, textY);
  context.restore();
}

function getPromptAnnotationYPositions(
  promptAnnotationDrawInstructions: Array<{
    text: string;
    placement: "above" | "below";
    anchorStaff: "treble" | "bass";
    index: number;
  }>,
  trebleNotes: StaveNote[],
  bassNotes: StaveNote[],
  trebleStave: Stave,
  bassStave: Stave,
  rendererHeight: number,
) {
  const yPositions = new Map<string, number>();
  const laneKeys = new Set(
    promptAnnotationDrawInstructions.map(
      (instruction) => `${instruction.anchorStaff}:${instruction.placement}`,
    ),
  );

  for (const laneKey of laneKeys) {
    const [staff, placement] = laneKey.split(":") as [
      "treble" | "bass",
      "above" | "below",
    ];
    const laneInstructions = promptAnnotationDrawInstructions.filter(
      (instruction) =>
        instruction.anchorStaff === staff &&
        instruction.placement === placement,
    );
    const anchorNotes = laneInstructions
      .map((instruction) =>
        staff === "treble"
          ? trebleNotes[instruction.index]
          : bassNotes[instruction.index],
      )
      .filter((note): note is StaveNote => Boolean(note));

    if (anchorNotes.length === 0) {
      continue;
    }

    const stave = staff === "treble" ? trebleStave : bassStave;

    if (placement === "above") {
      const safeTopTextLine = getSafeTopTextLineForNotes(
        anchorNotes[0],
        anchorNotes,
      );
      yPositions.set(
        laneKey,
        Math.min(
          stave.getYForTopText(STAFF_ANNOTATION_MAX_ABOVE_TOP_TEXT_LINE),
          stave.getYForTopText(safeTopTextLine),
        ),
      );
      continue;
    }

    const safeBottomTextLine = getSafeBottomTextLineForNotes(
      anchorNotes[0],
      anchorNotes,
      rendererHeight,
    );
    yPositions.set(laneKey, stave.getYForBottomText(safeBottomTextLine));
  }

  return yPositions;
}

function drawMeasureBarlines(
  promptQueue: PromptSlot[],
  anchorNotes: StaveNote[],
  trebleStave: Stave,
  bassStave: Stave,
  context: ReturnType<Renderer["getContext"]>,
  startingMeasureOffsetBeats: number,
  beatsPerMeasure: number,
) {
  if (beatsPerMeasure <= 0) {
    return;
  }

  let beatsInCurrentMeasure = startingMeasureOffsetBeats;

  for (const [index, prompt] of promptQueue.entries()) {
    beatsInCurrentMeasure += getDurationBeats(prompt.duration);

    if (
      beatsInCurrentMeasure < beatsPerMeasure ||
      index >= promptQueue.length - 1
    ) {
      continue;
    }

    const currentAnchorNote = anchorNotes[index];
    const nextAnchorNote = anchorNotes[index + 1];

    if (!currentAnchorNote || !nextAnchorNote) {
      break;
    }

    const barlineX = getMeasureBarlineX(currentAnchorNote, nextAnchorNote);

    if (!Number.isFinite(barlineX)) {
      continue;
    }

    drawGrandStaffBarline(barlineX, trebleStave, bassStave, context);
    beatsInCurrentMeasure %= beatsPerMeasure;
  }
}

function getDurationBeats(duration: string) {
  const normalizedDuration = duration.replace("r", "");
  const beatsByDuration: Record<string, number> = {
    w: 4,
    h: 2,
    q: 1,
    "8": 0.5,
    "16": 0.25,
    "32": 0.125,
  };

  return beatsByDuration[normalizedDuration] ?? 1;
}

function getMeasureBarlineX(currentNote: StaveNote, nextNote: StaveNote) {
  const currentX = currentNote.getAbsoluteX();
  const nextX = nextNote.getAbsoluteX();

  return currentX + (nextX - currentX) / 2;
}

function drawGrandStaffBarline(
  x: number,
  trebleStave: Stave,
  bassStave: Stave,
  context: ReturnType<Renderer["getContext"]>,
) {
  const topY = trebleStave.getYForLine(0);
  const bottomY = bassStave.getYForLine(bassStave.getNumLines() - 1);

  context.save();
  context.setStrokeStyle("#000").setLineWidth(1);
  context.beginPath();
  context.moveTo(x, topY);
  context.lineTo(x, bottomY);
  context.stroke();
  context.restore();
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
  trebleStave: Stave,
  context: ReturnType<Renderer["getContext"]>,
  rendererHeight: number,
) {
  drawOttavaBracket(
    promptQueue,
    trebleNotes,
    trebleStave,
    context,
    rendererHeight,
    {
      placement: "above",
      label: "8va",
      isActive: (prompt) => Boolean(prompt.trebleOttavaActive),
      isEnd: (prompt) => Boolean(prompt.trebleOttavaEnd),
    },
  );
}

function drawBassOttavaBracket(
  promptQueue: PromptSlot[],
  bassNotes: StaveNote[],
  bassStave: Stave,
  context: ReturnType<Renderer["getContext"]>,
  rendererHeight: number,
) {
  drawOttavaBracket(
    promptQueue,
    bassNotes,
    bassStave,
    context,
    rendererHeight,
    {
      placement: "below",
      label: "8vb",
      isActive: (prompt) => Boolean(prompt.bassOttavaActive),
      isEnd: (prompt) => Boolean(prompt.bassOttavaEnd),
    },
  );
}

function drawOttavaBracket(
  promptQueue: PromptSlot[],
  staffNotes: StaveNote[],
  stave: Stave,
  context: ReturnType<Renderer["getContext"]>,
  rendererHeight: number,
  {
    placement,
    label,
    isActive,
    isEnd,
  }: {
    placement: "above" | "below";
    label: string;
    isActive: (prompt: PromptSlot) => boolean;
    isEnd: (prompt: PromptSlot) => boolean;
  },
) {
  const ottavaSpans = getOttavaBracketDisplaySpans(promptQueue, isActive);

  if (ottavaSpans.length === 0) {
    return;
  }

  for (const ottavaSpan of ottavaSpans) {
    drawOttavaBracketSpan(
      promptQueue,
      staffNotes,
      stave,
      context,
      rendererHeight,
      ottavaSpan,
      {
        placement,
        label,
        isEnd,
      },
    );
  }
}

function getOttavaBracketDisplaySpans(
  promptQueue: PromptSlot[],
  isActive: (prompt: PromptSlot) => boolean,
) {
  const activeIndices = promptQueue
    .map((prompt, index) => (isActive(prompt) ? index : -1))
    .filter((index) => index !== -1);

  if (activeIndices.length === 0) {
    return [];
  }

  const spans: Array<{ startIndex: number; endIndex: number }> = [];
  let spanStartIndex = activeIndices[0];
  let previousIndex = activeIndices[0];

  for (const activeIndex of activeIndices.slice(1)) {
    if (activeIndex === previousIndex + 1) {
      previousIndex = activeIndex;
      continue;
    }

    spans.push({
      startIndex: spanStartIndex,
      endIndex: previousIndex,
    });
    spanStartIndex = activeIndex;
    previousIndex = activeIndex;
  }

  spans.push({
    startIndex: spanStartIndex,
    endIndex: previousIndex,
  });

  const firstSpan = spans[0];
  const lastSpan = spans.at(-1);
  const finalPromptIndex = promptQueue.length - 1;

  if (
    firstSpan &&
    lastSpan &&
    firstSpan.startIndex === 0 &&
    lastSpan.endIndex === finalPromptIndex
  ) {
    return [
      {
        startIndex: lastSpan.startIndex,
        endIndex: firstSpan.endIndex,
      },
      ...spans.slice(1, -1),
    ];
  }

  return spans;
}

function drawOttavaBracketSpan(
  promptQueue: PromptSlot[],
  staffNotes: StaveNote[],
  stave: Stave,
  context: ReturnType<Renderer["getContext"]>,
  rendererHeight: number,
  ottavaSpan: {
    startIndex: number;
    endIndex: number;
  },
  {
    placement,
    label,
    isEnd,
  }: {
    placement: "above" | "below";
    label: string;
    isEnd: (prompt: PromptSlot) => boolean;
  },
) {
  const { startIndex: ottavaStartIndex, endIndex: ottavaEndIndex } = ottavaSpan;
  const wrappedSpanNotes =
    ottavaStartIndex <= ottavaEndIndex
      ? staffNotes.slice(ottavaStartIndex, ottavaEndIndex + 1)
      : [
          ...staffNotes.slice(ottavaStartIndex),
          ...staffNotes.slice(0, ottavaEndIndex + 1),
        ];
  const referenceNote = staffNotes[ottavaStartIndex];

  if (!referenceNote || wrappedSpanNotes.length === 0) {
    return;
  }

  const textLine =
    placement === "above"
      ? getSafeTopTextLineForNotes(referenceNote, wrappedSpanNotes)
      : getSafeBottomTextLineForNotes(
          referenceNote,
          wrappedSpanNotes,
          rendererHeight,
        );

  if (ottavaStartIndex <= ottavaEndIndex) {
    drawOttavaBracketSegment(
      staffNotes[ottavaStartIndex],
      staffNotes[ottavaEndIndex],
      stave,
      context,
      {
        labelAnchorX: staffNotes[ottavaStartIndex]?.getAbsoluteX() ?? 0,
        lineEndX:
          (staffNotes[ottavaEndIndex]?.getAbsoluteX() ?? 0) +
          (staffNotes[ottavaEndIndex]?.getGlyphWidth() ?? 0),
        showLabel: true,
        showEndCap: true,
        textLine,
        placement,
        label,
      },
    );
    return;
  }

  const currentSegmentStartNote = staffNotes[0];
  const currentSegmentEndNote = staffNotes[ottavaEndIndex];
  const futureSegmentStartNote = staffNotes[ottavaStartIndex];
  const futureSegmentEndNote = staffNotes.at(-1);

  if (
    !currentSegmentStartNote ||
    !currentSegmentEndNote ||
    !futureSegmentStartNote ||
    !futureSegmentEndNote
  ) {
    return;
  }

  drawOttavaBracketSegment(
    currentSegmentStartNote,
    currentSegmentEndNote,
    stave,
    context,
    {
      labelAnchorX: stave.getNoteStartX(),
      lineEndX:
        currentSegmentEndNote.getAbsoluteX() +
        currentSegmentEndNote.getGlyphWidth(),
      showLabel: true,
      showEndCap: hasOttavaEndMarkerInRange(
        promptQueue,
        0,
        ottavaEndIndex,
        isEnd,
      ),
      textLine,
      placement,
      label,
    },
  );
  drawOttavaBracketSegment(
    futureSegmentStartNote,
    futureSegmentEndNote,
    stave,
    context,
    {
      labelAnchorX: futureSegmentStartNote.getAbsoluteX(),
      lineEndX: Math.min(
        stave.getNoteEndX(),
        futureSegmentEndNote.getAbsoluteX() +
          futureSegmentEndNote.getGlyphWidth(),
      ),
      showLabel: true,
      showEndCap: hasOttavaEndMarkerInRange(
        promptQueue,
        ottavaStartIndex,
        promptQueue.length - 1,
        isEnd,
      ),
      textLine,
      placement,
      label,
    },
  );
}

function hasOttavaEndMarkerInRange(
  promptQueue: PromptSlot[],
  startIndex: number,
  endIndex: number,
  isEnd: (prompt: PromptSlot) => boolean,
) {
  for (let index = startIndex; index <= endIndex; index += 1) {
    const prompt = promptQueue[index];

    if (prompt && isEnd(prompt)) {
      return true;
    }
  }

  return false;
}

function drawOttavaBracketSegment(
  ottavaStartNote: StaveNote | undefined,
  ottavaEndNote: StaveNote | undefined,
  stave: Stave,
  context: ReturnType<Renderer["getContext"]>,
  {
    labelAnchorX,
    lineEndX,
    showLabel,
    showEndCap,
    textLine,
    placement,
    label,
  }: {
    labelAnchorX: number;
    lineEndX: number;
    showLabel: boolean;
    showEndCap: boolean;
    textLine: number;
    placement: "above" | "below";
    label: string;
  },
) {
  if (!ottavaStartNote || !ottavaEndNote) {
    return;
  }

  const startY =
    placement === "above"
      ? stave.getYForTopText(textLine)
      : stave.getYForBottomText(textLine);
  const mainFontSize = 15;
  const superscriptFontSize = mainFontSize * 0.714286;
  const bracketHeight = 8;

  context.save();
  context
    .setFont(undefined, mainFontSize, "normal", "italic")
    .setFillStyle("#000")
    .setStrokeStyle("#000")
    .setLineWidth(1);

  let lineStartX = labelAnchorX;
  let lineY = startY;

  if (showLabel) {
    const mainLabel = label.charAt(0);
    const superLabel = label.slice(1);

    // New
    const labelYOffset = placement === "below" ? 7 : 0;

    context.fillText(mainLabel, labelAnchorX, startY + labelYOffset);
    const mainWidth = context.measureText(mainLabel).width;
    const mainHeight = mainFontSize;
    const superY = startY + labelYOffset - mainHeight / 2.5;

    context.setFont(undefined, superscriptFontSize, "normal", "italic");
    context.fillText(superLabel, labelAnchorX + mainWidth + 1, superY);
    const superWidth = context.measureText(superLabel).width;
    const superHeight = superscriptFontSize;

    lineStartX = labelAnchorX + mainWidth + superWidth + 5;
    lineY =
      placement === "above"
        ? superY - superHeight / 2.7
        : startY + mainHeight / 6;
  }

  const resolvedLineEndX = Math.max(lineStartX, lineEndX);
  const endCapY =
    placement === "above" ? lineY + bracketHeight : lineY - bracketHeight;

  context.beginPath();
  context.moveTo(lineStartX, lineY);
  context.lineTo(resolvedLineEndX, lineY);

  if (showEndCap) {
    context.lineTo(resolvedLineEndX, endCapY);
  }

  context.stroke();
  context.restore();
}

function getSafeTopTextLineForNotes(
  referenceNote: StaveNote,
  notes: StaveNote[],
) {
  const stave = referenceNote.checkStave();
  const noteTopPadding = 8;
  const minimumVisibleY = OTTAVA_VIEWPORT_PADDING;
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

function getSafeBottomTextLineForNotes(
  referenceNote: StaveNote,
  notes: StaveNote[],
  rendererHeight: number,
) {
  const stave = referenceNote.checkStave();
  const noteBottomPadding = 12;
  const maximumVisibleY = rendererHeight - OTTAVA_VIEWPORT_PADDING;
  const bottomMostOccupiedY = Math.max(
    ...notes.map((note) => {
      const stemExtents = note.getStemExtents();
      const stemBottomY =
        note.getStemDirection() === -1 ? stemExtents.topY : stemExtents.baseY;
      const noteHeadBottomY = Math.max(...note.getYs());

      return Math.max(stemBottomY, noteHeadBottomY);
    }),
  );
  const targetBottomTextY = bottomMostOccupiedY + noteBottomPadding;
  let line = 1;

  while (
    line < 12 &&
    stave.getYForBottomText(line + 0.5) < targetBottomTextY &&
    stave.getYForBottomText(line + 0.5) <= maximumVisibleY
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
  return createExercisePromptQueue(length, generationSettings);
}

function clampOctaveOffset(offset: number) {
  return Math.min(MAX_OCTAVE_OFFSET, Math.max(MIN_OCTAVE_OFFSET, offset));
}

function clampMidiNoteNumber(noteNumber: number) {
  return Math.min(
    MIDI_NOTE_NUMBER_MAX,
    Math.max(MIDI_NOTE_NUMBER_MIN, noteNumber),
  );
}

function getOctaveOffsetSemitones(octaveOffset = state.octaveOffset) {
  return octaveOffset * 12;
}

function applyMidiInputOffset(
  noteNumber: number,
  octaveOffset = state.octaveOffset,
) {
  return clampMidiNoteNumber(
    noteNumber + getOctaveOffsetSemitones(octaveOffset),
  );
}

function applyMidiInputOffsetToNotes(
  noteNumbers: number[],
  octaveOffset = state.octaveOffset,
) {
  return noteNumbers.map((noteNumber) =>
    applyMidiInputOffset(noteNumber, octaveOffset),
  );
}

function removeMidiInputOffset(
  noteNumber: number,
  octaveOffset = state.octaveOffset,
) {
  return clampMidiNoteNumber(
    noteNumber - getOctaveOffsetSemitones(octaveOffset),
  );
}

function fillQueueToLength(
  promptQueue: PromptSlot[],
  length: number,
  generationSettings: GenerationSettings,
) {
  fillExercisePromptQueue(promptQueue, length, generationSettings);
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

function createDefaultStoredSettings() {
  const generationSettings = {
    ...initialGenerationSettings,
  };
  generationSettings.renderingPreference = "preferred";
  generationSettings.tonic = getPracticalTonic(generationSettings.tonic);

  return {
    generationSettings,
    attemptWindowMs: DEFAULT_ATTEMPT_WINDOW_MS,
    isDebugVisible: false,
    isExerciseVisible: true,
    octaveOffset: DEFAULT_OCTAVE_OFFSET,
    isInputNameVisible: true,
    isKeyboardVisible: true,
    hasSeenLandscapeSettingsCoachmark: false,
  };
}

function isStoredSettingsSnapshotValid(
  storedSettings: unknown,
): storedSettings is StoredSettingsSnapshot {
  if (!storedSettings || typeof storedSettings !== "object") {
    return false;
  }

  const parsedSettings = storedSettings as Partial<StoredSettingsSnapshot>;
  const generationSettings = parsedSettings.generationSettings;

  if (parsedSettings.version !== SETTINGS_SCHEMA_VERSION) {
    return false;
  }

  if (!generationSettings || typeof generationSettings !== "object") {
    return false;
  }

  return (
    PRACTICE_MODES.includes(generationSettings.practiceMode as PracticeMode) &&
    SCALE_HANDS_OPTIONS.includes(generationSettings.scaleHands as ScaleHands) &&
    SCALE_MOTION_OPTIONS.includes(
      generationSettings.scaleMotion as ScaleMotion,
    ) &&
    SCALE_DIRECTION_OPTIONS.includes(
      generationSettings.scaleDirection as ScaleDirection,
    ) &&
    SCALE_OCTAVES_OPTIONS.includes(
      generationSettings.scaleOctaves as ScaleOctaves,
    ) &&
    getAllTonics().includes(generationSettings.tonic as Tonic) &&
    SCALE_TYPES.includes(generationSettings.scaleType as ScaleType) &&
    TRIAD_TYPES.includes(generationSettings.triadType as TriadType) &&
    typeof parsedSettings.attemptWindowMs === "number" &&
    typeof parsedSettings.isDebugVisible === "boolean" &&
    typeof parsedSettings.isExerciseVisible === "boolean" &&
    (typeof parsedSettings.octaveOffset === "number" ||
      typeof parsedSettings.octaveOffset === "undefined") &&
    typeof parsedSettings.isInputNameVisible === "boolean" &&
    typeof parsedSettings.isKeyboardVisible === "boolean" &&
    (typeof parsedSettings.hasSeenLandscapeSettingsCoachmark === "boolean" ||
      typeof parsedSettings.hasSeenLandscapeSettingsCoachmark === "undefined")
  );
}

function saveStoredSettingsSnapshot(settings: {
  generationSettings: GenerationSettings;
  attemptWindowMs: number;
  isDebugVisible: boolean;
  isExerciseVisible: boolean;
  octaveOffset: number;
  isInputNameVisible: boolean;
  isKeyboardVisible: boolean;
  hasSeenLandscapeSettingsCoachmark: boolean;
}) {
  const {
    renderingPreference: _renderingPreference,
    ...storedGenerationSettings
  } = settings.generationSettings;

  const snapshot: StoredSettingsSnapshot = {
    version: SETTINGS_SCHEMA_VERSION,
    generationSettings: storedGenerationSettings,
    attemptWindowMs: settings.attemptWindowMs,
    isDebugVisible: settings.isDebugVisible,
    isExerciseVisible: settings.isExerciseVisible,
    octaveOffset: settings.octaveOffset,
    isInputNameVisible: settings.isInputNameVisible,
    isKeyboardVisible: settings.isKeyboardVisible,
    hasSeenLandscapeSettingsCoachmark:
      settings.hasSeenLandscapeSettingsCoachmark,
  };

  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(snapshot));
}

function loadStoredSettings(): {
  generationSettings: GenerationSettings;
  attemptWindowMs: number;
  isDebugVisible: boolean;
  isExerciseVisible: boolean;
  octaveOffset: number;
  isInputNameVisible: boolean;
  isKeyboardVisible: boolean;
  hasSeenLandscapeSettingsCoachmark: boolean;
} {
  try {
    const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);

    if (!storedSettings) {
      const defaultSettings = createDefaultStoredSettings();
      saveStoredSettingsSnapshot(defaultSettings);
      return defaultSettings;
    }

    const parsedSettings = JSON.parse(storedSettings);

    if (!isStoredSettingsSnapshotValid(parsedSettings)) {
      const defaultSettings = createDefaultStoredSettings();
      saveStoredSettingsSnapshot(defaultSettings);
      return defaultSettings;
    }

    const storedGenerationSettings = parsedSettings?.generationSettings;
    const generationSettings = {
      ...initialGenerationSettings,
      ...storedGenerationSettings,
    };
    generationSettings.renderingPreference = "preferred";
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
      octaveOffset:
        typeof parsedSettings?.octaveOffset === "number"
          ? clampOctaveOffset(parsedSettings.octaveOffset)
          : DEFAULT_OCTAVE_OFFSET,
      isInputNameVisible:
        typeof parsedSettings?.isInputNameVisible === "boolean"
          ? parsedSettings.isInputNameVisible
          : true,
      isKeyboardVisible:
        typeof parsedSettings?.isKeyboardVisible === "boolean"
          ? parsedSettings.isKeyboardVisible
          : true,
      hasSeenLandscapeSettingsCoachmark:
        typeof parsedSettings?.hasSeenLandscapeSettingsCoachmark === "boolean"
          ? parsedSettings.hasSeenLandscapeSettingsCoachmark
          : false,
    };
  } catch {
    const defaultSettings = createDefaultStoredSettings();

    try {
      saveStoredSettingsSnapshot(defaultSettings);
    } catch {
      // Ignore storage issues and continue without persistence.
    }

    return defaultSettings;
  }
}

function saveStoredSettings() {
  try {
    saveStoredSettingsSnapshot({
      generationSettings: state.generationSettings,
      attemptWindowMs: state.attemptWindowMs,
      isDebugVisible: state.isDebugVisible,
      isExerciseVisible: state.isExerciseVisible,
      octaveOffset: state.octaveOffset,
      isInputNameVisible: state.inputNameDisplay.visibleInApp,
      isKeyboardVisible: state.keyboardDisplay.visibleInApp,
      hasSeenLandscapeSettingsCoachmark:
        state.hasSeenLandscapeSettingsCoachmark,
    });
  } catch {
    // Ignore storage issues and continue without persistence.
  }
}

function dismissSettingsCoachmark(shouldRender = true) {
  state.isSettingsCoachmarkOpen = false;

  if (!state.hasSeenLandscapeSettingsCoachmark) {
    state.hasSeenLandscapeSettingsCoachmark = true;
    saveStoredSettings();
  }

  if (shouldRender) {
    renderApp();
  }
}
