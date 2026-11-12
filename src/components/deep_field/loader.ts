// Image loading (sample, file, drop, paste, random) and detection orchestration.

import { runDetect } from "./detect-worker.ts";
import {
	DEFAULT_FIELD,
	type Field,
	fieldSrc,
	loadFields,
	pickField,
	SOURCES,
	type SourceKey,
} from "./fields.ts";
import { buildAll } from "./scene.ts";
import { $, P, S } from "./state.ts";

const MAX_DIM = 1600;
// Shared by file reads, network/image loads and worker requests: only the
// latest user action may publish state, errors or completion.
let generation = 0;

export function setBusy(text: string, on: boolean) {
	$("busy").hidden = !on && !text;
	$("busyText").textContent = text || "";
	$("bar").hidden = !on;
}

function setCredit(f: Field) {
	const el = $("credit");
	el.textContent = "Image: ";
	const a = document.createElement("a");
	a.href = f.referenceUrl;
	a.target = "_blank";
	a.rel = "noopener";
	a.textContent = f.title;
	el.append(
		a,
		`. ${f.credit} (CC BY 4.0, ${f.source}). Redshifts: ${Object.keys(f.catalogs).join(", ")}.`,
	);
	el.hidden = false;
}

export function analyse(): Promise<void> {
	if (!S.rgba) return Promise.resolve();
	return analyseCurrent(++generation);
}

function analyseCurrent(request: number): Promise<void> {
	setBusy(
		`Analysing ${S.W.toLocaleString()} × ${S.H.toLocaleString()} px`,
		true,
	);
	return runDetect(S.rgba as Uint8ClampedArray, S.W, S.H, { ...P.det })
		.then((det) => {
			if (request !== generation) return;
			S.det = det;
			buildAll();
			setBusy("", false);
		})
		.catch((e: Error) => {
			if (request !== generation) return;
			setBusy(e.message || String(e), false);
		});
}

export function loadImage(
	src: string,
	name: string,
	field: Field,
): Promise<void> {
	return loadImageCurrent(++generation, src, name, field);
}

function loadImageCurrent(
	request: number,
	src: string,
	name: string,
	field: Field,
): Promise<void> {
	return new Promise<HTMLImageElement>((res, rej) => {
		const im = new Image();
		if (/^https?:/.test(src)) im.crossOrigin = "anonymous";
		im.onload = () => res(im);
		im.onerror = () => rej(new Error("That image could not be loaded."));
		im.src = src;
	})
		.then((im) => {
			if (request !== generation) return;
			const k = Math.min(
				1,
				MAX_DIM / Math.max(im.naturalWidth, im.naturalHeight),
			);
			const W = Math.round(im.naturalWidth * k);
			const H = Math.round(im.naturalHeight * k);
			const cv = document.createElement("canvas");
			cv.width = W;
			cv.height = H;
			const cx = cv.getContext("2d") as CanvasRenderingContext2D;
			cx.drawImage(im, 0, 0, W, H);
			const rgba = cx.getImageData(0, 0, W, H).data;
			S.det = null;
			S.W = W;
			S.H = H;
			S.rgba = rgba;
			S.field = field;
			S.over.clear();
			S.sel = null;
			$("srcName").textContent = name;
			$("dims").textContent =
				`${W} × ${H} px${k < 1 ? ` (from ${im.naturalWidth})` : ""}`;
			setCredit(field);
			return analyseCurrent(request);
		})
		.catch((e: Error) => {
			if (request !== generation) return;
			setBusy(e.message || String(e), false);
		});
}

const fieldName = (f: Field, label: string) => `${f.title} · ${label}`;

let randomBusy = false;
async function loadField(pick: (fields: Field[]) => Field) {
	if (randomBusy) return;
	const request = ++generation;
	randomBusy = true;
	const btns = [
		$("loadSample"),
		$("randJwst"),
		$("randHubble"),
	] as HTMLButtonElement[];
	for (const b of btns) b.disabled = true;
	try {
		setBusy("Loading catalog fields", true);
		const field = pick(await loadFields());
		if (request !== generation) return;
		setBusy(`Downloading ${field.title}`, true);
		await loadImageCurrent(
			request,
			fieldSrc(field),
			fieldName(
				field,
				field.source === SOURCES.hubble.name ? "Hubble" : "JWST",
			),
			field,
		);
	} catch (e) {
		if (request !== generation) return;
		setBusy(
			`Could not load an image (${(e as Error).message || e}). Try again.`,
			false,
		);
		setTimeout(() => {
			if (request === generation) setBusy("", false);
		}, 3500);
	} finally {
		randomBusy = false;
		for (const b of btns) b.disabled = false;
	}
}

/** Load the default catalog field. */
export const loadDefault = () =>
	loadField(
		(fields) => fields.find((f) => f.id === DEFAULT_FIELD) ?? fields[0],
	);

export function initLoader() {
	$("loadSample").onclick = () => void loadDefault();
	for (const [id, key] of [
		["randJwst", "webb"],
		["randHubble", "hubble"],
	] as [string, SourceKey][])
		$(id).onclick = () => void loadField((fields) => pickField(fields, key));
}
