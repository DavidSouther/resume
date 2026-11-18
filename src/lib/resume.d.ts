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
	cv?: CvData;
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
	/** CV placement, an extension to the MAC schema; the resume ignores it. */
	cvSection?: CvSection;
}

/** Which CV section a job prints under; a job without the key is professional. */
export type CvSection = "teaching" | "professional";

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
	/** On a project: print it under Curriculum Development instead of Software. */
	cvSection?: "curriculum";
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

export type Tags = string[];

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
	type: string;
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

/**
 * CV-only material, an extension to the MAC schema: everything the `/cv` view
 * needs that the resume's own entries do not already say.
 */
export interface CvData {
	footer?: string;
	interests?: { title: string; body: string }[];
	competencies?: { label: string; items: string }[];
	publications?: CvPublicationGroup[];
	/** Post ids of lectures, listed under Invited Talks after the excerpts. */
	talks?: string[];
}

/** One publication group: artifacts carrying a tag, or an ordered list of post ids. */
export type CvPublicationGroup =
	| { heading: string; tag: string; posts?: never }
	| { heading: string; posts: string[]; tag?: never };
