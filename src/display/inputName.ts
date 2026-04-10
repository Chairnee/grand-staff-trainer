import type { InputAnalysis } from "../analysis/inputAnalysis";

type RenderInputNameDisplayOptions = {
  showPopoutButton?: boolean;
  onPopout?: () => void;
  popoutButtonLabel?: string;
  popoutButtonTitle?: string;
  showSecondaryPopoutButton?: boolean;
  onSecondaryPopout?: () => void;
  secondaryPopoutButtonLabel?: string;
  secondaryPopoutButtonTitle?: string;
};

export function renderInputNameDisplay(
  container: HTMLDivElement,
  analysis: InputAnalysis,
  options: RenderInputNameDisplayOptions = {},
) {
  container.replaceChildren();
  container.classList.remove("is-status");
  container.classList.toggle(
    "has-utility",
    Boolean(
      (options.showPopoutButton && options.onPopout) ||
        (options.showSecondaryPopoutButton && options.onSecondaryPopout),
    ),
  );

  if (
    (options.showPopoutButton && options.onPopout) ||
    (options.showSecondaryPopoutButton && options.onSecondaryPopout)
  ) {
    const utilityGroup = document.createElement("div");
    utilityGroup.className = "panel-popout-buttons";

    if (options.showPopoutButton && options.onPopout) {
      const popoutButton = document.createElement("button");
      popoutButton.type = "button";
      popoutButton.className = "panel-popout-button";
      popoutButton.textContent = options.popoutButtonLabel ?? "Pop out";
      popoutButton.title =
        options.popoutButtonTitle ??
        "Open the input name display in a new window.";
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

    container.append(utilityGroup);
  }

  if (!analysis.noteLabel && !analysis.primary) {
    container.classList.add("is-status");
    container.append(createStatusWrapper("No input to analyse"));
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
    container.append(statusWrapper);
    return;
  }

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "input-name-content-wrap";

  const notesValue = document.createElement("p");
  notesValue.className = "input-name-note-list";
  notesValue.textContent = analysis.noteLabel ?? "";

  const readingRow = document.createElement("div");
  readingRow.className = "input-name-reading-row";

  const primaryPill = document.createElement("button");
  primaryPill.className = "input-name-pill input-name-pill-primary";
  primaryPill.type = "button";
  primaryPill.textContent = analysis.primary.shorthand;
  primaryPill.setAttribute("aria-pressed", "true");
  readingRow.append(primaryPill);

  if (analysis.namingNote) {
    const namingNoteBadge = document.createElement("span");
    namingNoteBadge.className = "input-name-naming-note-badge";
    namingNoteBadge.textContent = "voicing";
    namingNoteBadge.title = analysis.namingNote;
    readingRow.append(namingNoteBadge);
  }

  if (analysis.alternates.length > 0) {
    const separator = document.createElement("span");
    separator.className = "input-name-separator";
    separator.textContent = "|";
    readingRow.append(separator);
  }

  for (const alternate of analysis.alternates) {
    const alternatePill = document.createElement("button");
    alternatePill.className = "input-name-pill input-name-pill-alternate";
    alternatePill.type = "button";
    alternatePill.textContent = alternate.shorthand;
    readingRow.append(alternatePill);
  }

  const longhand = document.createElement("p");
  longhand.className = "input-name-longhand";
  longhand.textContent = analysis.primary.longhand;

  contentWrapper.append(readingRow, notesValue, longhand);

  container.append(contentWrapper);
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
