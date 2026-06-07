import fs from "node:fs/promises";
import type { ResumeData } from "./resume";

export type ResumeLoader = () => Promise<ResumeData>;

export async function tomlLoader(): Promise<ResumeData> {
	const { default: TOML } = await import("smol-toml");
	const resumeData = await fs.readFile("src/resume.toml", {
		encoding: "utf-8",
	});
	const resume = TOML.parse(resumeData);
	return resume as unknown as ResumeData;
}
