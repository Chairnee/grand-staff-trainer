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
    cache.contentHost.replaceChildren(createStatusWrapper("No input to analyse"));
    return;
  }

  if (!analysis.primary) {
    container.classList.add("is-status");
    const statusWrapper = document.createElement("div");
    statusWrapper.className = "input-name-status-wrap";

    const notesValue = document.createElement("p");
    notesValue.className = "input-name-note-list";
    notesValue.textContent = analysis.noteLabel ?? "";

    statusWrapper.append(notesValue, createStatusElement("Unknown input"));
    cache.contentHost.replaceChildren(statusWrapper);
    return;
  }

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "input-name-content-wrap";

  const notesValue = document.createElement("p");
  notesValue.className = "input-name-note-list";
  notesValue.textContent = analysis.noteLabel ?? "";

  const readingRow = document.createElement("div");
  readingRow.className = "input-name-reading-row";
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

  const longhand = document.createElement("p");
  longhand.className = "input-name-longhand";
  longhand.textContent = selectedVariant.longhand;

  contentWrapper.append(readingRow, notesValue, longhand);
  cache.contentHost.replaceChildren(contentWrapper);
}

function getOrCreateInputNameDisplayCache(container: HTMLDivElement) {
  const cachedDisplay = inputNameDisplayCache.get(container);

  if (cachedDisplay) {
    return cachedDisplay;
  }

  container.replaceChildren();

  const contentHost = document.createElement("div");
  contentHost.className = "input-name-content-host";
  container.append(contentHost);

  const cache = {
    contentHost,
  };
  inputNameDisplayCache.set(container, cache);
  return cache;
}

function syncInputNameUtilityGroup(
  container: HTMLDivElement,
  options: RenderInputNameDisplayOptions,
) {
  container.querySelector(".panel-popout-buttons")?.remove();

  if (
    !(options.showPopoutButton && options.onPopout) &&
    !(options.showSecondaryPopoutButton && options.onSecondaryPopout)
  ) {
    return;
  }

  const utilityGroup = document.createElement("div");
  utilityGroup.className = "panel-popout-buttons";

  if (options.showPopoutButton && options.onPopout) {
    const popoutButton = document.createElement("button");
    popoutButton.type = "button";
    popoutButton.className = "panel-popout-button";
    popoutButton.textContent = options.popoutButtonLabel ?? "Pop out";
    popoutButton.title =
      options.popoutButtonTitle ?? "Open the input name display in a new window.";
    popoutButton.addEventListener("click", options.onPopout);
    utilityGroup.append(popoutButton);
  }

  if (options.showSecondaryPopoutButton && options.onSecondaryPopout) {
    const secondaryButton = document.createElement("button");
    secondaryButton.type = "button";
    secondaryButton.className =
      "panel-popout-button panel-popout-button-secondary";
    secondaryButton.textContent =
      options.secondaryPopoutButtonLabel ?? "w/ keyboard";
    secondaryButton.title =
      options.secondaryPopoutButtonTitle ??
      "Open the input name display with the keyboard in a new window.";
    secondaryButton.addEventListener("click", options.onSecondaryPopout);
    utilityGroup.append(secondaryButton);
  }

  container.prepend(utilityGroup);
}

function createStatusElement(text: string) {
  const status = document.createElement("p");
  status.className = "input-name-status";
  status.textContent = text;
  return status;
}

function createStatusWrapper(text: string) {
  const wrapper = document.createElement("div");
  wrapper.className = "input-name-status-wrap";
  wrapper.append(createStatusElement(text));
  return wrapper;
}
