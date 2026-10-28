// Server-side access to staffing.csv. The browser bundle must not import this
// (it reads the disk); it receives the same text embedded by page.ts.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildStages, type Stage } from "./dataset.ts";

export function loadStaffingCsv(): string {
	return readFileSync(join(import.meta.dirname, "staffing.csv"), "utf-8");
}

export function loadStages(): Stage[] {
	return buildStages(loadStaffingCsv());
}
