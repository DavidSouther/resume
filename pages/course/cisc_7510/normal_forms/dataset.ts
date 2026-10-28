// The sample data that travels through every normal form. Stage 0 is read from
// staffing.csv (passed in as text, so this module also runs in the browser); every later stage is derived from the one before it, and each
// derived cell remembers which earlier cells it came from. The planner (plan.ts)
// reads that provenance to decide what moves, what merges, and what disappears.

import { csvParseRows } from "d3-dsv";

export type Value = string | number | null;

export interface Cell {
	/** Unique per page (it becomes DOM data-cell-id) and names cells in the immediately previous stage via `from`. */
	id: string;
	value: Value;
	/** Ids of the previous stage's cells this one was derived from. */
	from: string[];
}

export interface Table {
	name: string;
	columns: string[];
	key: string[];
	rows: Cell[][];
}

export type StageId = "raw" | "1nf" | "2nf" | "3nf" | "coda" | "post";

export interface Violation {
	table: string;
	column: string;
}

export interface Stage {
	id: StageId;
	form: string;
	/** Columns of the previous stage that break this form's rule. */
	violates: Violation[];
	tables: Table[];
}

/**
 * Parses staffing.csv text into the raw table's header and rows. An empty field
 * is NULL and an all-digit field is a number; everything else stays text. A
 * field with commas must be quoted, as the list columns are.
 */
export function parseCsv(csv: string): { columns: string[]; rows: Value[][] } {
	const [columns, ...rows] = csvParseRows(csv.trim());
	if (!columns) throw new Error("staffing.csv is empty.");
	return {
		columns,
		rows: rows.map((fields, r) => {
			if (fields.length !== columns.length)
				throw new Error(
					`staffing.csv row ${r + 1} has ${fields.length} fields; expected ${columns.length}.`,
				);
			return fields.map((f) =>
				f === "" ? null : /^-?\d+$/.test(f) ? Number(f) : f,
			);
		}),
	};
}

function cell(id: string, value: Value, from: string[] = []): Cell {
	return { id, value, from };
}

export function buildRaw(csv: string): Stage {
	const { columns, rows: values } = parseCsv(csv);
	const rows = values.map((values, r) =>
		values.map((v, c) => cell(`raw:Staffing:${r}:${c}`, v)),
	);
	return {
		id: "raw",
		form: "Unnormalized",
		violates: [],
		tables: [{ name: "Staffing", columns, key: ["emp_id"], rows }],
	};
}

const col = (t: Table, name: string): number => {
	const i = t.columns.indexOf(name);
	if (i < 0) throw new Error(`no column ${name} in ${t.name}`);
	return i;
};

/**
 * Distinct projection of `source` onto `columns`. Rows that agree on `key`
 * collapse into one; the surviving cell lists every collapsed cell as a source.
 * Rows where a `requireNonNull` column is null are dropped (their cells are
 * left unreferenced, which the planner reads as "fades out").
 * Assumes `key` functionally determines the projected columns; the surviving
 * value comes from the first row of each group and later rows' cells merge
 * into it.
 */
export function project(
	stage: StageId,
	source: Table,
	name: string,
	columns: string[],
	key: string[],
	requireNonNull: string[] = [],
): Table {
	const keyIdx = key.map((k) => col(source, k));
	const needIdx = requireNonNull.map((k) => col(source, k));
	const groups = new Map<string, Cell[][]>();
	for (const row of source.rows) {
		if (needIdx.some((i) => row[i].value === null)) continue;
		const sig = JSON.stringify(keyIdx.map((i) => row[i].value));
		const g = groups.get(sig);
		if (g) g.push(row);
		else groups.set(sig, [row]);
	}
	const rows = [...groups.values()].map((group, r) =>
		columns.map((c, ci) => {
			const idx = col(source, c);
			return cell(
				`${stage}:${name}:${r}:${ci}`,
				group[0][idx].value,
				group.map((row) => row[idx].id),
			);
		}),
	);
	return { name, columns, key, rows };
}

/** A table that passes through a stage unchanged. */
export function carry(stage: StageId, source: Table): Table {
	return {
		...source,
		rows: source.rows.map((row, r) =>
			row.map((c, ci) =>
				cell(`${stage}:${source.name}:${r}:${ci}`, c.value, [c.id]),
			),
		),
	};
}

/** Raw columns the 1NF builder reads by name. */
const RAW_COLUMNS = [
	"emp_id",
	"emp_name",
	"dept_id",
	"dept_name",
	"office",
	"projects",
	"skills",
	"languages",
];

const parseList = (v: Value): string[] =>
	v === null ? [] : String(v).split(/,\s*/);

const PROJECT = /^(P\d+)\s+(.+?)\s+\((\d+)h\)$/;

export function buildFirstNormalForm(raw: Stage): Stage {
	const t = raw.tables[0];
	const [cId, cName, cDept, cDeptName, cOffice, cProj, cSkills, cLangs] =
		RAW_COLUMNS.map((c) => col(t, c));
	const columns = [
		"emp_id",
		"emp_name",
		"dept_id",
		"dept_name",
		"office",
		"project_id",
		"project_name",
		"hours",
		"skill",
		"language",
	];
	// The cross product of projects, skills and languages is deliberate:
	// independent lists feed the 4NF split. A [null] project keeps Eli's row.
	const rows: Cell[][] = [];
	for (const row of t.rows) {
		const projects = parseList(row[cProj].value).map((p) => {
			const m = PROJECT.exec(p);
			if (!m) throw new Error(`bad project ${p}`);
			return { id: m[1], name: m[2], hours: Number(m[3]) };
		});
		const projectRows = projects.length ? projects : [null];
		const skills = parseList(row[cSkills].value);
		const langs = parseList(row[cLangs].value);
		for (const p of projectRows)
			for (const s of skills)
				for (const l of langs) {
					const r = rows.length;
					const id = (i: number) => `1nf:Staffing:${r}:${i}`;
					rows.push([
						cell(id(0), row[cId].value, [row[cId].id]),
						cell(id(1), row[cName].value, [row[cName].id]),
						cell(id(2), row[cDept].value, [row[cDept].id]),
						cell(id(3), row[cDeptName].value, [row[cDeptName].id]),
						cell(id(4), row[cOffice].value, [row[cOffice].id]),
						cell(id(5), p?.id ?? null, [row[cProj].id]),
						cell(id(6), p?.name ?? null, [row[cProj].id]),
						cell(id(7), p?.hours ?? null, [row[cProj].id]),
						cell(id(8), s, [row[cSkills].id]),
						cell(id(9), l, [row[cLangs].id]),
					]);
				}
	}
	return {
		id: "1nf",
		form: "1NF",
		violates: ["projects", "skills", "languages"].map((column) => ({
			table: "Staffing",
			column,
		})),
		tables: [
			{
				name: "Staffing",
				columns,
				// The key marks the underlined columns. project_id is NULL on Eli's row,
				// so this is a display key, not a declarable primary key.
				key: ["emp_id", "project_id", "skill", "language"],
				rows,
			},
		],
	};
}

export function buildSecondNormalForm(prev: Stage): Stage {
	const s = prev.tables[0];
	return {
		id: "2nf",
		form: "2NF",
		violates: [
			"emp_name",
			"dept_id",
			"dept_name",
			"office",
			"project_name",
			"hours",
		].map((column) => ({ table: "Staffing", column })),
		tables: [
			project(
				"2nf",
				s,
				"EmployeeDetails",
				["emp_id", "emp_name", "dept_id", "dept_name", "office"],
				["emp_id"],
			),
			project(
				"2nf",
				s,
				"Projects",
				["project_id", "project_name"],
				["project_id"],
				["project_id"],
			),
			project(
				"2nf",
				s,
				"Assignments",
				["emp_id", "project_id", "hours"],
				["emp_id", "project_id"],
				["project_id"],
			),
			project(
				"2nf",
				s,
				"EmployeeSkillLanguage",
				["emp_id", "skill", "language"],
				["emp_id", "skill", "language"],
			),
		],
	};
}

export function buildThirdNormalForm(prev: Stage): Stage {
	const [details, ...rest] = prev.tables;
	return {
		id: "3nf",
		form: "3NF",
		violates: ["dept_name", "office"].map((column) => ({
			table: "EmployeeDetails",
			column,
		})),
		tables: [
			project(
				"3nf",
				details,
				"Employees",
				["emp_id", "emp_name", "dept_id"],
				["emp_id"],
			),
			project(
				"3nf",
				details,
				"Departments",
				["dept_id", "dept_name", "office"],
				["dept_id"],
				["dept_id"],
			),
			...rest.map((t) => carry("3nf", t)),
		],
	};
}

export function buildCoda(prev: Stage): Stage {
	const skillLang = prev.tables.find((t) => t.name === "EmployeeSkillLanguage");
	if (!skillLang) throw new Error("missing EmployeeSkillLanguage");
	const others = prev.tables.filter((t) => t !== skillLang);
	return {
		id: "coda",
		form: "BCNF / 4NF",
		violates: ["skill", "language"].map((column) => ({
			table: "EmployeeSkillLanguage",
			column,
		})),
		tables: [
			...others.map((t) => carry("coda", t)),
			project(
				"coda",
				skillLang,
				"EmployeeSkills",
				["emp_id", "skill"],
				["emp_id", "skill"],
			),
			project(
				"coda",
				skillLang,
				"EmployeeLanguages",
				["emp_id", "language"],
				["emp_id", "language"],
			),
		],
	};
}

export function buildPostBcnf(prev: Stage): Stage {
	const find = (name: string): Table => {
		const t = prev.tables.find((x) => x.name === name);
		if (!t) throw new Error(`missing ${name}`);
		return t;
	};
	const employees = find("Employees");
	const skills = find("EmployeeSkills");
	const languages = find("EmployeeLanguages");
	const others = prev.tables.filter(
		(t) => t !== employees && t !== skills && t !== languages,
	);
	const idCol = col(employees, "emp_id");
	const rowsFor = (t: Table, id: Value): Cell[][] =>
		t.rows.filter((r) => r[col(t, "emp_id")].value === id);
	const listOf = (t: Table, id: Value, column: string): Cell[] =>
		rowsFor(t, id).map((r) => r[col(t, column)]);
	const detailsCol = "employee_details";
	const rows = employees.rows.map((row, r) => {
		const id = row[idCol].value;
		const skillCells = listOf(skills, id, "skill");
		const langCells = listOf(languages, id, "language");
		const details = JSON.stringify({
			skills: skillCells.map((c) => c.value),
			languages: langCells.map((c) => c.value),
		});
		return [
			...row.map((c, ci) => cell(`post:Employees:${r}:${ci}`, c.value, [c.id])),
			cell(`post:Employees:${r}:${row.length}`, details, [
				...skillCells.map((c) => c.id),
				...langCells.map((c) => c.id),
			]),
		];
	});
	return {
		id: "post",
		form: "Post BCNF",
		violates: [
			{ table: "EmployeeSkills", column: "skill" },
			{ table: "EmployeeLanguages", column: "language" },
		],
		tables: [
			{
				...employees,
				columns: [...employees.columns, detailsCol],
				rows,
			},
			...others.map((t) => carry("post", t)),
		],
	};
}

export function buildStages(csv: string): Stage[] {
	const raw = buildRaw(csv);
	const nf1 = buildFirstNormalForm(raw);
	const nf2 = buildSecondNormalForm(nf1);
	const nf3 = buildThirdNormalForm(nf2);
	const coda = buildCoda(nf3);
	return [raw, nf1, nf2, nf3, coda, buildPostBcnf(coda)];
}
