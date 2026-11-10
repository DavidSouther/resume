// Rail panel: census, selection inspector and control wiring.

import { resize } from "./camera.ts";
import { COS } from "./cosmology.ts";
import { select } from "./picking.ts";
import { update } from "./scene.ts";
import {
	$,
	CLASSES,
	CLS_NAME,
	CLS_ONE,
	type Cls,
	COLORS,
	type DepthMode,
	fmtZ,
	hooks,
	P,
	type Proj,
	S,
} from "./state.ts";

function renderCensus() {
	const n: Record<Cls, number> = { star: 0, near: 0, mid: 0, far: 0 };
	const groups = new Set<number>();
	const zr: Record<Cls, [number, number]> = {
		star: [1e9, -1],
		near: [1e9, -1],
		mid: [1e9, -1],
		far: [1e9, -1],
	};
	for (const o of S.objs) {
		if (o.cls === "near") {
			if (!o.fragment) groups.add(o.group);
		} else n[o.cls]++;
		zr[o.cls][0] = Math.min(zr[o.cls][0], o.z);
		zr[o.cls][1] = Math.max(zr[o.cls][1], o.z);
	}
	n.near = groups.size;
	const f = (c: Cls) =>
		c === "star"
			? "Milky Way"
			: zr[c][1] < 0
				? "–"
				: zr[c][0] === zr[c][1]
					? `z ${fmtZ(zr[c][0])}`
					: `z ${fmtZ(zr[c][0])}–${fmtZ(zr[c][1])}`;
	$("census").innerHTML = CLASSES.map(
		(c) =>
			`<dt><label for="show-${c}"><input type="checkbox" role="switch" id="show-${c}" ${P.show[c] ? "checked" : ""}><span class="dot" style="background:${COLORS[c]}"></span>${CLS_NAME[c]}</label></dt><dd><span class="zr">${f(c)}</span> <strong class="n">${n[c].toLocaleString()}</strong></dd>`,
	).join("");
	for (const c of CLASSES)
		$<HTMLInputElement>(`show-${c}`).onchange = (e) => {
			P.show[c] = (e.target as HTMLInputElement).checked;
			update();
		};
}

function renderSel() {
	const o = S.sel;
	$("selSec").hidden = !o;
	if (!o) return;
	const note = S.notes.find((n) => n.group === o.group);
	$("selTag").textContent = note
		? note.name
		: CLS_ONE[o.cls] + (o.fragment ? " (fragment)" : "");
	$("selTag").style.color = COLORS[o.cls];
	const rows: [string, string][] = [
		["Position", `${Math.round(o.cx)}, ${Math.round(o.cy)} px`],
		["Area", `${o.area.toLocaleString()} px`],
		["Colour, log R/B", o.color.toFixed(2)],
	];
	if (o.cls === "star")
		rows.push(
			["Spike score", o.spike.toFixed(1)],
			["Distance", "inside the Milky Way"],
		);
	else
		rows.push(
			[
				"Redshift",
				(S.over.get(o.id)?.z != null ? "set " : "est. ") + o.z.toFixed(3),
			],
			["Light-travel time", `${COS.lb(o.z).toFixed(2)} Gyr`],
			["Comoving distance", `${COS.dc(o.z).toFixed(2)} Gly`],
		);
	if (o.det !== o.cls) rows.push(["Detected as", CLS_ONE[o.det]]);
	$("selDl").innerHTML = rows
		.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
		.join("");
	$<HTMLSelectElement>("selCls").value = o.cls;
	const ov = S.over.get(o.id);
	$<HTMLInputElement>("selZ").value = ov && ov.z != null ? String(ov.z) : "";
}

function bindRange(
	id: string,
	fmt: (v: number) => string,
	set: (v: number) => void,
) {
	const el = $<HTMLInputElement>(id);
	const out = $(`${id}Out`);
	const f = () => {
		const v = Number.parseFloat(el.value);
		if (out) out.textContent = fmt(v);
		set(v);
	};
	el.addEventListener("input", () => {
		f();
		update();
	});
	f();
}

type DetKey = keyof typeof P.det;
function bindDet(id: string, fmt: (v: number) => string, key: DetKey, k = 1) {
	const el = $<HTMLInputElement>(id);
	const out = $(`${id}Out`);
	const f = () => {
		const v = Number.parseFloat(el.value);
		out.textContent = fmt(v);
		P.det[key] = v * k;
	};
	el.addEventListener("input", f);
	f();
}

export function initPanel(analyse: () => Promise<void>) {
	hooks.afterUpdate = () => {
		renderCensus();
		renderSel();
	};
	$<HTMLSelectElement>("selCls").onchange = (e) => {
		const o = S.sel;
		if (!o) return;
		const ov = S.over.get(o.id) || {};
		ov.cls = (e.target as HTMLSelectElement).value as Cls;
		S.over.set(o.id, ov);
		update();
	};
	$<HTMLInputElement>("selZ").onchange = (e) => {
		const o = S.sel;
		if (!o) return;
		const v = Number.parseFloat((e.target as HTMLInputElement).value);
		const ov = S.over.get(o.id) || {};
		ov.z = Number.isFinite(v) && v >= 0 ? v : null;
		S.over.set(o.id, ov);
		update();
	};
	$("selReset").onclick = () => {
		if (S.sel) {
			S.over.delete(S.sel.id);
			update();
		}
	};
	$("selClose").onclick = () => select(null);

	bindRange(
		"stretch",
		(v) => `${v.toFixed(2)}×`,
		(v) => (P.stretch = v),
	);
	bindRange(
		"gamma",
		(v) => v.toFixed(2),
		(v) => (P.gamma = v),
	);
	bindRange(
		"cue",
		(v) =>
			v === 0
				? "size"
				: v === 1
					? "colour"
					: `${Math.round((1 - v) * 100)} / ${Math.round(v * 100)}`,
		(v) => (P.cue = v),
	);
	bindRange(
		"bright",
		(v) => v.toFixed(2),
		(v) => (P.bright = v),
	);
	bindRange(
		"scale",
		(v) => `${v.toFixed(2)}×`,
		(v) => (P.scale = v),
	);
	bindRange(
		"sky",
		(v) => `${Math.round(v * 100)}%`,
		(v) => (P.sky = v),
	);
	bindDet("dK", (v) => v.toFixed(1), "kSigma");
	bindDet("dNear", (v) => `${v.toFixed(2)}%`, "nearFrac", 0.01);
	bindDet("dBlue", (v) => v.toFixed(2), "nearBluer");
	bindDet("dFar", (v) => `${v} px`, "farArea");
	bindDet("dSpike", (v) => v.toFixed(2), "spikeContrast");
	bindDet("dCont", (v) => v.toFixed(3), "minCont");
	$("rerun").onclick = () => {
		S.over.clear();
		S.sel = null;
		void analyse();
	};
	$<HTMLSelectElement>("mode").onchange = (e) => {
		P.mode = (e.target as HTMLSelectElement).value as DepthMode;
		update();
	};
	for (const id of ["zNear", "zMid0", "zMid1", "zFar0", "zFar1"])
		$(id).addEventListener("change", () => {
			const g = (i: string) =>
				Math.max(0, Number.parseFloat($<HTMLInputElement>(i).value) || 0);
			P.zNear = g("zNear");
			P.zMid = [g("zMid0"), Math.max(g("zMid0"), g("zMid1"))];
			P.zFar = [g("zFar0"), Math.max(g("zFar0"), g("zFar1"), 0.01)];
			update();
		});
	const projBtns = [...$("proj").querySelectorAll("button")];
	for (const b of projBtns)
		b.onclick = () => {
			P.proj = b.dataset.v as Proj;
			for (const x of projBtns) x.setAttribute("aria-pressed", String(x === b));
			update();
		};
	for (const k of ["shells", "markers", "labels"] as const)
		$<HTMLInputElement>(k).onchange = (e) => {
			P[k] = (e.target as HTMLInputElement).checked;
			update();
		};
	$("railToggle").onclick = (e) => {
		const closed = $("app").classList.toggle("collapsed");
		const btn = e.currentTarget as HTMLElement;
		btn.textContent = closed ? "Show controls" : "Hide controls";
		btn.setAttribute("aria-expanded", String(!closed));
		setTimeout(resize, 0);
	};
}
