export interface ResumeData {
  settings: Settings;
  aboutMe: AboutMe;
  experience: {
    jobs: JobExperience[];
    projects: ProjectExperience[];
    publicArtifacts: PublicArtifact[];
  };
  knowledge: {
    languages?: { name: string; level?: LanguageCompetence }[];
    hardSkills?: Skill[];
    softSkills?: Skill[];
    studies?: Study[];
  };
}

export interface Settings {
  language: string;
  lastUpdate: string;
  MACVersion?: string;
}

export interface JobExperience {
  organization: PublicEntityDetails;
  type?: OrganizationType;
  roles: Role[];
  full?: boolean;
}

export interface ProjectExperience {
  details?: PublicEntityDetails;
  type?: ProjectType;
  roles: Role[];
  full?: boolean;
}

export interface PublicArtifact {
  details: PublicEntityDetails;
  type?: PublicArtifactType;
  publishingDate?: string;
  relatedCompetences?: Competence[];
  tags?: Tags;
  hide?: boolean;
  full?: boolean;
}

export interface AboutMe {
  profile: Person;
  relevantYearsOfExperience?: number;
  relevantLinks?: Link[];
  significativeRelationships?: Person[];
  interestingFacts?: { topic?: string; fact: string }[];
  currentSalary?: {
    currency: string;
    amount: number;
    relevantPerks?: { type: string }[];
  };
  recommendations?: {
    title: string;
    type?: RecommendationType;
    URL?: string;
    authors?: Person[];
    summary?: string;
  };
}

export interface Person {
  name: string;
  surnames?: string;
  title?: string;
  description?: string;
  birthday?: string;
  avatar?: Image;
  contact?: ContactMeans;
  location?: Location;
}

export interface RecommendationType {}

export interface PublicEntityDetails {
  name: string;
  description?: string;
  URL?: string;
  image?: Image;
  location?: Location;
}

export interface Role {
  name: string;
  startDate: string;
  finishDate?: string;
  challenges?: { description: string; actions?: string[] }[];
  competences?: Competence[];
  referrals?: Person[];
  notes?: string;
  full?: boolean;
}

export type OrganizationType =
  | "freelance"
  | "publicAdministration"
  | "NGO"
  | "startup"
  | "SME"
  | "bigCorp"
  | "academicalInstitution"
  | "other";

export type ProjectType =
  | "proBono"
  | "openSource"
  | "sideProject"
  | "personalAchievement"
  | "other";

export type PublicArtifactType =
  | "post"
  | "talk"
  | "sideProject"
  | "achievement"
  | "launch"
  | "video";

export interface Competence {
  name: string;
  type: "tool" | "technology" | "practice" | "hardware" | "domain";
  description?: string;
  URL?: string;
}

export interface Tags {}

export type LanguageCompetence =
  | "Elementary proficiency"
  | "Limited working proficiency"
  | "Professional working proficiency"
  | "Full professional proficiency"
  | "Native or bilingual proficiency";

export type CompetenceLevel = "basic" | "intermediate" | "high" | "expert";

export interface Skill {
  skill?: Competence;
  level?: CompetenceLevel;
}

export interface Study {
  studyType: StudyType;
  degreeAchieved: boolean;
  name: string;
  startDate: string;
  finishDate?: string;
  description?: string;
  institution?: PublicEntityDetails;
  linkedCompetences?: Competence[];
  full?: boolean;
}

export type StudyType =
  | "officialDegree"
  | "certification"
  | "unaccredited"
  | "selfTraining";

export interface Location {
  country?: string;
  region?: string;
  municipality?: string;
  postalCode?: string;
  address?: string;
  notes?: string;
}

export interface Link {
  type: String;
  URL: string;
  description?: string;
}

export interface PublicProfile extends Link {}

export interface PhoneNumber {
  countryCode: number;
  number: string;
}

export interface ContactMeans {
  contactMails?: string[];
  publicProfiles?: PublicProfile[];
  phoneNumbers?: PhoneNumber[];
}

export interface ImageLink {
  link: string;
}

export interface ImageData {
  data: string;
  mediaType: "image/png" | "image/jpeg";
  encoding: "base64";
}

export type Image = ImageLink | ImageData;

export interface Contact {
  phoneNumbers?: Array<{ countryCode: number; number: string }>;
  contactMails?: string[];
  publicProfiles?: Link[];
}
