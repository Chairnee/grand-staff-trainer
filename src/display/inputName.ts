import {
  getInputNameVariantKey,
  type InputAnalysis,
  type InputNameVariant,
} from "../analysis/inputAnalysis";

type RenderInputNameDisplayOptions = {
  showPopoutButton?: boolean;
  onPopout?: () => void;
  popoutButtonLabel?: string;
  popoutButtonTitle?: string;
  showSecondaryPopoutButton?: boolean;
  onSecondaryPopout?: () => void;
  secondaryPopoutButtonLabel?: string;
  secondaryPopoutButtonTitle?: string;
  selectedVariantKey?: string | null;
  onSelectVariant?: (variantKey: string) => void;
};

type InputNameDisplayCache = {
  contentHost: HTMLDivElement;
  utilityGroup: HTMLDivElement;
  popoutButton: HTMLButtonElement;
  secondaryButton: HTMLButtonElement;
  contentWrapper: HTMLDivElement;
  noteList: HTMLParagraphElement;
  readingRow: HTMLDivElement;
  longhand: HTMLParagraphElement;
  statusWrapper: HTMLDivElement;
  statusNoteList: HTMLParagraphElement;
  statusText: HTMLParagraphElement;
};

const inputNameDisplayCache = new WeakMap<
  HTMLDivElement,
  InputNameDisplayCache
>();

export function renderInputNameDisplay(
  container: HTMLDivElement,
  analysis: InputAnalysis,
  options: RenderInputNameDisplayOptions = {},
) {
  const cache = getOrCreateInputNameDisplayCache(container);

  container.classList.remove("is-status");
  container.classList.toggle(
    "has-utility",
    Boolean(
      (options.showPopoutButton && options.onPopout) ||
        (options.showSecondaryPopoutButton && options.onSecondaryPopout),
    ),
  );
  syncInputNameUtilityGroup(container, options);

  if (!analysis.noteLabel && !analysis.primary) {
    container.classList.add("is-status");
    cache.statusNoteList.textContent = "";
    cache.statusText.textContent = "No input to analyse";
    showInputNameStatus(cache);
    return;
  }

  if (!analysis.primary) {
    container.classList.add("is-status");
    cache.statusNoteList.textContent = analysis.noteLabel ?? "";
    cache.statusText.textContent = "Unknown input";
    showInputNameStatus(cache);
    return;
  }

  const readingRow = document.createElement("div");
  const variants: InputNameVariant[] = [analysis.primary, ...analysis.alternates];
  const selectedVariant =
    variants.find(
      (variant) =>
        getInputNameVariantKey(variant) === options.selectedVariantKey,
    ) ?? analysis.primary;

  variants.forEach((variant, index) => {
    const pill = document.createElement("button");
    const isSelected =
      getInputNameVariantKey(variant) === getInputNameVariantKey(selectedVariant);
    pill.className = `input-name-pill ${
      isSelected ? "input-name-pill-primary" : "input-name-pill-alternate"
    }`;
    pill.type = "button";
    pill.textContent = variant.shorthand;
    pill.setAttribute("aria-pressed", String(isSelected));

    if (options.onSelectVariant) {
      pill.addEventListener("click", () => {
        options.onSelectVariant?.(getInputNameVariantKey(variant));
      });
    }

    readingRow.append(pill);

    if (index === 0 && analysis.alternates.length > 0) {
      const separator = document.createElement("span");
      separator.className = "input-name-separator";
      separator.textContent = "|";
      readingRow.append(separator);
    }
  });

  if (selectedVariant.namingNote ?? analysis.namingNote) {
    const namingNoteBadge = document.createElement("span");
    namingNoteBadge.className = "input-name-naming-note-badge";
    namingNoteBadge.textContent = "voicing";
    namingNoteBadge.title = selectedVariant.namingNote ?? analysis.namingNote ?? "";
    readingRow.append(namingNoteBadge);
  }
  cache.readingRow.replaceChildren(...readingRow.childNodes);
  cache.noteList.textContent = analysis.noteLabel ?? "";
  cache.longhand.textContent = selectedVariant.longhand;
  showInputNameContent(cache);
}

function getOrCreateInputNameDisplayCache(container: HTMLDivElement) {
  const cachedDisplay = inputNameDisplayCache.get(container);

  if (
    cachedDisplay &&
    cachedDisplay.contentHost.isConnected &&
    cachedDisplay.contentHost.parentElement === container
  ) {
    return cachedDisplay;
  }

  container.replaceChildren();

  const utilityGroup = document.createElement("div");
  utilityGroup.className = "panel-popout-buttons";

  const popoutButton = document.createElement("button");
  popoutButton.type = "button";
  popoutButton.className = "panel-popout-button";

  const secondaryButton = document.createElement("button");
  secondaryButton.type = "button";
  secondaryButton.className =
    "panel-popout-button panel-popout-button-secondary";

  const contentHost = document.createElement("div");
  contentHost.className = "input-name-content-host";

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "input-name-content-wrap";

  const readingRow = document.createElement("div");
  readingRow.className = "input-name-reading-row";

  const noteList = document.createElement("p");
  noteList.className = "input-name-note-list";

  const longhand = document.createElement("p");
  longhand.className = "input-name-longhand";

  contentWrapper.append(readingRow, noteList, longhand);

  const statusWrapper = document.createElement("div");
  statusWrapper.className = "input-name-status-wrap";

  const statusNoteList = document.createElement("p");
  statusNoteList.className = "input-name-note-list";

  const statusText = createStatusElement("");

  statusWrapper.append(statusNoteList, statusText);
  contentHost.append(contentWrapper, statusWrapper);
  utilityGroup.append(popoutButton, secondaryButton);
  container.append(utilityGroup, contentHost);

  const cache = {
    contentHost,
    utilityGroup,
    popoutButton,
    secondaryButton,
    contentWrapper,
    noteList,
    readingRow,
    longhand,
    statusWrapper,
    statusNoteList,
    statusText,
  };
  inputNameDisplayCache.set(container, cache);
  return cache;
}

function syncInputNameUtilityGroup(
  container: HTMLDivElement,
  options: RenderInputNameDisplayOptions,
) {
  const cache = getOrCreateInputNameDisplayCache(container);
  const showPopoutButton = Boolean(options.showPopoutButton && options.onPopout);
  const showSecondaryButton = Boolean(
    options.showSecondaryPopoutButton && options.onSecondaryPopout,
  );
  const hasUtility = showPopoutButton || showSecondaryButton;

  cache.utilityGroup.hidden = !hasUtility;

  cache.popoutButton.hidden = !showPopoutButton;
  cache.popoutButton.textContent = options.popoutButtonLabel ?? "Pop out";
  cache.popoutButton.title =
    options.popoutButtonTitle ?? "Open the input name display in a new window.";
  cache.popoutButton.onclick = showPopoutButton
    ? () => {
        options.onPopout?.();
      }
    : null;

  cache.secondaryButton.hidden = !showSecondaryButton;
  cache.secondaryButton.textContent =
    options.secondaryPopoutButtonLabel ?? "w/ keyboard";
  cache.secondaryButton.title =
    options.secondaryPopoutButtonTitle ??
    "Open the input name display with the keyboard in a new window.";
  cache.secondaryButton.onclick = showSecondaryButton
    ? () => {
        options.onSecondaryPopout?.();
      }
    : null;
}

function showInputNameContent(cache: InputNameDisplayCache) {
  cache.contentWrapper.hidden = false;
  cache.statusWrapper.hidden = true;
}

function showInputNameStatus(cache: InputNameDisplayCache) {
  cache.contentWrapper.hidden = true;
  cache.statusWrapper.hidden = false;
}

function createStatusElement(text: string) {
  const status = document.createElement("p");
  status.className = "input-name-status";
  status.textContent = text;
  return status;
}
