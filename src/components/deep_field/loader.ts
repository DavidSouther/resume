// Image loading (sample, file, drop, paste, random) and detection orchestration.

import { runDetect } from "./detect-worker.ts";
import { FEEDS, type FeedKey, pickRandom, unbytes } from "./random-feed.ts";
import { buildAll } from "./scene.ts";
import { $, P, S, SAMPLE_NAME, SAMPLE_SRC } from "./state.ts";

const MAX_DIM = 1600;

export function setBusy(text: string, on: boolean) {
	$("busy").hidden = !on && !text;
	$("busyText").textContent = text || "";
	$("bar").hidden = !on;
}

interface Credit {
	title: string;
	url: string;
	credit: string;
	source: string;
}
let sampleCredit = "";
function setCredit(isSample: boolean, credit?: Credit) {
	const el = $("credit");
	if (credit) {
		el.textContent = "Image: ";
		const a = document.createElement("a");
		a.href = credit.url;
		a.target = "_blank";
		a.rel = "noopener";
		a.textContent = credit.title;
		el.append(a, `. ${credit.credit} (CC BY 4.0, ${credit.source}).`);
		el.hidden = false;
	} else {
		el.innerHTML = sampleCredit;
		el.hidden = !isSample;
	}
}

export function analyse(): Promise<void> {
	setBusy(
		`Analysing ${S.W.toLocaleString()} × ${S.H.toLocaleString()} px`,
		true,
	);
	return runDetect(S.rgba as Uint8ClampedArray, S.W, S.H, { ...P.det })
		.then((det) => {
			S.det = det;
			buildAll();
			setBusy("", false);
		})
		.catch((e: Error) => {
			// Leave the message up; the progress bar is already hidden.
			setBusy(e.message || String(e), false);
		});
}

export function loadImage(
	src: string,
	name: string,
	isSample: boolean,
	credit?: Credit,
): Promise<void> {
	return new Promise<HTMLImageElement>((res, rej) => {
		const im = new Image();
		if (/^https?:/.test(src)) im.crossOrigin = "anonymous";
		im.onload = () => res(im);
		im.onerror = () =>
			rej(
				new Error(
					"That file could not be read as an image. Try a PNG or JPEG.",
				),
			);
		im.src = src;
	})
		.then((im) => {
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
			S.W = W;
			S.H = H;
			S.rgba = cx.getImageData(0, 0, W, H).data;
			S.sample = isSample;
			S.over.clear();
			S.sel = null;
			$("srcName").textContent = name;
			$("dims").textContent =
				`${W} × ${H} px${k < 1 ? ` (from ${im.naturalWidth})` : ""}`;
			setCredit(isSample, credit);
			return analyse();
		})
		.catch((e: Error) => {
			setBusy(e.message || String(e), false);
		});
}

let randomBusy = false;
async function loadRandom(key: FeedKey) {
	if (randomBusy) return;
	randomBusy = true;
	const btns = [$("randJwst"), $("randHubble")] as HTMLButtonElement[];
	for (const b of btns) b.disabled = true;
	try {
		setBusy(`Fetching ${FEEDS[key].label} image list`, true);
		const { rec, res } = await pickRandom(key);
		const title = unbytes(rec.Title);
		setBusy(`Downloading ${title}`, true);
		await loadImage(res.URL, `${title} · ${FEEDS[key].label}`, false, {
			title,
			url: rec.ReferenceURL ?? "",
			credit: unbytes(rec.Credit),
			source: FEEDS[key].name,
		});
	} catch (e) {
		setBusy(
			`Could not load a ${FEEDS[key].label} image (${(e as Error).message || e}). Try again.`,
			false,
		);
		setTimeout(() => setBusy("", false), 3500);
	} finally {
		randomBusy = false;
		for (const b of btns) b.disabled = false;
	}
}

function openFile(f: File) {
	if (!/^image\//.test(f.type)) {
		setBusy("That file is not an image. Open a PNG, JPEG or WebP.", false);
		setTimeout(() => setBusy("", false), 2600);
		return;
	}
	const r = new FileReader();
	r.onload = () => loadImage(r.result as string, f.name, false);
	r.readAsDataURL(f);
}

export function initLoader() {
	sampleCredit = $("credit").innerHTML;
	const stage = $("stage");
	$<HTMLInputElement>("file").onchange = (e) => {
		const input = e.target as HTMLInputElement;
		const f = input.files?.[0];
		if (f) openFile(f);
		input.value = "";
	};
	$("openBtn").onclick = () => $("file").click();
	$("loadSample").onclick = () => loadImage(SAMPLE_SRC, SAMPLE_NAME, true);
	$("randJwst").onclick = () => loadRandom("webb");
	$("randHubble").onclick = () => loadRandom("hubble");
	stage.addEventListener("dragover", (e) => {
		e.preventDefault();
		$("drop").hidden = false;
	});
	stage.addEventListener("dragleave", () => {
		$("drop").hidden = true;
	});
	stage.addEventListener("drop", (e) => {
		e.preventDefault();
		$("drop").hidden = true;
		const f = e.dataTransfer?.files[0];
		if (f) openFile(f);
	});
	window.addEventListener("paste", (e) => {
		const it = [...(e.clipboardData?.items || [])].find((i) =>
			i.type.startsWith("image/"),
		);
		const f = it?.getAsFile();
		if (f) openFile(f);
	});
}
