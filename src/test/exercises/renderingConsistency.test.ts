import { describe, expect, it } from "vitest";

import { createArpeggioPracticeQueue } from "../../exercises/arpeggios";
import { createCadencePracticeQueue } from "../../exercises/cadences";
import { createScalePracticeQueue } from "../../exercises/scales";
import { createTriadPracticeQueue } from "../../exercises/triads";
import type { PromptSlot } from "../../exercises/types";
import {
  getAllTonics,
  getCadenceRenderingOptions,
  getScaleNoteNames,
  getScaleNoteNamesForRenderedTonicName,
  getScaleRenderingOptions,
  getTriadNoteNames,
  getTriadRenderingOptions,
  type GenerationSettings,
  type ScaleType,
  type Tonic,
  type TriadType,
} from "../../theory/music";

function createGenerationSettings(
  overrides: Partial<GenerationSettings> = {},
): GenerationSettings {
  return {
    practiceMode: "scales",
    scaleHands: "together",
    scaleOctaves: 2,
    scaleMotion: "parallel",
    scaleDirection: "ascending",
    rangeStart: "c/2",
    rangeEnd: "c/6",
    noteSourceMode: "in-scale",
    accidentalSpellingMode: "sharps",
    tonic: "C",
    scaleType: "major",
    triadType: "major",
    renderingPreference: "preferred",
    ...overrides,
  };
}

function getPromptNoteNames(promptQueue: PromptSlot[]) {
  return promptQueue
    .flatMap((prompt) => [...(prompt.trebleKeys ?? []), ...(prompt.bassKeys ?? [])])
    .map((key) => key.split("/")[0] ?? "");
}

function getUnexpectedNoteNames(
  actualNoteNames: string[],
  allowedNoteNames: Iterable<string>,
) {
  const allowed = new Set(allowedNoteNames);

  return Array.from(
    new Set(actualNoteNames.filter((noteName) => !allowed.has(noteName))),
  ).sort();
}

describe("exercise rendering consistency", () => {
  it("keeps scale exercises inside the chosen rendered scale spelling", () => {
    const leaks: string[] = [];
    const scaleTypes: ScaleType[] = [
      "major",
      "natural-minor",
      "harmonic-minor",
      "melodic-minor",
    ];

    for (const tonic of getAllTonics()) {
      for (const scaleType of scaleTypes) {
        for (const scaleHands of ["treble", "bass"] as const) {
          for (const scaleDirection of ["ascending", "descending"] as const) {
            const generationSettings = createGenerationSettings({
              practiceMode: "scales",
              tonic,
              scaleType,
              scaleHands,
              scaleDirection,
            });
            const allowedNoteNames = getScaleNoteNames(
              tonic,
              scaleType,
              "preferred",
            );
            const actualNoteNames = getPromptNoteNames(
              createScalePracticeQueue(generationSettings),
            );
            const unexpectedNoteNames = getUnexpectedNoteNames(
              actualNoteNames,
              allowedNoteNames,
            );

            if (unexpectedNoteNames.length > 0) {
              leaks.push(
                `${tonic} ${scaleType} ${scaleHands} ${scaleDirection}: ${unexpectedNoteNames.join(", ")}`,
              );
            }
          }
        }

        const togetherGenerationSettings = createGenerationSettings({
          practiceMode: "scales",
          tonic,
          scaleType,
          scaleHands: "together",
          scaleDirection: "ascending",
        });
        const togetherAllowedNoteNames = getScaleNoteNames(
          tonic,
          scaleType,
          "preferred",
        );
        const togetherActualNoteNames = getPromptNoteNames(
          createScalePracticeQueue(togetherGenerationSettings),
        );
        const togetherUnexpectedNoteNames = getUnexpectedNoteNames(
          togetherActualNoteNames,
          togetherAllowedNoteNames,
        );

        if (togetherUnexpectedNoteNames.length > 0) {
          leaks.push(
            `${tonic} ${scaleType} together: ${togetherUnexpectedNoteNames.join(", ")}`,
          );
        }
      }
    }

    expect(leaks).toEqual([]);
  });

  it("keeps triad exercises inside the chosen rendered triad spelling", () => {
    const leaks: string[] = [];
    const triadTypes: TriadType[] = ["major", "minor"];

    for (const tonic of getAllTonics()) {
      for (const triadType of triadTypes) {
        const generationSettings = createGenerationSettings({
          practiceMode: "triads",
          tonic,
          triadType,
        });
        const allowedNoteNames = getTriadNoteNames(tonic, triadType, "preferred");
        const actualNoteNames = getPromptNoteNames(
          createTriadPracticeQueue(generationSettings),
        );
        const unexpectedNoteNames = getUnexpectedNoteNames(
          actualNoteNames,
          allowedNoteNames,
        );

        if (unexpectedNoteNames.length > 0) {
          leaks.push(`${tonic} ${triadType}: ${unexpectedNoteNames.join(", ")}`);
        }
      }
    }

    expect(leaks).toEqual([]);
  });

  it("keeps arpeggio exercises inside the chosen rendered arpeggio spelling", () => {
    const leaks: string[] = [];
    const triadTypes: TriadType[] = ["major", "minor"];

    for (const tonic of getAllTonics()) {
      for (const triadType of triadTypes) {
        const generationSettings = createGenerationSettings({
          practiceMode: "arpeggios",
          tonic,
          triadType,
        });
        const allowedNoteNames = getTriadNoteNames(tonic, triadType, "preferred");
        const actualNoteNames = getPromptNoteNames(
          createArpeggioPracticeQueue(generationSettings),
        );
        const unexpectedNoteNames = getUnexpectedNoteNames(
          actualNoteNames,
          allowedNoteNames,
        );

        if (unexpectedNoteNames.length > 0) {
          leaks.push(
            `${tonic} ${triadType} arpeggios: ${unexpectedNoteNames.join(", ")}`,
          );
        }
      }
    }

    expect(leaks).toEqual([]);
  });

  it("keeps cadence exercises inside one rendered tonic spelling system", () => {
    const leaks: string[] = [];
    const triadTypes: TriadType[] = ["major", "minor"];

    for (const tonic of getAllTonics()) {
      for (const triadType of triadTypes) {
        const generationSettings = createGenerationSettings({
          practiceMode: "cadences",
          tonic,
          triadType,
          scaleOctaves: 1,
        });
        const renderedTonic =
          getCadenceRenderingOptions(generationSettings).active.tonic.toLowerCase();
        const allowedNoteNames =
          triadType === "major"
            ? getScaleNoteNamesForRenderedTonicName(renderedTonic, "major")
            : new Set([
                ...getScaleNoteNamesForRenderedTonicName(
                  renderedTonic,
                  "natural-minor",
                ),
                ...getScaleNoteNamesForRenderedTonicName(
                  renderedTonic,
                  "harmonic-minor",
                ),
              ]);
        const actualNoteNames = getPromptNoteNames(
          createCadencePracticeQueue(generationSettings),
        );
        const unexpectedNoteNames = getUnexpectedNoteNames(
          actualNoteNames,
          allowedNoteNames,
        );

        if (unexpectedNoteNames.length > 0) {
          leaks.push(`${tonic} ${triadType}: ${unexpectedNoteNames.join(", ")}`);
        }
      }
    }

    expect(leaks).toEqual([]);
  });

  it("keeps every alternate rendered exercise inside its alternate spelling too", () => {
    const leaks: string[] = [];
    const scaleTypes: ScaleType[] = [
      "major",
      "natural-minor",
      "harmonic-minor",
      "melodic-minor",
    ];
    const triadTypes: TriadType[] = ["major", "minor"];

    for (const tonic of getAllTonics()) {
      for (const scaleType of scaleTypes) {
        for (const scaleHands of ["treble", "bass"] as const) {
          for (const scaleDirection of ["ascending", "descending"] as const) {
            const generationSettings = createGenerationSettings({
              practiceMode: "scales",
              tonic,
              scaleType,
              scaleHands,
              scaleDirection,
              renderingPreference: "alternate",
            });
            const renderingOptions = getScaleRenderingOptions(generationSettings);

            if (!renderingOptions.alternate) {
              continue;
            }

            const renderedTonic = renderingOptions.active.tonic.toLowerCase();
            const allowedNoteNames = getScaleNoteNamesForRenderedTonicName(
              renderedTonic,
              scaleType,
            );
            const actualNoteNames = getPromptNoteNames(
              createScalePracticeQueue(generationSettings),
            );
            const unexpectedNoteNames = getUnexpectedNoteNames(
              actualNoteNames,
              allowedNoteNames,
            );

            if (unexpectedNoteNames.length > 0) {
              leaks.push(
                `${tonic} ${scaleType} ${scaleHands} ${scaleDirection} scales: ${unexpectedNoteNames.join(", ")}`,
              );
            }
          }
        }
      }

      for (const triadType of triadTypes) {
        const triadGenerationSettings = createGenerationSettings({
          practiceMode: "triads",
          tonic,
          triadType,
          renderingPreference: "alternate",
        });
        const triadRenderingOptions = getTriadRenderingOptions(
          triadGenerationSettings,
        );

        if (!triadRenderingOptions.alternate) {
          continue;
        }

        const triadRenderedTonic = triadRenderingOptions.active.tonic.toLowerCase();
        const triadScaleType = triadType === "major" ? "major" : "natural-minor";
        const triadRenderedScaleNoteNames = getScaleNoteNamesForRenderedTonicName(
          triadRenderedTonic,
          triadScaleType,
        );
        const triadAllowedNoteNames = [
          triadRenderedScaleNoteNames[0],
          triadRenderedScaleNoteNames[2],
          triadRenderedScaleNoteNames[4],
        ].filter((noteName): noteName is string => Boolean(noteName));
        const triadActualNoteNames = getPromptNoteNames(
          createTriadPracticeQueue(triadGenerationSettings),
        );
        const triadUnexpectedNoteNames = getUnexpectedNoteNames(
          triadActualNoteNames,
          triadAllowedNoteNames,
        );

        if (triadUnexpectedNoteNames.length > 0) {
          leaks.push(`${tonic} ${triadType} triads: ${triadUnexpectedNoteNames.join(", ")}`);
        }

        const arpeggioGenerationSettings = createGenerationSettings({
          practiceMode: "arpeggios",
          tonic,
          triadType,
          renderingPreference: "alternate",
        });
        const arpeggioRenderingOptions = getTriadRenderingOptions(
          arpeggioGenerationSettings,
        );

        if (arpeggioRenderingOptions.alternate) {
          const arpeggioRenderedTonic =
            arpeggioRenderingOptions.active.tonic.toLowerCase();
          const arpeggioScaleType =
            triadType === "major" ? "major" : "natural-minor";
          const arpeggioRenderedScaleNoteNames =
            getScaleNoteNamesForRenderedTonicName(
              arpeggioRenderedTonic,
              arpeggioScaleType,
            );
          const arpeggioAllowedNoteNames = [
            arpeggioRenderedScaleNoteNames[0],
            arpeggioRenderedScaleNoteNames[2],
            arpeggioRenderedScaleNoteNames[4],
          ].filter((noteName): noteName is string => Boolean(noteName));
          const arpeggioActualNoteNames = getPromptNoteNames(
            createArpeggioPracticeQueue(arpeggioGenerationSettings),
          );
          const arpeggioUnexpectedNoteNames = getUnexpectedNoteNames(
            arpeggioActualNoteNames,
            arpeggioAllowedNoteNames,
          );

          if (arpeggioUnexpectedNoteNames.length > 0) {
            leaks.push(
              `${tonic} ${triadType} arpeggios: ${arpeggioUnexpectedNoteNames.join(", ")}`,
            );
          }
        }

        const cadenceGenerationSettings = createGenerationSettings({
          practiceMode: "cadences",
          tonic,
          triadType,
          scaleOctaves: 1,
          renderingPreference: "alternate",
        });
        const cadenceRenderingOptions = getCadenceRenderingOptions(
          cadenceGenerationSettings,
        );

        if (!cadenceRenderingOptions.alternate) {
          continue;
        }

        const cadenceRenderedTonic =
          cadenceRenderingOptions.active.tonic.toLowerCase();
        const cadenceAllowedNoteNames =
          triadType === "major"
            ? getScaleNoteNamesForRenderedTonicName(cadenceRenderedTonic, "major")
            : new Set([
                ...getScaleNoteNamesForRenderedTonicName(
                  cadenceRenderedTonic,
                  "natural-minor",
                ),
                ...getScaleNoteNamesForRenderedTonicName(
                  cadenceRenderedTonic,
                  "harmonic-minor",
                ),
              ]);
        const cadenceActualNoteNames = getPromptNoteNames(
          createCadencePracticeQueue(cadenceGenerationSettings),
        );
        const cadenceUnexpectedNoteNames = getUnexpectedNoteNames(
          cadenceActualNoteNames,
          cadenceAllowedNoteNames,
        );

        if (cadenceUnexpectedNoteNames.length > 0) {
          leaks.push(
            `${tonic} ${triadType} cadences: ${cadenceUnexpectedNoteNames.join(", ")}`,
          );
        }
      }
    }

    expect(leaks).toEqual([]);
  });
});
