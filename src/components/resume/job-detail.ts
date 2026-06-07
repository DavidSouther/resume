import {
	div,
	em,
	h5,
	li,
	section,
	small,
	ul,
} from "@davidsouther/jiffies/dom/html.ts";
import type * as ResumeTypes from "../../lib/resume";
import { show } from "../../lib/util.ts";
import { kids } from "../children.ts";
import { A, MD } from "../p.ts";
import { Organization } from "./organization.ts";

// A job: its organization heading and one section per role held there.
// Print-hidden when the most recent role ended before the show-since cutoff.
export function JobDetail(job: ResumeTypes.JobExperience): HTMLElement {
	const hide = show(job.roles.at(-1)?.finishDate) ? "" : "no-print";
	return section(
		{ class: `job ${hide}` },
		Organization(job.organization),
		...job.roles.map(Role),
	);
}

function Role(role: ResumeTypes.Role): HTMLElement {
	return section(
		{ class: "role" },
		h5(em({ class: "name no-print-href" }, MD(role.name))),
		h5(
			{ class: "about" },
			small({ class: "start date" }, role.startDate),
			small({ class: "finish date" }, role.finishDate ?? "Current"),
		),
		...kids(
			role.challenges
				? div(
						{ class: "details" },
						...role.challenges.map(({ description }) => MD(description)),
					)
				: null,
		),
		div({ class: "competences" }, Competences(role.competences)),
	);
}

function Competences(competences: ResumeTypes.Competence[] = []): HTMLElement {
	return ul(
		...competences.map(({ name }) =>
			li(
				A(
					COMPETENCES_MAP.get(name.toLowerCase()),
					COMPETENCES_LCL.get(name.toLowerCase()) ?? `${name}`,
				),
			),
		),
	);
}

export const COMPETENCES_LCL = new Map([
	["agentic-ai", "Agentic AI"],
	["amazon-web-services", "Amazon Web Services (AWS)"],
	["angular", "Angular"],
	["angularjs", "AngularJS"],
	["aws", "Amazon Web Services (AWS)"],
	["bedrock", "Amazon Bedrock"],
	["curriculum development", "Curriculum Development"],
	["front end", "Front End"],
	["html & css", "HTML & CSS"],
	["instructing", "Instructor"],
	["interview training", "Technical Interview Training"],
	["javascript", "JavaScript"],
	["k8s", "Kubernetes"],
	["kubernetes", "Kubernetes"],
	["llm", "Large Language Models"],
	["mit-scratch", "MIT Scratch"],
	["mcp", "Model Context Protocol"],
	["node", "NodeJS"],
	["nodejs", "NodeJS"],
	["python", "Python"],
	["react", "React"],
	["rust", "Rust"],
	["technical writing", "Technical Writing"],
	["typescript", "TypeScript"],
]);

export const COMPETENCES_MAP = new Map([
	["amazon-web-services", "https://aws.amazon.com"],
	["angular", "https://angular.io/"],
	["angularjs", "https://angularjs.org"],
	["bedrock", "https://aws.amazon.com/bedrock/"],
	["dart", "http://dart.dev"],
	["golang", "https://go.dev"],
	["google-cloud-platform", "https://cloud.google.com/"],
	["google-compute-engine", "https://cloud.google.com/compute"],
	["graphql", "https://graphql.org/"],
	["istio", "https://istio.io"],
	["kompose", "https://kompose.io/"],
	["kubernetes", "https://kubernetes.io"],
	["mcp", "https://modelcontextprotocol.io/"],
	["mit-scratch", "https://scratch.mit.edu"],
	["node.js", "https://nodejs.org"],
	["nodejs", "https://nodejs.org"],
	["python", "https://www.python.org"],
	["react", "https://react.dev/"],
	["redis", "redis.io"],
	["rust", "https://rust-lang.org"],
	["socket.io", "https://socket.io"],
	["typescript", "https://www.typescriptlang.org/"],
]);
