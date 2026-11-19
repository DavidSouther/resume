import { describe, expect, it } from "vitest";
import { NS } from "./data.ts";
import { direct, frames, ladder, paths, scheduler, sweep } from "./figures.ts";

describe("ctxswitch figures", () => {
	it("renders every figure as a labelled svg", () => {
		for (const f of [
			ladder,
			() => ladder("user"),
			direct,
			sweep,
			paths,
			scheduler,
			frames,
		]) {
			const html = f();
			expect(html).toMatch(/^<svg [^>]*role="img" aria-label="[^"]+"/);
			expect(html).not.toContain("NaN");
		}
	});

	it("matches the figures quoted in PRESENTATION.md", () => {
		expect(NS.c7a.green[2]).toBeCloseTo(2349.6);
		expect(NS.c7g.green[2]).toBeCloseTo(4941.8);
		expect(NS.c7a.thread[2]).toBeCloseTo(7565.2);
		expect(NS.c7g.thread[2]).toBeCloseTo(7922.2);
		expect(NS.c7i.process[0] / 3150).toBeCloseTo(0.57, 2);
	});
});
