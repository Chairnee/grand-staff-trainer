export type PromptAnnotation = {
  staff: "treble" | "bass";
  placement: "above" | "below";
  text: string;
};

export type PromptSlot = {
  duration: string;
  isPlayable?: boolean;
  trebleKeys?: string[];
  bassKeys?: string[];
  trebleRestVisible?: boolean;
  bassRestVisible?: boolean;
  annotations?: PromptAnnotation[];
  displayedTrebleKeys?: string[];
  displayedBassKeys?: string[];
  trebleDisplayedClef?: "treble" | "bass";
  bassDisplayedClef?: "treble" | "bass";
  trebleOttavaStart?: boolean;
  trebleOttavaEnd?: boolean;
};

export type ExerciseNotationProfile = {
  timeSignature: string;
  beatsPerMeasure: number;
};
