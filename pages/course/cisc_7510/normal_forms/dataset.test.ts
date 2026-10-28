import { describe, expect, it } from "vitest";
import type { Stage, Table } from "./dataset.ts";
import { parseCsv } from "./dataset.ts";
import { loadStages } from "./staffing.ts";

const stages = loadStages();
const byId = (id: string): Stage => {
	const s = stages.find((x) => x.id === id);
	if (!s) throw new Error(id);
	return s;
};
const table = (s: Stage, name: string): Table => {
	const t = s.tables.find((x) => x.name === name);
	if (!t) throw new Error(name);
	return t;
};
const values = (t: Table, cols: string[]) =>
	t.rows.map((r) => cols.map((c) => r[t.columns.indexOf(c)].value));

describe("dataset stages", () => {
	it("orders the six stages", () => {
		expect(stages.map((s) => s.id)).toEqual([
			"raw",
			"1nf",
			"2nf",
			"3nf",
			"coda",
			"post",
		]);
	});

	it("starts with list cells and nulls", () => {
		const raw = table(byId("raw"), "Staffing");
		expect(values(raw, ["projects"])[0][0]).toBe(
			"P1 Apollo (12h), P2 Zephyr (8h)",
		);
		expect(raw.rows.flat().some((c) => c.value === null)).toBe(true);
	});

	it("1NF has no list cells and inflates through the cross product", () => {
		const t = table(byId("1nf"), "Staffing");
		expect(
			t.rows
				.flat()
				.some((c) => typeof c.value === "string" && c.value.includes(", ")),
		).toBe(false);
		// Ana: 2 projects x 2 skills x 2 languages
		expect(values(t, ["emp_id"]).filter(([id]) => id === 1)).toHaveLength(8);
		expect(t.rows).toHaveLength(13);
	});

	it("every cell id is unique across a stage", () => {
		for (const s of stages) {
			const ids = s.tables.flatMap((t) => t.rows.flat().map((c) => c.id));
			expect(new Set(ids).size).toBe(ids.length);
		}
	});

	it("keys are unique within each table", () => {
		for (const s of stages)
			for (const t of s.tables) {
				const idx = t.key.map((k) => t.columns.indexOf(k));
				const sigs = t.rows.map((r) =>
					JSON.stringify(idx.map((i) => r[i].value)),
				);
				expect(new Set(sigs).size, `${s.id}/${t.name}`).toBe(sigs.length);
			}
	});

	it("2NF collapses duplicate employee, project and assignment facts", () => {
		const s = byId("2nf");
		expect(table(s, "EmployeeDetails").rows).toHaveLength(5);
		expect(table(s, "Projects").rows).toHaveLength(2);
		expect(table(s, "Assignments").rows).toHaveLength(5);
		expect(
			values(table(s, "Projects"), ["project_id", "project_name"]),
		).toEqual([
			["P1", "Apollo"],
			["P2", "Zephyr"],
		]);
	});

	it("3NF stores each department once", () => {
		const s = byId("3nf");
		expect(
			values(table(s, "Departments"), ["dept_id", "dept_name", "office"]),
		).toEqual([
			["D1", "Engineering", "Brooklyn"],
			["D2", "Operations", "Queens"],
		]);
		expect(table(s, "Employees").columns).toEqual([
			"emp_id",
			"emp_name",
			"dept_id",
		]);
	});

	it("coda stores skills and languages independently", () => {
		const s = byId("coda");
		expect(table(s, "EmployeeSkills").rows).toHaveLength(6);
		expect(table(s, "EmployeeLanguages").rows).toHaveLength(7);
	});

	it("is lossless: joining the coda tables rebuilds the 1NF facts", () => {
		const coda = byId("coda");
		const get = (n: string) => table(coda, n);
		const emp = values(get("Employees"), ["emp_id", "emp_name", "dept_id"]);
		const dept = new Map(
			values(get("Departments"), ["dept_id", "dept_name", "office"]).map(
				([id, ...r]) => [id, r],
			),
		);
		const proj = new Map(
			values(get("Projects"), ["project_id", "project_name"]).map(([id, n]) => [
				id,
				n,
			]),
		);
		const asg = values(get("Assignments"), ["emp_id", "project_id", "hours"]);
		const sk = values(get("EmployeeSkills"), ["emp_id", "skill"]);
		const lg = values(get("EmployeeLanguages"), ["emp_id", "language"]);
		const rebuilt: string[] = [];
		for (const [id, name, d] of emp) {
			const [dn, off] = (d !== null && dept.get(d)) || [null, null];
			const as = asg.filter(([e]) => e === id);
			for (const [, p, h] of as.length ? as : [[id, null, null]])
				for (const [, s] of sk.filter(([e]) => e === id))
					for (const [, l] of lg.filter(([e]) => e === id))
						rebuilt.push(
							JSON.stringify([
								id,
								name,
								d,
								dn,
								off,
								p,
								p && proj.get(p as string),
								h,
								s,
								l,
							]),
						);
		}
		const original = values(table(byId("1nf"), "Staffing"), [
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
		]).map((r) => JSON.stringify(r.map((v) => v ?? null)));
		expect(
			rebuilt
				.map((r) =>
					JSON.stringify(JSON.parse(r).map((v: unknown) => v ?? null)),
				)
				.sort(),
		).toEqual(original.sort());
	});

	it("post BCNF folds skills and languages into a JSON column on Employees", () => {
		const s = byId("post");
		expect(s.tables.map((t) => t.name)).toEqual([
			"Employees",
			"Departments",
			"Projects",
			"Assignments",
		]);
		const emp = table(s, "Employees");
		expect(emp.columns.at(-1)).toBe("employee_details");
		const ana = values(emp, ["emp_id", "employee_details"])[0];
		expect(JSON.parse(ana[1] as string)).toEqual({
			skills: ["SQL", "Rust"],
			languages: ["English", "Spanish"],
		});
	});
});

describe("parseCsv", () => {
	it("reads quoted commas, nulls, and numbers", () => {
		const { columns, rows } = parseCsv('id,list,note\n1,"a, b",\n2,c,"x"\n');
		expect(columns).toEqual(["id", "list", "note"]);
		expect(rows).toEqual([
			[1, "a, b", null],
			[2, "c", "x"],
		]);
	});

	it("rejects a row with the wrong number of fields", () => {
		expect(() => parseCsv("a,b\n1\n")).toThrow(/row 1 has 1 fields/);
	});

	it("rejects an empty file", () => {
		expect(() => parseCsv("")).toThrow(/empty/);
	});
});
