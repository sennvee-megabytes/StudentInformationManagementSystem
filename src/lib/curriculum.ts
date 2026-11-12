export type CurriculumSubject = {
  subjectCode: string;
  subjectTitle: string;
  units: number;
};

const GENERAL_YEAR1_FIRST: CurriculumSubject[] = [
  { subjectCode: "GNED 02", subjectTitle: "Ethics", units: 3.0 },
  { subjectCode: "GNED 05", subjectTitle: "Purposive Communication", units: 3.0 },
  { subjectCode: "GNED 11", subjectTitle: "Kontekstwalisadong Komunikasyon sa Filipino", units: 3.0 },
  { subjectCode: "FITT 1", subjectTitle: "Movement Enhancement", units: 2.0 },
  { subjectCode: "NSTP 1", subjectTitle: "National Service Training Program 1", units: 3.0 },
];

const GENERAL_YEAR1_SECOND: CurriculumSubject[] = [
  { subjectCode: "GNED 01", subjectTitle: "Art Appreciation", units: 3.0 },
  { subjectCode: "GNED 03", subjectTitle: "Mathematics in the Modern World", units: 3.0 },
  { subjectCode: "GNED 06", subjectTitle: "Science, Technology, and Society", units: 3.0 },
  { subjectCode: "FITT 2", subjectTitle: "Fitness Exercises", units: 2.0 },
  { subjectCode: "NSTP 2", subjectTitle: "National Service Training Program 2", units: 3.0 },
];

export const CEIT_CURRICULUM: Record<
  string,
  Record<number, Record<"FIRST" | "SECOND" | "MIDYEAR", CurriculumSubject[]>>
> = {
  BSIT: {
    1: {
      FIRST: [
        { subjectCode: "DCIT 21", subjectTitle: "Introduction to Computing", units: 3.0 },
        { subjectCode: "DCIT 22", subjectTitle: "Computer Programming 1", units: 3.0 },
        { subjectCode: "COSC 50", subjectTitle: "Discrete Structures 1", units: 3.0 },
        ...GENERAL_YEAR1_FIRST,
      ],
      SECOND: [
        { subjectCode: "DCIT 23", subjectTitle: "Computer Programming 2", units: 3.0 },
        { subjectCode: "ITEC 50", subjectTitle: "Web Systems and Technologies", units: 3.0 },
        { subjectCode: "DCIT 24", subjectTitle: "Information Management", units: 3.0 },
        ...GENERAL_YEAR1_SECOND,
      ],
      MIDYEAR: [
        { subjectCode: "ITEC 55", subjectTitle: "Platform Technologies", units: 3.0 },
      ],
    },
    2: {
      FIRST: [
        { subjectCode: "DCIT 50", subjectTitle: "Object-Oriented Programming", units: 3.0 },
        { subjectCode: "DCIT 55", subjectTitle: "Advanced Database Systems", units: 3.0 },
        { subjectCode: "ITEC 60", subjectTitle: "Integrated Programming and Technologies 1", units: 3.0 },
        { subjectCode: "ITEC 65", subjectTitle: "Open Source Technology", units: 3.0 },
        { subjectCode: "FITT 3", subjectTitle: "Physical Activities Towards Health and Fitness 1", units: 2.0 },
      ],
      SECOND: [
        { subjectCode: "ITEC 70", subjectTitle: "Multimedia Systems", units: 3.0 },
        { subjectCode: "ITEC 75", subjectTitle: "System Integration and Architecture 1", units: 3.0 },
        { subjectCode: "DCIT 60", subjectTitle: "Methods of Research for IT", units: 3.0 },
        { subjectCode: "FITT 4", subjectTitle: "Physical Activities Towards Health and Fitness 2", units: 2.0 },
      ],
      MIDYEAR: [],
    },
    3: {
      FIRST: [
        { subjectCode: "INSY 55", subjectTitle: "Information Assurance and Security 1", units: 3.0 },
        { subjectCode: "ITEC 80", subjectTitle: "Introduction to Human Computer Interaction", units: 3.0 },
        { subjectCode: "ITEC 85", subjectTitle: "Information Assurance and Security 2", units: 3.0 },
        { subjectCode: "ITEC 90", subjectTitle: "Network Fundamentals", units: 3.0 },
        { subjectCode: "DCIT 65", subjectTitle: "Social and Professional Issues in IT", units: 3.0 },
      ],
      SECOND: [
        { subjectCode: "ITEC 95", subjectTitle: "Quantitative Methods (Modeling and Simulation)", units: 3.0 },
        { subjectCode: "ITEC 100", subjectTitle: "Information Assurance and Security 2 (Lab)", units: 3.0 },
        { subjectCode: "ITEC 105", subjectTitle: "Network Management", units: 3.0 },
        { subjectCode: "ITEC 199", subjectTitle: "Capstone Project and Research 1", units: 3.0 },
      ],
      MIDYEAR: [
        { subjectCode: "ITEC 198", subjectTitle: "Practicum / On-the-Job Training (486 Hours)", units: 6.0 },
      ],
    },
    4: {
      FIRST: [
        { subjectCode: "ITEC 110", subjectTitle: "Systems Administration and Maintenance", units: 3.0 },
        { subjectCode: "ITEC 115", subjectTitle: "Systems Integration and Architecture 2", units: 3.0 },
        { subjectCode: "ITEC 200", subjectTitle: "Capstone Project and Research 2", units: 3.0 },
      ],
      SECOND: [
        { subjectCode: "ITEC 198", subjectTitle: "On-the-Job Training / Internship", units: 6.0 },
      ],
      MIDYEAR: [],
    },
  },
  BSCS: {
    1: {
      FIRST: [
        { subjectCode: "DCIT 21", subjectTitle: "Introduction to Computing", units: 3.0 },
        { subjectCode: "DCIT 22", subjectTitle: "Computer Programming 1", units: 3.0 },
        { subjectCode: "COSC 50", subjectTitle: "Discrete Structures 1", units: 3.0 },
        ...GENERAL_YEAR1_FIRST,
      ],
      SECOND: [
        { subjectCode: "DCIT 23", subjectTitle: "Computer Programming 2", units: 3.0 },
        { subjectCode: "COSC 55", subjectTitle: "Discrete Structures 2", units: 3.0 },
        { subjectCode: "COSC 60", subjectTitle: "Digital Logic Design", units: 3.0 },
        ...GENERAL_YEAR1_SECOND,
      ],
      MIDYEAR: [],
    },
    2: {
      FIRST: [
        { subjectCode: "COSC 65", subjectTitle: "Architecture and Organization", units: 3.0 },
        { subjectCode: "COSC 70", subjectTitle: "Software Engineering 1", units: 3.0 },
        { subjectCode: "DCIT 50", subjectTitle: "Object-Oriented Programming", units: 3.0 },
        { subjectCode: "DCIT 25", subjectTitle: "Data Structures and Algorithms", units: 3.0 },
      ],
      SECOND: [
        { subjectCode: "COSC 75", subjectTitle: "Software Engineering 2", units: 3.0 },
        { subjectCode: "COSC 80", subjectTitle: "Operating Systems", units: 3.0 },
        { subjectCode: "COSC 85", subjectTitle: "Networks and Communications", units: 3.0 },
      ],
      MIDYEAR: [],
    },
    3: {
      FIRST: [
        { subjectCode: "COSC 90", subjectTitle: "Design and Analysis of Algorithms", units: 3.0 },
        { subjectCode: "COSC 95", subjectTitle: "Programming Languages", units: 3.0 },
        { subjectCode: "INSY 55", subjectTitle: "Information Assurance and Security", units: 3.0 },
        { subjectCode: "COSC 100", subjectTitle: "Automata Theory and Formal Languages", units: 3.0 },
      ],
      SECOND: [
        { subjectCode: "COSC 105", subjectTitle: "Intelligent Systems", units: 3.0 },
        { subjectCode: "COSC 110", subjectTitle: "Numerical and Symbolic Computation", units: 3.0 },
        { subjectCode: "COSC 199", subjectTitle: "CS Thesis Writing 1", units: 3.0 },
      ],
      MIDYEAR: [],
    },
    4: {
      FIRST: [
        { subjectCode: "COSC 200", subjectTitle: "CS Thesis Writing 2", units: 3.0 },
        { subjectCode: "DCIT 65", subjectTitle: "Social and Professional Issues", units: 3.0 },
      ],
      SECOND: [
        { subjectCode: "COSC 198", subjectTitle: "Practicum / Internship", units: 6.0 },
      ],
      MIDYEAR: [],
    },
  },
  BSCPE: {
    1: {
      FIRST: [
        { subjectCode: "CPEN 21", subjectTitle: "Computer Engineering as a Discipline", units: 1.0 },
        { subjectCode: "CPEN 50", subjectTitle: "Programming Logic and Design", units: 2.0 },
        { subjectCode: "MATH 1", subjectTitle: "Calculus 1 (Differential Calculus)", units: 3.0 },
        { subjectCode: "CHEM 1", subjectTitle: "Chemistry for Engineers", units: 4.0 },
        ...GENERAL_YEAR1_FIRST,
      ],
      SECOND: [
        { subjectCode: "CPEN 55", subjectTitle: "Object-Oriented Programming", units: 2.0 },
        { subjectCode: "MATH 2", subjectTitle: "Calculus 2 (Integral Calculus)", units: 3.0 },
        { subjectCode: "PHYS 1", subjectTitle: "Physics for Engineers", units: 4.0 },
        ...GENERAL_YEAR1_SECOND,
      ],
      MIDYEAR: [],
    },
    2: {
      FIRST: [
        { subjectCode: "CPEN 60", subjectTitle: "Data Structures and Algorithms", units: 2.0 },
        { subjectCode: "CPEN 65", subjectTitle: "Fundamentals of Electrical Circuits", units: 4.0 },
        { subjectCode: "MATH 3", subjectTitle: "Differential Equations", units: 3.0 },
        { subjectCode: "CPEN 70", subjectTitle: "Discrete Mathematics", units: 3.0 },
      ],
      SECOND: [
        { subjectCode: "CPEN 75", subjectTitle: "Fundamentals of Electronic Circuits", units: 4.0 },
        { subjectCode: "CPEN 80", subjectTitle: "Software Design", units: 4.0 },
        { subjectCode: "CPEN 85", subjectTitle: "Numerical Methods", units: 3.0 },
      ],
      MIDYEAR: [],
    },
    3: {
      FIRST: [
        { subjectCode: "CPEN 90", subjectTitle: "Logic Circuits and Design", units: 4.0 },
        { subjectCode: "CPEN 95", subjectTitle: "Operating Systems", units: 3.0 },
        { subjectCode: "CPEN 100", subjectTitle: "Data and Digital Communications", units: 3.0 },
        { subjectCode: "CPEN 105", subjectTitle: "Computer Engineering Drafting and Design", units: 1.0 },
      ],
      SECOND: [
        { subjectCode: "CPEN 110", subjectTitle: "Microprocessors", units: 4.0 },
        { subjectCode: "CPEN 115", subjectTitle: "Computer Networks and Security", units: 4.0 },
        { subjectCode: "CPEN 199", subjectTitle: "CpE Practice and Design 1", units: 1.0 },
      ],
      MIDYEAR: [],
    },
    4: {
      FIRST: [
        { subjectCode: "CPEN 120", subjectTitle: "Embedded Systems", units: 4.0 },
        { subjectCode: "CPEN 125", subjectTitle: "Computer Architecture and Organization", units: 4.0 },
        { subjectCode: "CPEN 200", subjectTitle: "CpE Practice and Design 2", units: 2.0 },
      ],
      SECOND: [
        { subjectCode: "CPEN 198", subjectTitle: "On-the-Job Training (CpE Internship)", units: 4.0 },
      ],
      MIDYEAR: [],
    },
  },
};

export function getDefaultCurriculumSubjects(
  programCode: string,
  yearLevel: number,
  semester: "FIRST" | "SECOND" | "MIDYEAR"
): CurriculumSubject[] {
  const normalizedCode = programCode.trim().toUpperCase();
  const programCurriculum = CEIT_CURRICULUM[normalizedCode] ?? CEIT_CURRICULUM.BSIT;
  const yearCurriculum = programCurriculum?.[yearLevel] ?? programCurriculum?.[1];
  const subjects = yearCurriculum?.[semester];
  if (subjects && subjects.length > 0) {
    return subjects;
  }
  return CEIT_CURRICULUM.BSIT[1].FIRST;
}

export const ALL_PRESET_SUBJECTS: CurriculumSubject[] = Array.from(
  new Map(
    Object.values(CEIT_CURRICULUM)
      .flatMap((byYear) => Object.values(byYear))
      .flatMap((bySem) => Object.values(bySem))
      .flat()
      .map((s) => [s.subjectCode, s])
  ).values()
).sort((a, b) => a.subjectCode.localeCompare(b.subjectCode));
