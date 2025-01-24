import { ResumeData } from "./resume";
import fs from "node:fs/promises";

export interface ResumeLoader {
  (): Promise<ResumeData>;
}

export async function jsonLoader(): Promise<ResumeData> {
  try {
    const resumeData = await fs.readFile("src/app/resume.json", {
      encoding: "utf-8",
    });
    const resume = JSON.parse(resumeData);
    return resume as unknown as ResumeData;
  } catch (e) {
    return {
      aboutMe: { profile: { name: "David Souther" } },
      experience: { jobs: [], projects: [], publicArtifacts: [] },
      knowledge: {},
      settings: { language: "en-US", lastUpdate: "2025-01-24" },
    };
  }
}

export async function tomlLoader(): Promise<ResumeData> {
  const { default: TOML } = await import("smol-toml");
  const resumeData = await fs.readFile("src/app/resume.toml", {
    encoding: "utf-8",
  });
  const resume = TOML.parse(resumeData);
  return resume as unknown as ResumeData;
}
