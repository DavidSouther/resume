// @vitest-environment jsdom

// Unit guard (Astrolabe FCC refactor, Feature 3 — controls state core): the pure
// state layer beneath the drawer. `ControlsState` is the single source of truth;
// `toConfig` projects the simulation inputs the loop reads (data, NOT styling),
// and v2 persistence (persist/loadState/validateState) round-trips the state
// object as-is with parse-don't-validate at the storage boundary. No FCCs, no
// DOM writes — these functions are testable without the drawer. See
// .ailly/developer/2026-06-23-A-astrolabe-fcc-refactor/controls-redesign.md.
import { afterEach, describe, expect, it } from "vitest";
import { GALILEAN, KEPLERIAN } from "../../lib/astrolabe/types.ts";
import {
	type ControlsState,
	DEFAULTS,
	loadState,
	persist,
	STORAGE_KEY,
	toConfig,
	validateState,
} from "./controls-components.ts";

afterEach(() => localStorage.clear());

describe("toConfig — state → simulation inputs (data, not styling)", () => {
	it("maps every state field to its Config slot", () => {
		const cfg = toConfig(DEFAULTS);

		expect(cfg.speed).toBe(1); // speedStep 0 → real time
		expect(cfg.sizeMode).toBe("full");
		expect(cfg.earthMode).toBe(GALILEAN);
		expect(cfg.parallaxOn).toBe(false);
		expect(cfg.parallax).toBe(0.7);
		expect(cfg.occ).toBe(DEFAULTS.signInfo);
		expect(cfg.twilight).toBe(true);
		expect(cfg.guilloche).toBe(true);
		expect(cfg.guillocheN).toBe(120);
		expect(cfg.hands).toBe(true);
	});

	it("maps the earthMode string to the EarthMode enum", () => {
		expect(toConfig({ ...DEFAULTS, earthMode: "keplerian" }).earthMode).toBe(
			KEPLERIAN,
		);
	});
});

describe("validateState — parse-don't-validate, field-by-field vs DEFAULTS", () => {
	it("round-trips a fully-serialized state", () => {
		const s: ControlsState = {
			...DEFAULTS,
			earthMode: "ptolemaic",
			sizeMode: "48",
			speedStep: 2,
			material: "gold",
			parallaxOn: true,
			parallax: 1.2,
			orbits: false,
			guillocheN: 240,
			colors: { "--mars": "#123456" },
		};

		expect(validateState(JSON.parse(JSON.stringify(s)))).toEqual(s);
	});

	it("falls back to DEFAULTS for a missing key", () => {
		const { hands, ...partial } = { ...DEFAULTS };
		expect(validateState(partial).hands).toBe(DEFAULTS.hands);
	});

	it("falls back (never throws) for a wrong-typed key", () => {
		const bad = { ...DEFAULTS, orbits: "yes", parallax: "nope" };
		const out = validateState(bad);
		expect(out.orbits).toBe(DEFAULTS.orbits);
		expect(out.parallax).toBe(DEFAULTS.parallax);
	});

	it("clones DEFAULTS for a non-object", () => {
		expect(validateState(null)).toEqual(DEFAULTS);
		expect(validateState(42)).toEqual(DEFAULTS);
	});

	it("keeps only string-valued --* entries in colors", () => {
		const out = validateState({
			...DEFAULTS,
			colors: { "--mars": "#abc", "--bad": 5, junk: "x" },
		});
		expect(out.colors).toEqual({ "--mars": "#abc" });
	});
});

describe("persist / loadState — the v2 storage boundary", () => {
	it("round-trips state through localStorage under the v2 key", () => {
		const s: ControlsState = { ...DEFAULTS, material: "rosegold", moon: false };
		persist(s);
		expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
		expect(loadState()).toEqual(s);
	});

	it("returns null when nothing is stored", () => {
		expect(loadState()).toBeNull();
	});

	it("returns null for an unparseable blob", () => {
		localStorage.setItem(STORAGE_KEY, "{not json");
		expect(loadState()).toBeNull();
	});

	it("ignores a v1 blob (clean break)", () => {
		localStorage.setItem("astrolabe.controls.v1", JSON.stringify({ any: 1 }));
		expect(loadState()).toBeNull();
	});
});
