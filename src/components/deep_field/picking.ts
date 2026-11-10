// Picking, selection ring and hover tooltip.
import { camera, renderer } from "./rig.ts";
import { update } from "./scene.ts";
import { $, CLS_ONE, COLORS, fmtZ, type Obj, P, S, view } from "./state.ts";

const tip = $("tip");
const ring = $("ring");
const V = new THREE.Vector3();

export function select(o: Obj | null) {
	S.sel = o;
	update();
}

function screenOf(o: Obj): { x: number; y: number } | null {
	V.set(...o.world).project(camera);
	if (V.z > 1 || V.z < -1) return null;
	const r = renderer.domElement.getBoundingClientRect();
	return { x: ((V.x + 1) / 2) * r.width, y: ((1 - V.y) / 2) * r.height };
}
function pxRadius(o: Obj): number {
	const dist = camera.position.distanceTo(V.set(...o.world));
	if (dist <= 0) return 0;
	const rw = (Math.max(2.2 * o.major, 3) / S.W) * view.W0 * o.k * P.scale;
	const h = renderer.domElement.clientHeight;
	return (
		((rw / dist) * (h / 2)) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
	);
}
function pick(x: number, y: number): Obj | null {
	let best: Obj | null = null;
	let bs = 1e9;
	for (const o of S.objs) {
		if (!P.show[o.cls]) continue;
		const s = screenOf(o);
		if (!s) continue;
		const r = Math.max(6, Math.min(pxRadius(o), 400));
		const dd = Math.hypot(s.x - x, s.y - y);
		if (dd > r) continue;
		const score = dd / r + (o.cls === "near" && o.fragment ? 0.2 : 0);
		if (score < bs) {
			bs = score;
			best = o;
		}
	}
	return best;
}

let down: { x: number; y: number } | null = null;
let hoverXY: [number, number] | null = null;

export function initPicking(onCancelTween: () => void) {
	const el = renderer.domElement as HTMLCanvasElement;
	el.addEventListener("pointerdown", (e) => {
		down = { x: e.clientX, y: e.clientY };
		onCancelTween();
	});
	el.addEventListener("pointerup", (e) => {
		if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) {
			down = null;
			return;
		}
		down = null;
		const r = el.getBoundingClientRect();
		const o = pick(e.clientX - r.left, e.clientY - r.top);
		if (o && o.cls === "near" && o.fragment) {
			const lead = S.objs.find((q) => q.id === o.group);
			select(lead || o);
		} else select(o);
	});
	el.addEventListener("pointermove", (e) => {
		if (e.pointerType !== "mouse" || e.buttons) {
			hoverXY = null;
			return;
		}
		const r = el.getBoundingClientRect();
		hoverXY = [e.clientX - r.left, e.clientY - r.top];
	});
	el.addEventListener("pointerleave", () => {
		hoverXY = null;
		tip.hidden = true;
	});
}

export function updateOverlays() {
	const sel = S.sel;
	if (sel) {
		const s = screenOf(sel);
		if (s) {
			const r = Math.max(10, Math.min(pxRadius(sel) * 1.1, 300));
			ring.style.left = `${s.x}px`;
			ring.style.top = `${s.y}px`;
			ring.style.width = ring.style.height = `${2 * r}px`;
			ring.style.borderColor = COLORS[sel.cls];
			ring.hidden = false;
		} else ring.hidden = true;
	} else ring.hidden = true;
	if (hoverXY && S.det) {
		const o = pick(...hoverXY);
		if (o) {
			const lead = o.fragment ? S.objs.find((q) => q.id === o.group) || o : o;
			const note = S.notes.find((n) => n.group === lead.group);
			tip.textContent = `${note ? note.name : CLS_ONE[lead.cls]}${lead.cls === "star" ? "" : ` · z ${fmtZ(lead.z)}`}`;
			tip.style.left = `${hoverXY[0]}px`;
			tip.style.top = `${hoverXY[1]}px`;
			tip.hidden = false;
		} else tip.hidden = true;
	}
}
