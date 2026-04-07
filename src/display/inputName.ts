import type { InputAnalysis } from "../analysis/inputAnalysis";

export function renderInputNameDisplay(
  container: HTMLDivElement,
  analysis: InputAnalysis,
) {
  container.replaceChildren();
  container.classList.remove("is-status");

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
