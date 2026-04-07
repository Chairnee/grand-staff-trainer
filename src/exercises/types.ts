export type PromptSlot = {
  duration: string;
  trebleKeys?: string[];
  bassKeys?: string[];
  displayedTrebleKeys?: string[];
  displayedBassKeys?: string[];
  trebleDisplayedClef?: "treble" | "bass";
  bassDisplayedClef?: "treble" | "bass";
  trebleOttavaStart?: boolean;
  trebleOttavaEnd?: boolean;
};
