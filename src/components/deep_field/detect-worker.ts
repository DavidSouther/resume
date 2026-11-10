// Web Worker glue for the Rust/WASM detector. The worker is an inline module
// blob so the SSG bundler needs no separate worker entry, and it imports the
// wasm-pack glue (--target web) from its absolute site URL.
import type { Detection, DetectOptions } from "./state.ts";

export const DETECT_GLUE_PATH = "/deep_field/detect/detect.js";

/** Source of the worker module for a given site origin. Exported for tests and tooling. */
export function workerSource(origin: string): string {
	return `
import init, { detect } from ${JSON.stringify(origin + DETECT_GLUE_PATH)};
const ready = init();
self.onmessage = async (e) => {
  const { id, rgba, W, H, opt } = e.data;
  try {
    await ready;
    const det = detect(new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.length), W, H, opt);
    const out = { objects: det.objects(), labels: det.labels(), bg: det.bg(), fieldColor: det.fieldColor, spikeAngles: Array.from(det.spikeAngles()) };
    if (det.free) det.free();
    self.postMessage({ id, ok: true, result: out }, [out.labels.buffer, out.bg.buffer]);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
`;
}

interface Reply {
	id: number;
	ok: boolean;
	result?: Detection;
	error?: string;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<
	number,
	{ resolve: (d: Detection) => void; reject: (e: Error) => void }
>();

function failAll(message: string) {
	worker?.terminate();
	worker = null;
	for (const p of pending.values()) p.reject(new Error(message));
	pending.clear();
}

function ensureWorker(): Worker {
	if (worker) return worker;
	const url = URL.createObjectURL(
		new Blob([workerSource(location.origin)], { type: "text/javascript" }),
	);
	const w = new Worker(url, { type: "module" });
	w.onmessage = (e: MessageEvent<Reply>) => {
		const p = pending.get(e.data.id);
		if (!p) return;
		pending.delete(e.data.id);
		if (e.data.ok && e.data.result) p.resolve(e.data.result);
		else p.reject(new Error(e.data.error || "Detection failed"));
	};
	// A module that fails to load (missing WASM build, blocked import) surfaces here.
	w.onerror = (e) => {
		e.preventDefault();
		failAll(
			"The detector module could not be loaded. Build it with the wasm task and reload.",
		);
	};
	worker = w;
	return w;
}

/** Run the WASM detector on RGBA pixels. Rejects with a displayable message on failure. */
export function runDetect(
	rgba: Uint8ClampedArray,
	W: number,
	H: number,
	opt: DetectOptions,
): Promise<Detection> {
	return new Promise((resolve, reject) => {
		const id = nextId++;
		pending.set(id, { resolve, reject });
		try {
			ensureWorker().postMessage({ id, rgba, W, H, opt });
		} catch (err) {
			pending.delete(id);
			reject(err instanceof Error ? err : new Error(String(err)));
		}
	});
}
