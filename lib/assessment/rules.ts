export type EducationSystem = "CBC" | "8-4-4";

export type ExamStructure = "standard" | "kcse_style" | "kjsea_style";

export type SchoolAssessmentTypeId =
  | "quiz"
  | "cat"
  | "midterm"
  | "end_term"
  | "revision_test"
  | "diagnostic_assessment"
  | "assignment"
  | "kjsea_practice"
  | "mock"
  | "custom";

export type SchoolAssessmentType = {
  id: SchoolAssessmentTypeId;
  label: string;
  description: string;
  defaultMarks: number | null;
  defaultDuration: number | null;
};

export type OfficialComponentType = "WRITTEN" | "PRACTICAL";

export type ComponentVerificationStatus =
  | "VERIFIED"
  | "VERIFIED_STRUCTURE"
  | "VERIFIED_ASSESSMENT_STRUCTURE";

export type OfficialRuleSource = {
  issuer: string;
  title: string;
  reference: string;
  year: number;
  publishedOn: string;
  supplementalReferences: readonly {
    issuer: string;
    title: string;
    reference: string;
  }[];
};

export type OfficialComponent = {
  id: string;
  paperNumber: number;
  paperCode: string;
  label: string;
  officialLabel: string;
  componentType: OfficialComponentType;
  durationMinutes: number;
  officialMarks: number | null;
  verificationStatus: ComponentVerificationStatus;
  source: OfficialRuleSource;
};

export type OfficialComponentRule = {
  id: string;
  verificationStatus: "VERIFIED" | "SOURCE_REQUIRED";
  subjectCode: string | null;
  officialSubjectName: string | null;
  components: readonly OfficialComponent[];
  componentSelectionRequired: boolean;
  source: OfficialRuleSource | null;
  note: string;
};

export type AssessmentContext = {
  educationSystem: EducationSystem;
  level: string;
  gradeName: string;
  subjectName: string;
};

export type AssessmentRuleResolution = {
  context: AssessmentContext;
  allowedAssessmentTypes: readonly SchoolAssessmentType[];
  allowedExamStructures: readonly ExamStructure[];
  defaultExamStructure: ExamStructure;
  officialComponentRule: OfficialComponentRule | null;
};

export const APPLICATION_EXAM_LIMITS = {
  marks: { min: 1, max: 300 },
  durationMinutes: { min: 1, max: 360 },
} as const;

export const SCHOOL_ASSESSMENT_TYPES: Readonly<
  Record<SchoolAssessmentTypeId, SchoolAssessmentType>
> = {
  quiz: {
    id: "quiz",
    label: "Quiz",
    description: "A short teacher-created check of recently covered learning.",
    defaultMarks: 20,
    defaultDuration: 30,
  },
  cat: {
    id: "cat",
    label: "CAT",
    description: "A teacher-created continuous assessment test.",
    defaultMarks: 30,
    defaultDuration: 45,
  },
  midterm: {
    id: "midterm",
    label: "Midterm",
    description: "A school assessment covering learning completed by midterm.",
    defaultMarks: 50,
    defaultDuration: 60,
  },
  end_term: {
    id: "end_term",
    label: "End Term",
    description: "A broader school assessment of the curriculum actually covered in the term.",
    defaultMarks: 100,
    defaultDuration: 120,
  },
  revision_test: {
    id: "revision_test",
    label: "Revision Test",
    description: "A teacher-selected revision assessment.",
    defaultMarks: 50,
    defaultDuration: 60,
  },
  diagnostic_assessment: {
    id: "diagnostic_assessment",
    label: "Diagnostic Assessment",
    description: "A teacher-created sample of learner understanding across selected curriculum.",
    defaultMarks: 30,
    defaultDuration: 45,
  },
  assignment: {
    id: "assignment",
    label: "Assignment",
    description: "A teacher-created task based on selected curriculum coverage.",
    defaultMarks: 30,
    defaultDuration: 60,
  },
  kjsea_practice: {
    id: "kjsea_practice",
    label: "KJSEA Practice",
    description:
      "A school-generated practice paper constrained by a verified KJSEA component profile.",
    defaultMarks: null,
    defaultDuration: null,
  },
  mock: {
    id: "mock",
    label: "Mock",
    description: "A school mock; official-style components appear only after source verification.",
    defaultMarks: 100,
    defaultDuration: 120,
  },
  custom: {
    id: "custom",
    label: "Custom",
    description: "A fully teacher-configured school assessment.",
    defaultMarks: null,
    defaultDuration: null,
  },
};

const CBC_ASSESSMENT_TYPE_IDS: readonly SchoolAssessmentTypeId[] = [
  "quiz",
  "cat",
  "midterm",
  "end_term",
  "revision_test",
  "diagnostic_assessment",
  "assignment",
  "custom",
];

const GRADE_NINE_ASSESSMENT_TYPE_IDS: readonly SchoolAssessmentTypeId[] = [
  ...CBC_ASSESSMENT_TYPE_IDS,
  "kjsea_practice",
];

const FORM_ASSESSMENT_TYPE_IDS: readonly SchoolAssessmentTypeId[] = [
  "cat",
  "midterm",
  "end_term",
  "revision_test",
  "mock",
  "assignment",
  "diagnostic_assessment",
  "custom",
];

const KCSE_2026_SOURCE: OfficialRuleSource = {
  issuer: "Kenya National Examinations Council",
  title: "2026 KCSE EXAMINATION TIMETABLE, INSTRUCTIONS AND GUIDELINES",
  reference: "KNEC/TD/SE/KCSE/TT/26/005",
  year: 2026,
  publishedOn: "2026-02-19",
  supplementalReferences: [
    {
      issuer: "Kenya Law",
      title:
        "The Kenya National Examinations Council (Kenya Certificate of Secondary Education) Rules",
      reference: "KCSE subject-code schedule",
    },
  ],
};

const KJSEA_2026_SOURCE: OfficialRuleSource = {
  issuer: "Kenya National Examinations Council",
  title: "KJSEA Regulations",
  reference: "KJSEA subject and paper format schedules",
  year: 2026,
  publishedOn: "2026-02-26",
  supplementalReferences: [
    {
      issuer: "Kenya National Examinations Council",
      title: "2026 KJSEA Timetable and Instructions",
      reference: "KNEC/TD/SE/KJSEA/TT/2026/003",
    },
  ],
};

function kjseaComponent(
  paperNumber: number,
  paperCode: string,
  label: string,
  durationMinutes: number,
  officialMarks: number,
  componentType: OfficialComponentType = "WRITTEN"
): OfficialComponent {
  return {
    id: `kjsea-2026-${paperCode.replace("/", "-")}`,
    paperNumber,
    paperCode,
    label,
    officialLabel: label,
    componentType,
    durationMinutes,
    officialMarks,
    verificationStatus: "VERIFIED",
    source: KJSEA_2026_SOURCE,
  };
}

const VERIFIED_KJSEA_COMPONENTS: Readonly<Record<string, readonly OfficialComponent[]>> = {
  English: [
    kjseaComponent(1, "901/1", "English Language", 100, 50),
    kjseaComponent(2, "901/2", "English Composition & Literary Analysis", 105, 50),
  ],
  Kiswahili: [
    kjseaComponent(1, "902/1", "Kiswahili Lugha", 100, 50),
    kjseaComponent(2, "902/2", "Kiswahili Insha na Utangulizi wa Fasihi", 105, 50),
  ],
  Mathematics: [kjseaComponent(1, "903", "Mathematics", 120, 100)],
  "Integrated Science": [
    kjseaComponent(1, "905/1", "Integrated Science Paper 1", 100, 70),
    kjseaComponent(2, "905/2", "Integrated Science Written Practical Skills", 60, 30, "PRACTICAL"),
  ],
  "Social Studies": [kjseaComponent(1, "907", "Social Studies", 90, 100)],
  "Christian Religious Education": [
    kjseaComponent(1, "908", "Christian Religious Education", 90, 100),
  ],
};

function kcseComponent({
  subjectCode,
  paperNumber,
  label,
  officialLabel,
  durationMinutes,
  componentType = "WRITTEN",
  verificationStatus = "VERIFIED",
}: {
  subjectCode: string;
  paperNumber: number;
  label: string;
  officialLabel: string;
  durationMinutes: number;
  componentType?: OfficialComponentType;
  verificationStatus?: ComponentVerificationStatus;
}): OfficialComponent {
  return {
    id: `kcse-2026-${subjectCode}-${paperNumber}`,
    paperNumber,
    paperCode: `${subjectCode}/${paperNumber}`,
    label,
    officialLabel,
    componentType,
    durationMinutes,
    officialMarks: null,
    verificationStatus,
    source: KCSE_2026_SOURCE,
  };
}

function kcseSubjectRule({
  subjectName,
  officialSubjectName = subjectName,
  subjectCode,
  components,
}: {
  subjectName: string;
  officialSubjectName?: string;
  subjectCode: string;
  components: readonly OfficialComponent[];
}): {
  subjectName: string;
  rule: OfficialComponentRule;
} {
  return {
    subjectName,
    rule: {
      id: `kcse-2026-subject-${subjectCode}`,
      verificationStatus: "VERIFIED",
      subjectCode,
      officialSubjectName,
      components: [...components].sort(
        (a, b) => a.paperNumber - b.paperNumber
      ),
      componentSelectionRequired: true,
      source: KCSE_2026_SOURCE,
      note:
        "Verified KCSE component identities and durations for configuring KCSE-style school practice. Exact marks, sections and question counts remain unknown unless separately verified. The school examination is not administered by KNEC.",
    },
  };
}

const VERIFIED_KCSE_SUBJECT_RULES = [
  kcseSubjectRule({
    subjectName: "Mathematics",
    officialSubjectName: "Mathematics Alt. A",
    subjectCode: "121",
    components: [
      kcseComponent({
        subjectCode: "121",
        paperNumber: 1,
        label: "Paper 1",
        officialLabel: "Mathematics Alt. A",
        durationMinutes: 150,
      }),
      kcseComponent({
        subjectCode: "121",
        paperNumber: 2,
        label: "Paper 2",
        officialLabel: "Mathematics Alt. A",
        durationMinutes: 150,
      }),
    ],
  }),
  kcseSubjectRule({
    subjectName: "English",
    subjectCode: "101",
    components: [
      kcseComponent({
        subjectCode: "101",
        paperNumber: 1,
        label: "Paper 1 — Functional Skills",
        officialLabel: "English (Functional Skills)",
        durationMinutes: 120,
      }),
      kcseComponent({
        subjectCode: "101",
        paperNumber: 2,
        label: "Paper 2 — Comprehension, Literary Appreciation & Grammar",
        officialLabel:
          "English (Comprehension, Literary Appreciation & Grammar)",
        durationMinutes: 150,
      }),
      kcseComponent({
        subjectCode: "101",
        paperNumber: 3,
        label: "Paper 3 — Creative Composition & Essays based on Set Texts",
        officialLabel:
          "English (Creative Composition & Essays based on Set Texts)",
        durationMinutes: 150,
      }),
    ],
  }),
  kcseSubjectRule({
    subjectName: "Kiswahili",
    subjectCode: "102",
    components: [
      kcseComponent({
        subjectCode: "102",
        paperNumber: 1,
        label: "Paper 1 — Insha",
        officialLabel: "Kiswahili (Insha)",
        durationMinutes: 105,
        verificationStatus: "VERIFIED_ASSESSMENT_STRUCTURE",
      }),
      kcseComponent({
        subjectCode: "102",
        paperNumber: 2,
        label: "Paper 2 — Lugha",
        officialLabel: "Kiswahili (Lugha)",
        durationMinutes: 150,
        verificationStatus: "VERIFIED_ASSESSMENT_STRUCTURE",
      }),
      kcseComponent({
        subjectCode: "102",
        paperNumber: 3,
        label: "Paper 3 — Fasihi",
        officialLabel: "Kiswahili (Fasihi)",
        durationMinutes: 150,
        verificationStatus: "VERIFIED_ASSESSMENT_STRUCTURE",
      }),
    ],
  }),
  kcseSubjectRule({
    subjectName: "Chemistry",
    subjectCode: "233",
    components: [
      kcseComponent({
        subjectCode: "233",
        paperNumber: 1,
        label: "Paper 1 — Theory",
        officialLabel: "Chemistry (Theory)",
        durationMinutes: 120,
      }),
      kcseComponent({
        subjectCode: "233",
        paperNumber: 2,
        label: "Paper 2",
        officialLabel: "Chemistry",
        durationMinutes: 120,
      }),
      kcseComponent({
        subjectCode: "233",
        paperNumber: 3,
        label: "Paper 3 — Practical",
        officialLabel: "Chemistry (Practical)",
        durationMinutes: 135,
        componentType: "PRACTICAL",
      }),
    ],
  }),
  kcseSubjectRule({
    subjectName: "Biology",
    subjectCode: "231",
    components: [
      kcseComponent({
        subjectCode: "231",
        paperNumber: 1,
        label: "Paper 1",
        officialLabel: "Biology",
        durationMinutes: 120,
      }),
      kcseComponent({
        subjectCode: "231",
        paperNumber: 2,
        label: "Paper 2",
        officialLabel: "Biology",
        durationMinutes: 120,
        verificationStatus: "VERIFIED_STRUCTURE",
      }),
      kcseComponent({
        subjectCode: "231",
        paperNumber: 3,
        label: "Paper 3 — Practical",
        officialLabel: "Biology (Practical)",
        durationMinutes: 105,
        componentType: "PRACTICAL",
        verificationStatus: "VERIFIED_STRUCTURE",
      }),
    ],
  }),
  kcseSubjectRule({
    subjectName: "Physics",
    subjectCode: "232",
    components: [
      kcseComponent({
        subjectCode: "232",
        paperNumber: 1,
        label: "Paper 1",
        officialLabel: "Physics",
        durationMinutes: 120,
      }),
      kcseComponent({
        subjectCode: "232",
        paperNumber: 2,
        label: "Paper 2",
        officialLabel: "Physics",
        durationMinutes: 120,
      }),
      kcseComponent({
        subjectCode: "232",
        paperNumber: 3,
        label: "Paper 3 — Practical",
        officialLabel: "Physics (Practical)",
        durationMinutes: 150,
        componentType: "PRACTICAL",
      }),
    ],
  }),
  kcseSubjectRule({
    subjectName: "Christian Religious Education",
    subjectCode: "313",
    components: [
      kcseComponent({
        subjectCode: "313",
        paperNumber: 1,
        label: "Paper 1",
        officialLabel: "Christian Religious Education",
        durationMinutes: 150,
      }),
      kcseComponent({
        subjectCode: "313",
        paperNumber: 2,
        label: "Paper 2",
        officialLabel: "Christian Religious Education",
        durationMinutes: 150,
        verificationStatus: "VERIFIED_STRUCTURE",
      }),
    ],
  }),
] as const;

export function educationSystemLabel(system: EducationSystem): string {
  return system === "CBC" ? "CBC / CBE" : "8-4-4";
}

export function inferEducationSystem(gradeName: string): EducationSystem | null {
  if (/^Grade\s+\d+$/i.test(gradeName) || /^PP[12]$/i.test(gradeName)) return "CBC";
  if (/^Form\s+[1-4]$/i.test(gradeName)) return "8-4-4";
  return null;
}

export function isSupportedNewExamGrade(
  gradeName: string,
  level: string
): boolean {
  const gradeMatch = /^Grade\s+([1-9])$/i.exec(gradeName);
  if (gradeMatch) {
    const grade = Number(gradeMatch[1]);
    if (grade <= 3) return level === "Lower Primary";
    if (grade <= 6) return level === "Upper Primary";
    return level === "Junior School";
  }

  return /^Form\s+[1-4]$/i.test(gradeName) && level === "Secondary";
}

export function isSchoolAssessmentTypeId(
  value: string
): value is SchoolAssessmentTypeId {
  return Object.hasOwn(SCHOOL_ASSESSMENT_TYPES, value);
}

export function getSchoolAssessmentType(
  id: string
): SchoolAssessmentType | null {
  return isSchoolAssessmentTypeId(id) ? SCHOOL_ASSESSMENT_TYPES[id] : null;
}

const STANDARD_EXAM_STRUCTURES = ["standard"] as const;
const KCSE_STYLE_EXAM_STRUCTURES = ["kcse_style"] as const;
const KJSEA_STYLE_EXAM_STRUCTURES = ["kjsea_style"] as const;
const OPTIONAL_KCSE_EXAM_STRUCTURES = ["standard", "kcse_style"] as const;

export function examStructureLabel(
  structure: ExamStructure,
  assessmentTypeId: string
): string {
  if (structure === "kcse_style") return "KCSE-style Paper";
  if (structure === "kjsea_style") return "KJSEA-style Practice Paper";
  return assessmentTypeId === "revision_test"
    ? "Standard Revision Test"
    : "Standard School Exam";
}

function verifiedKcseRuleForContext(
  context: AssessmentContext
): OfficialComponentRule | null {
  if (
    context.educationSystem !== "8-4-4" ||
    context.level !== "Secondary"
  ) {
    return null;
  }

  return (
    VERIFIED_KCSE_SUBJECT_RULES.find(
      (entry) => entry.subjectName === context.subjectName
    )?.rule ?? null
  );
}

function isExistingFormFourMock(
  context: AssessmentContext,
  assessmentTypeId: string
): boolean {
  return context.gradeName === "Form 4" && assessmentTypeId === "mock";
}

function allowsOptionalKcseStyle(
  context: AssessmentContext,
  assessmentTypeId: string
): boolean {
  if (context.gradeName === "Form 4") {
    return assessmentTypeId === "end_term";
  }

  return (
    context.gradeName === "Form 3" &&
    (assessmentTypeId === "end_term" ||
      assessmentTypeId === "revision_test")
  );
}

export function resolveAllowedExamStructures(
  context: AssessmentContext,
  assessmentTypeId: string
): readonly ExamStructure[] {
  if (!isSchoolAssessmentTypeId(assessmentTypeId)) {
    return STANDARD_EXAM_STRUCTURES;
  }

  if (assessmentTypeId === "kjsea_practice") {
    return context.educationSystem === "CBC" &&
      context.level === "Junior School" &&
      context.gradeName === "Grade 9" &&
      VERIFIED_KJSEA_COMPONENTS[context.subjectName]
      ? KJSEA_STYLE_EXAM_STRUCTURES
      : STANDARD_EXAM_STRUCTURES;
  }

  const verifiedRule = verifiedKcseRuleForContext(context);
  if (!verifiedRule) return STANDARD_EXAM_STRUCTURES;

  if (isExistingFormFourMock(context, assessmentTypeId)) {
    return KCSE_STYLE_EXAM_STRUCTURES;
  }

  return allowsOptionalKcseStyle(context, assessmentTypeId)
    ? OPTIONAL_KCSE_EXAM_STRUCTURES
    : STANDARD_EXAM_STRUCTURES;
}

function sourceRequiredFormMockRule(context: AssessmentContext): OfficialComponentRule {
  return {
    id: `source-required:${context.gradeName}:${context.subjectName}:mock`,
    verificationStatus: "SOURCE_REQUIRED",
    subjectCode: null,
    officialSubjectName: null,
    components: [],
    componentSelectionRequired: false,
    source: null,
    note:
      "No authoritative KNEC paper/component source has been inspected for this Form and subject. The mock remains teacher-configurable.",
  };
}

export function resolveOfficialComponentRule(
  context: AssessmentContext,
  assessmentTypeId: string,
  examStructure?: ExamStructure
): OfficialComponentRule | null {
  if (!isSchoolAssessmentTypeId(assessmentTypeId)) return null;

  const allowedExamStructures = resolveAllowedExamStructures(
    context,
    assessmentTypeId
  );
  const defaultExamStructure =
    allowedExamStructures.length === 1
      ? allowedExamStructures[0]
      : "standard";
  const effectiveExamStructure = examStructure ?? defaultExamStructure;

  if (
    effectiveExamStructure === "kjsea_style" &&
    assessmentTypeId === "kjsea_practice"
  ) {
    const components = VERIFIED_KJSEA_COMPONENTS[context.subjectName];
    if (!components || context.gradeName !== "Grade 9") return null;
    return {
      id: `kjsea-2026-subject-${components[0].paperCode.split("/")[0]}`,
      verificationStatus: "VERIFIED",
      subjectCode: components[0].paperCode.split("/")[0],
      officialSubjectName: context.subjectName,
      components,
      componentSelectionRequired: components.length > 1,
      source: KJSEA_2026_SOURCE,
      note: "Verified KJSEA structure for school-generated practice; this is not a KNEC-issued paper.",
    };
  }

  if (
    effectiveExamStructure === "kcse_style" &&
    allowedExamStructures.includes(effectiveExamStructure)
  ) {
    return verifiedKcseRuleForContext(context);
  }

  if (context.educationSystem === "8-4-4" && assessmentTypeId === "mock") {
    return sourceRequiredFormMockRule(context);
  }

  return null;
}

export function resolveAssessmentRules(
  context: AssessmentContext,
  assessmentTypeId = "",
  examStructure?: ExamStructure
): AssessmentRuleResolution {
  const ids =
    context.educationSystem === "CBC"
      ? context.gradeName === "Grade 9"
        ? GRADE_NINE_ASSESSMENT_TYPE_IDS
        : CBC_ASSESSMENT_TYPE_IDS
      : FORM_ASSESSMENT_TYPE_IDS;
  const allowedExamStructures = resolveAllowedExamStructures(
    context,
    assessmentTypeId
  );
  const defaultExamStructure =
    allowedExamStructures.length === 1
      ? allowedExamStructures[0]
      : "standard";

  return {
    context,
    allowedAssessmentTypes: ids.map((id) => SCHOOL_ASSESSMENT_TYPES[id]),
    allowedExamStructures,
    defaultExamStructure,
    officialComponentRule: assessmentTypeId
      ? resolveOfficialComponentRule(
          context,
          assessmentTypeId,
          examStructure ?? defaultExamStructure
        )
      : null,
  };
}
