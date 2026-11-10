// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runDetect } from "./detect-worker.ts";
import { analyse, initLoader, loadImage } from "./loader.ts";
import { type FeedItem, pickRandom } from "./random-feed.ts";
import { buildAll } from "./scene.ts";
import { type Detection, S } from "./state.ts";

vi.mock("./detect-worker.ts", () => ({ runDetect: vi.fn() }));
vi.mock("./scene.ts", () => ({ buildAll: vi.fn() }));
vi.mock("./random-feed.ts", async (original) => ({
	...(await original<typeof import("./random-feed.ts")>()),
	pickRandom: vi.fn(),
}));

const images: TestImage[] = [];
class TestImage {
	naturalWidth = 10;
	naturalHeight = 10;
	src = "";
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	constructor() {
		images.push(this);
	}
}
function detection(width: number): Detection {
	return {
		objects: [],
		labels: new Int32Array(width * width),
		bg: new Float32Array(width * width),
		fieldColor: 0,
		spikeAngles: [],
	};
}
async function finishImage(index: number, width: number) {
	images[index].naturalWidth = images[index].naturalHeight = width;
	images[index].onload?.();
	await Promise.resolve();
}

beforeEach(() => {
	vi.clearAllMocks();
	images.length = 0;
	S.rgba = null;
	document.body.innerHTML = [
		"busy",
		"busyText",
		"bar",
		"srcName",
		"dims",
		"credit",
		"stage",
		"file",
		"openBtn",
		"loadSample",
		"randJwst",
		"randHubble",
	]
		.map((id) => `<div id="${id}"></div>`)
		.join("");
	vi.stubGlobal("Image", TestImage);
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
		() =>
			({
				drawImage: vi.fn(),
				getImageData: (_x: number, _y: number, w: number, h: number) => ({
					data: new Uint8ClampedArray(w * h * 4),
				}),
			}) as unknown as CanvasRenderingContext2D,
	);
});

describe("latest image request wins", () => {
	it("keeps the initial image load when detection is requested before pixels arrive", async () => {
		vi.mocked(runDetect).mockResolvedValue(detection(10));
		const loading = loadImage("first.png", "first", false);
		await analyse();
		await finishImage(0, 10);
		await loading;
		expect(runDetect).toHaveBeenCalledOnce();
		expect(S.det).not.toBeNull();
	});

	it.each([
		false,
		true,
	])("ignores an earlier worker's completion (failure: %s)", async (failure) => {
		const old = Promise.withResolvers<Detection>();
		const latest = Promise.withResolvers<Detection>();
		vi.mocked(runDetect)
			.mockReturnValueOnce(old.promise)
			.mockReturnValueOnce(latest.promise);
		const first = loadImage("first.png", "first", false);
		await finishImage(0, 10);
		const second = loadImage("second.png", "second", false);
		await finishImage(1, 20);
		if (failure) old.reject(new Error("old failure"));
		else old.resolve(detection(10));
		await first;
		expect(buildAll).not.toHaveBeenCalled();
		expect(document.getElementById("busyText")?.textContent).toContain(
			"20 × 20",
		);
		expect(S.det).toBeNull();
		const result = detection(20);
		latest.resolve(result);
		await second;
		expect(S.det).toBe(result);
		expect(buildAll).toHaveBeenCalledOnce();
	});

	it("ignores an earlier image that finishes downloading last", async () => {
		vi.mocked(runDetect).mockResolvedValue(detection(20));
		const first = loadImage("first.png", "first", false);
		const second = loadImage("second.png", "second", false);
		await finishImage(1, 20);
		await second;
		await finishImage(0, 10);
		await first;
		expect(S.W).toBe(20);
		expect(document.getElementById("srcName")?.textContent).toBe("second");
		expect(runDetect).toHaveBeenCalledOnce();
	});

	it("ignores a random feed response after another image was requested", async () => {
		const feed = Promise.withResolvers<FeedItem>();
		vi.mocked(pickRandom).mockReturnValue(feed.promise);
		vi.mocked(runDetect).mockResolvedValue(detection(20));
		initLoader();
		document.getElementById("randJwst")?.click();
		const latest = loadImage("local.png", "local", false);
		await finishImage(0, 20);
		await latest;
		feed.resolve({
			rec: { Title: "older random" },
			res: { URL: "random.png", FileSize: 10, Dimensions: [1000, 1000] },
		});
		await Promise.resolve();
		expect(images).toHaveLength(1);
		expect(document.getElementById("srcName")?.textContent).toBe("local");
	});
});
