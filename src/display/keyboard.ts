type KeyboardDisplayOptions = {
  activeNotes: number[];
  heldNotes?: number[];
  startMidiNote?: number;
  endMidiNote?: number;
  showPopoutButton?: boolean;
  onPopout?: () => void;
  popoutButtonLabel?: string;
  popoutButtonTitle?: string;
  fitMode?: "width" | "contain";
};

const DEFAULT_START_MIDI_NOTE = 21;
const DEFAULT_END_MIDI_NOTE = 108;

export function renderKeyboardDisplay(
  container: HTMLDivElement,
  options: KeyboardDisplayOptions,
) {
  container.replaceChildren();
  container.classList.toggle("has-utility", Boolean(options.showPopoutButton));

  if (options.showPopoutButton && options.onPopout) {
    const popoutButton = document.createElement("button");
    popoutButton.type = "button";
    popoutButton.className = "panel-popout-button";
    popoutButton.textContent = options.popoutButtonLabel ?? "Pop out";
    popoutButton.title =
      options.popoutButtonTitle ?? "Open the keyboard display in a new window.";
    popoutButton.addEventListener("click", options.onPopout);
    container.append(popoutButton);
  }

  const keyboardFrameElement = document.createElement("div");
  keyboardFrameElement.className = "keyboard-frame";

  const keyboardElement = document.createElement("div");
  keyboardElement.className = "keyboard";

  const whiteKeyLayer = document.createElement("div");
  whiteKeyLayer.className = "keyboard-white-keys";

  const blackKeyLayer = document.createElement("div");
  blackKeyLayer.className = "keyboard-black-keys";

  const activeNotes = new Set(options.activeNotes);
  const heldNotes = new Set(options.heldNotes ?? []);
  const startMidiNote = options.startMidiNote ?? DEFAULT_START_MIDI_NOTE;
  const endMidiNote = options.endMidiNote ?? DEFAULT_END_MIDI_NOTE;
  let whiteKeyIndex = 0;

  for (
    let midiNoteNumber = startMidiNote;
    midiNoteNumber <= endMidiNote;
    midiNoteNumber += 1
  ) {
    if (isBlackKey(midiNoteNumber)) {
      const blackKeyElement = document.createElement("div");
      blackKeyElement.className = getKeyClassName(
        "keyboard-key keyboard-key-black",
        midiNoteNumber,
        activeNotes,
        heldNotes,
      );
      blackKeyElement.style.left = `calc(${whiteKeyIndex} * var(--keyboard-white-key-width) - var(--keyboard-black-key-width) / 2)`;
      blackKeyLayer.append(blackKeyElement);
      continue;
    }

    const whiteKeyElement = document.createElement("div");
    whiteKeyElement.className = getKeyClassName(
      "keyboard-key keyboard-key-white",
      midiNoteNumber,
      activeNotes,
      heldNotes,
    );

    if (isCNote(midiNoteNumber)) {
      const keyLabelElement = document.createElement("span");
      keyLabelElement.className = "keyboard-key-label";
      keyLabelElement.textContent = getOctaveLabel(midiNoteNumber);
      whiteKeyElement.append(keyLabelElement);
    }

    whiteKeyLayer.append(whiteKeyElement);
    whiteKeyIndex += 1;
  }

  keyboardElement.append(whiteKeyLayer, blackKeyLayer);
  keyboardFrameElement.append(keyboardElement);
  container.append(keyboardFrameElement);

  fitKeyboardToContainer(
    container,
    keyboardFrameElement,
    keyboardElement,
    options.fitMode ?? "width",
  );
}

function getKeyClassName(
  baseClassName: string,
  midiNoteNumber: number,
  activeNotes: Set<number>,
  heldNotes: Set<number>,
) {
  const classNames = [baseClassName];

  if (activeNotes.has(midiNoteNumber)) {
    classNames.push("is-active");
  }

  if (heldNotes.has(midiNoteNumber)) {
    classNames.push("is-held");
  }

  return classNames.join(" ");
}

function isBlackKey(midiNoteNumber: number) {
  return [1, 3, 6, 8, 10].includes(midiNoteNumber % 12);
}

function isCNote(midiNoteNumber: number) {
  return midiNoteNumber % 12 === 0;
}

function getOctaveLabel(midiNoteNumber: number) {
  const octave = Math.floor(midiNoteNumber / 12) - 1;

  return `C${octave}`;
}

function fitKeyboardToContainer(
  container: HTMLDivElement,
  keyboardFrameElement: HTMLDivElement,
  keyboardElement: HTMLDivElement,
  fitMode: "width" | "contain",
) {
  keyboardFrameElement.style.width = "";
  keyboardFrameElement.style.height = "";
  keyboardElement.style.transform = "";
  keyboardElement.style.transformOrigin = "";

  const computedStyle = getComputedStyle(container);
  const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(computedStyle.paddingRight) || 0;
  const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0;
  const availableWidth = Math.max(
    0,
    container.clientWidth - paddingLeft - paddingRight,
  );
  const availableHeight = Math.max(
    0,
    container.clientHeight - paddingTop - paddingBottom,
  );
  const naturalWidth = keyboardElement.offsetWidth;
  const naturalHeight = keyboardElement.offsetHeight;

  if (availableWidth === 0 || naturalWidth === 0 || naturalHeight === 0) {
    return;
  }

  const widthScale = availableWidth / naturalWidth;
  const heightScale =
    fitMode === "contain" && availableHeight > 0
      ? availableHeight / naturalHeight
      : 1;
  const fitScale =
    fitMode === "contain"
      ? Math.min(widthScale, heightScale)
      : Math.min(1, widthScale);

  if (fitScale <= 0 || (fitMode === "width" && fitScale >= 1)) {
    return;
  }

  keyboardFrameElement.style.width = `${naturalWidth * fitScale}px`;
  keyboardFrameElement.style.height = `${naturalHeight * fitScale}px`;
  keyboardElement.style.transform = `scale(${fitScale})`;
  keyboardElement.style.transformOrigin = "top left";
}
