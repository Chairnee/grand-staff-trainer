import type { InputAnalysis } from "../inputAnalysis";

export function renderInputNameDisplay(
  container: HTMLDivElement,
  analysis: InputAnalysis,
) {
  container.replaceChildren();

  const heading = document.createElement("p");
  heading.className = "input-name-heading";
  heading.textContent = "Current input";

  const primaryLabel = document.createElement("p");
  primaryLabel.className = "input-name-primary";
  primaryLabel.textContent = analysis.primaryLabel;

  container.append(heading, primaryLabel);

  if (!analysis.secondaryLabel) {
    return;
  }

  const secondaryLabel = document.createElement("p");
  secondaryLabel.className = "input-name-secondary";
  secondaryLabel.textContent = analysis.secondaryLabel;
  container.append(secondaryLabel);
}
