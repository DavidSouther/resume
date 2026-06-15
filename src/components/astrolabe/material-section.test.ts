// @vitest-environment jsdom
//
// Unit test for the F1 contributed material ControlsSection — the worked example
// of a comprehensive, well-organized #debug panel. It contributes case-finish and
// strap-finish controls that retint the watch live by writing MATERIAL_TOKENS via
// element.style.setProperty on document.documentElement.
//
// The assertions are on observable behavior: the section's contract (id /
// debugOnly), the presence of a case control and a strap control, and that
// driving a control writes the CORRECT token (a copy-paste token mix-up between
// --case-platinum and --strap-cordovan would fail). We never assert which method
// was called — only the resulting documentElement.style.
import { afterEach, describe, expect, it } from "vitest";
import { MATERIAL_TOKENS } from "../../lib/astro-tokens.ts";
import { mount, resetDom } from "../test-dom.ts";
import { materialSection } from "./material-section.ts";

afterEach(() => {
	resetDom();
	// The section writes onto the shared documentElement; clear the tokens it can
	// set so one test never leaks a value into the next.
	for (const token of Object.values(MATERIAL_TOKENS)) {
		document.documentElement.style.removeProperty(token);
	}
});

/** Set a form control's value and fire the `input` event the section listens for. */
function drive(control: HTMLInputElement, value: string): void {
	control.value = value;
	control.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("materialSection", () => {
	it("is a debugOnly section identified as 'material'", () => {
		expect(materialSection.id).toBe("material");
		expect(materialSection.debugOnly).toBe(true);
		expect(typeof materialSection.title).toBe("string");
		expect(materialSection.title.length).toBeGreaterThan(0);
	});

	it("exposes a control for the case finish and a control for the strap finish", () => {
		const body = mount(materialSection.render());

		// The panel is organized so each material token is addressable by a
		// data-token hook carrying its CSS custom-property name.
		const caseControl = body.querySelector(
			`[data-token="${MATERIAL_TOKENS.casePlatinum}"]`,
		);
		const strapControl = body.querySelector(
			`[data-token="${MATERIAL_TOKENS.strapCordovan}"]`,
		);
		expect(caseControl).not.toBeNull();
		expect(strapControl).not.toBeNull();
	});

	it("writes --case-platinum when the case-finish control changes", () => {
		const body = mount(materialSection.render());
		const caseControl = body.querySelector<HTMLInputElement>(
			`[data-token="${MATERIAL_TOKENS.casePlatinum}"]`,
		);
		expect(caseControl).not.toBeNull();

		drive(caseControl as HTMLInputElement, "#abcdef");

		expect(
			document.documentElement.style.getPropertyValue(
				MATERIAL_TOKENS.casePlatinum,
			),
		).toBe("#abcdef");
	});

	it("writes --strap-cordovan — not --case-platinum — when the strap-finish control changes", () => {
		const body = mount(materialSection.render());
		const strapControl = body.querySelector<HTMLInputElement>(
			`[data-token="${MATERIAL_TOKENS.strapCordovan}"]`,
		);
		expect(strapControl).not.toBeNull();

		drive(strapControl as HTMLInputElement, "#123456");

		expect(
			document.documentElement.style.getPropertyValue(
				MATERIAL_TOKENS.strapCordovan,
			),
		).toBe("#123456");
		// Guard the copy-paste token mix-up: driving the strap must not touch the
		// case token.
		expect(
			document.documentElement.style.getPropertyValue(
				MATERIAL_TOKENS.casePlatinum,
			),
		).toBe("");
	});

	it("renders a node ControlsSheet can mount without error", () => {
		// render() may return a Node or Node[]; mount() handles both. A throw here
		// would mean ControlsSheet could not spread the section into the sheet.
		expect(() => mount(materialSection.render())).not.toThrow();
	});
});
