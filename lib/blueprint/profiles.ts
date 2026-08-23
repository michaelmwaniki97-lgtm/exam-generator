import type {
  BlueprintInput,
  QuestionFamily,
} from "./types.ts";

export type QuestionFamilyDefinition = {
  family: QuestionFamily;
  label: string;
  estimatedMinutesPerMark: number;
  preferredMarks: number;
  minimumSensibleMarks: number;
  maximumSensibleMarks: number;
};

export type ProfileGroup = {
  id?: string;
  label: string;
  purpose: string;
  weight: number;
  families: QuestionFamily[];
  exactMarks?: number;
  exactQuestionCount?: number;
  fixedFamilyCounts?: Partial<Record<QuestionFamily, number>>;
  instructions?: readonly string[];
};

export type SubjectBlueprintProfile = {
  id: string;
  practical: boolean;
  groups: ProfileGroup[];
};

const definition = (
  family: QuestionFamily,
  label: string,
  estimatedMinutesPerMark: number,
  preferredMarks: number,
  minimumSensibleMarks: number,
  maximumSensibleMarks: number
): QuestionFamilyDefinition => ({
  family,
  label,
  estimatedMinutesPerMark,
  preferredMarks,
  minimumSensibleMarks,
  maximumSensibleMarks,
});

export const QUESTION_FAMILY_DEFINITIONS: Readonly<
  Record<QuestionFamily, QuestionFamilyDefinition>
> = {
  objective: definition("objective", "Objective / very short response", 0.75, 1, 1, 2),
  very_short_response: definition("very_short_response", "Very short response", 0.8, 2, 1, 3),
  short_response: definition("short_response", "Short response", 1, 3, 1, 5),
  structured_response: definition("structured_response", "Structured response", 1.25, 5, 3, 10),
  short_computation: definition("short_computation", "Short computation", 1, 3, 1, 5),
  structured_calculation: definition("structured_calculation", "Structured calculation", 1.35, 5, 3, 10),
  multi_step_problem_solving: definition("multi_step_problem_solving", "Multi-step problem solving", 1.55, 7, 4, 15),
  application_context_problem: definition("application_context_problem", "Application / context problem", 1.45, 6, 3, 12),
  mathematical_reasoning: definition("mathematical_reasoning", "Mathematical reasoning", 1.5, 5, 3, 10),
  explanation: definition("explanation", "Scientific explanation", 1.25, 4, 2, 8),
  scientific_calculation: definition("scientific_calculation", "Scientific calculation", 1.4, 5, 2, 10),
  data_graph_interpretation: definition("data_graph_interpretation", "Data / graph interpretation", 1.35, 5, 2, 10),
  scientific_application: definition("scientific_application", "Scientific application / problem solving", 1.45, 6, 3, 12),
  recall_knowledge: definition("recall_knowledge", "Recall / knowledge", 0.95, 3, 1, 6),
  structured_explanation: definition("structured_explanation", "Structured explanation", 1.25, 5, 2, 10),
  interpretation_application: definition("interpretation_application", "Interpretation / application", 1.35, 6, 3, 12),
  extended_response: definition("extended_response", "Extended response", 1.8, 10, 6, 25),
  functional_communication: definition("functional_communication", "Functional communication", 1.65, 10, 5, 20),
  comprehension: definition("comprehension", "Comprehension", 1.4, 8, 4, 20),
  literary_appreciation: definition("literary_appreciation", "Literary appreciation", 1.6, 8, 4, 20),
  grammar_language_use: definition("grammar_language_use", "Grammar / language use", 1.05, 4, 1, 10),
  creative_composition: definition("creative_composition", "Creative composition", 2, 15, 10, 40),
  set_text_response: definition("set_text_response", "Set-text extended response", 1.9, 15, 8, 30),
  insha: definition("insha", "Insha", 2, 15, 10, 40),
  lugha: definition("lugha", "Lugha", 1.2, 5, 2, 12),
  fasihi: definition("fasihi", "Fasihi", 1.65, 9, 4, 25),
  practical_observation: definition("practical_observation", "Observation", 1.4, 4, 1, 8),
  practical_measurement: definition("practical_measurement", "Measurement", 1.5, 5, 2, 10),
  practical_recording: definition("practical_recording", "Recording", 1.3, 4, 1, 8),
  practical_data_handling: definition("practical_data_handling", "Practical data handling", 1.55, 6, 2, 12),
  practical_calculation: definition("practical_calculation", "Practical calculation", 1.5, 5, 2, 10),
  practical_interpretation: definition("practical_interpretation", "Practical interpretation", 1.55, 6, 2, 12),
  practical_conclusion: definition("practical_conclusion", "Conclusion", 1.3, 4, 1, 8),
  rich_application_task: definition("rich_application_task", "Rich application task", 1.6, 8, 4, 20),
};

const group = (
  label: string,
  purpose: string,
  weight: number,
  families: QuestionFamily[]
): ProfileGroup => ({ label, purpose, weight, families });

const COMPONENT_PROFILES: Readonly<Record<string, SubjectBlueprintProfile>> = {
  "101/1": {
    id: "english-functional-skills",
    practical: false,
    groups: [group("Functional communication", "Plan functional communication and writing tasks.", 1, ["functional_communication"])],
  },
  "101/2": {
    id: "english-comprehension-literary-grammar",
    practical: false,
    groups: [
      group("Comprehension", "Plan comprehension tasks within the selected curriculum.", 0.4, ["comprehension"]),
      group("Literary appreciation", "Plan literary appreciation responses within the selected curriculum.", 0.35, ["literary_appreciation"]),
      group("Grammar and language use", "Plan grammar and language-use tasks.", 0.25, ["grammar_language_use"]),
    ],
  },
  "101/3": {
    id: "english-composition-set-text",
    practical: false,
    groups: [
      group("Creative composition", "Plan creative composition tasks.", 0.5, ["creative_composition"]),
      group("Set-text response", "Plan extended literary or set-text responses within selected curriculum.", 0.5, ["set_text_response"]),
    ],
  },
  "102/1": {
    id: "kiswahili-insha",
    practical: false,
    groups: [group("Insha", "Plan composition and writing tasks.", 1, ["insha"])],
  },
  "102/2": {
    id: "kiswahili-lugha",
    practical: false,
    groups: [group("Lugha", "Plan language-use tasks within the selected curriculum.", 1, ["lugha"])],
  },
  "102/3": {
    id: "kiswahili-fasihi",
    practical: false,
    groups: [group("Fasihi", "Plan literary assessment within the selected curriculum.", 1, ["fasihi"])],
  },
};

function normalizedSubject(subjectName: string): string {
  return subjectName.trim().toLowerCase();
}

function isScience(subjectName: string): boolean {
  return [
    "biology",
    "chemistry",
    "physics",
    "integrated science",
    "science and technology",
  ].includes(normalizedSubject(subjectName));
}

function standardProfile(input: BlueprintInput): SubjectBlueprintProfile {
  const subject = normalizedSubject(input.subjectName);

  if (subject === "mathematics") {
    return {
      id: "mathematics",
      practical: false,
      groups: [
        group("Core mathematical skills", "Plan concise computation and structured calculation.", 0.52, ["short_computation", "structured_calculation"]),
        group("Application and reasoning", "Plan contextual, multi-step and reasoning tasks.", 0.48, ["multi_step_problem_solving", "application_context_problem", "mathematical_reasoning"]),
      ],
    };
  }

  if (isScience(input.subjectName)) {
    return {
      id: "science-theory",
      practical: false,
      groups: [
        group("Scientific knowledge and explanation", "Plan short and structured scientific responses.", 0.48, ["short_response", "structured_response", "explanation"]),
        group("Scientific application and data", "Plan calculations, data interpretation and application.", 0.52, ["scientific_calculation", "data_graph_interpretation", "scientific_application"]),
      ],
    };
  }

  if (subject === "christian religious education" || subject === "cre") {
    return {
      id: "christian-religious-education",
      practical: false,
      groups: [
        group("Knowledge and explanation", "Plan recall and structured explanation.", 0.48, ["recall_knowledge", "structured_explanation"]),
        group("Interpretation and application", "Plan interpretation, application and extended response.", 0.52, ["interpretation_application", "extended_response"]),
      ],
    };
  }

  if (subject === "english") {
    return {
      id: "english-standard",
      practical: false,
      groups: [
        group("Language use", "Plan functional, comprehension and language-use tasks.", 0.55, ["functional_communication", "comprehension", "grammar_language_use"]),
        group("Extended communication", "Plan extended communication appropriate to selected curriculum.", 0.45, ["creative_composition", "literary_appreciation"]),
      ],
    };
  }

  if (subject === "kiswahili") {
    return {
      id: "kiswahili-standard",
      practical: false,
      groups: [
        group("Lugha", "Plan language-use tasks within selected curriculum.", 0.55, ["lugha"]),
        group("Communication and literature", "Plan composition and literary assessment where selected.", 0.45, ["insha", "fasihi"]),
      ],
    };
  }

  return {
    id: "general-curriculum",
    practical: false,
    groups: [
      group("Core understanding", "Plan concise checks of selected curriculum.", 0.5, ["very_short_response", "short_response", "structured_response"]),
      group("Application", "Plan application-oriented tasks within selected curriculum.", 0.5, ["rich_application_task"]),
    ],
  };
}

function lowerPrimaryProfile(profile: SubjectBlueprintProfile): SubjectBlueprintProfile {
  const allowed = new Set<QuestionFamily>([
    "objective",
    "very_short_response",
    "short_response",
    "short_computation",
    "application_context_problem",
  ]);
  const groups = profile.groups
    .map((candidate) => ({
      ...candidate,
      families: candidate.families.filter((family) => allowed.has(family)),
    }))
    .filter((candidate) => candidate.families.length > 0)
    .slice(0, 2);

  return {
    id: `${profile.id}-lower-primary`,
    practical: false,
    groups: groups.length
      ? groups
      : [group("Age-appropriate tasks", "Plan short, clear tasks for Lower Primary learners.", 1, ["very_short_response", "short_response"])],
  };
}

export function resolveSubjectBlueprintProfile(
  input: BlueprintInput
): SubjectBlueprintProfile {
  if (input.assessmentProfile.sections.length) {
    return {
      id: input.assessmentProfile.profileId,
      practical: input.component?.componentType === "PRACTICAL",
      groups: [...input.assessmentProfile.sections]
        .sort((a, b) => a.order - b.order)
        .map((section) => ({
          id: section.id,
          label: section.title,
          purpose: section.instructions.join(" ") || `Complete ${section.title}.`,
          weight: section.marks ?? 1,
          families: [...section.allowedQuestionFamilies],
          ...(section.marks === null ? {} : { exactMarks: section.marks }),
          ...(section.questionCount?.exact === undefined
            ? {}
            : { exactQuestionCount: section.questionCount.exact }),
          ...(section.fixedFamilyCounts
            ? { fixedFamilyCounts: section.fixedFamilyCounts }
            : {}),
          instructions: section.instructions,
        })),
    };
  }
  if (input.component?.componentType === "PRACTICAL") {
    return {
      id: `science-practical-${input.component.paperCode}`,
      practical: true,
      groups: [
        group("Practical task planning", "Plan safe, teacher-reviewed practical task intents without procedures.", 1, [
          "practical_observation",
          "practical_measurement",
          "practical_recording",
          "practical_data_handling",
          "practical_calculation",
          "practical_interpretation",
          "practical_conclusion",
        ]),
      ],
    };
  }

  const componentProfile = input.component
    ? COMPONENT_PROFILES[input.component.paperCode]
    : null;
  const profile = componentProfile ?? standardProfile(input);

  return input.educationLevel === "Lower Primary"
    ? lowerPrimaryProfile(profile)
    : profile;
}

export function questionFamilyDefinition(
  family: QuestionFamily
): QuestionFamilyDefinition {
  return QUESTION_FAMILY_DEFINITIONS[family];
}

export function practicalQuestionFamilies(): ReadonlySet<QuestionFamily> {
  return new Set(
    Object.keys(QUESTION_FAMILY_DEFINITIONS).filter((family) =>
      family.startsWith("practical_")
    ) as QuestionFamily[]
  );
}
