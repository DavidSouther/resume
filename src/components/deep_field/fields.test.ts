import { describe, expect, it } from "vitest";
import type { Field } from "./catalog.ts";
import { fieldSrc, pickField } from "./fields.ts";

const f = (id: string, source: string) =>
	({ id, source, url: `cdn/${id}` }) as Field;
const fields = [f("a", "ESA/Webb"), f("b", "ESA/Hubble"), f("c", "ESA/Webb")];

describe("pickField", () => {
	it("chooses only fields of the requested source", () => {
		expect(pickField(fields, "hubble").id).toBe("b");
		expect(pickField(fields, "webb", () => 0).id).toBe("a");
		expect(pickField(fields, "webb", () => 0.99).id).toBe("c");
	});

	it("throws when the source has no field", () => {
		expect(() => pickField([f("a", "ESA/Webb")], "hubble")).toThrow(/Hubble/);
	});
});

it("serves bundled fields locally and others from the CDN", () => {
	expect(fieldSrc(f("potm2507a", "ESA/Webb"))).toBe(
		"/deep_field/potm2507a.jpg",
	);
	expect(fieldSrc(f("a", "ESA/Webb"))).toBe("cdn/a");
});
