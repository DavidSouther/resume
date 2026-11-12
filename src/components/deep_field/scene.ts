// Sprite atlas, sky plane, guides, markers and labels: everything drawn in the
// volume, rebuilt from a detection (buildAll) or from parameters (update).

import { matchCatalog } from "./catalog.ts";
import { COS } from "./cosmology.ts";
import {
	dNear,
	dOfU,
	estimate,
	kOfD,
	place,
	toWorld,
	uOf,
	zMax,
} from "./placement.ts";
import { scene, syncPivot } from "./rig.ts";
import { $, COLORS, css, H0W, hooks, type Obj, P, S, view } from "./state.ts";

// biome-ignore lint/suspicious/noExplicitAny: three.js objects come from an untyped CDN global
type Any = any;

export const spriteMat = new THREE.ShaderMaterial({
	uniforms: {
		map: { value: null },
		uVis: { value: new THREE.Vector4(1, 1, 1, 1) },
		uBright: { value: 1 },
		uSel: { value: -1 },
		uSpriteX: { value: new THREE.Vector2(1, 0) },
		uSpriteY: { value: new THREE.Vector2(0, 1) },
	},
	vertexShader: `
    attribute vec3 center; attribute vec2 corner; attribute vec2 halfSize; attribute float cls; attribute float oid;
    uniform vec4 uVis; uniform float uSel; uniform vec2 uSpriteX; uniform vec2 uSpriteY;
    varying vec2 vUv; varying float vHi;
    void main() {
      float v = cls < 0.5 ? uVis.x : cls < 1.5 ? uVis.y : cls < 2.5 ? uVis.z : uVis.w;
      vUv = uv; vHi = abs(oid - uSel) < 0.5 ? 1.0 : 0.0;
      vec2 q = corner * halfSize;
      // Foreshortened cutouts share one camera depth instead of acquiring a
      // depth span proportional to their width as a world-space quad would.
      vec4 p = modelViewMatrix * vec4(center, 1.0);
      p.xy += uSpriteX * q.x + uSpriteY * q.y;
      gl_Position = v < 0.5 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * p;
    }`,
	fragmentShader: `
    uniform sampler2D map; uniform float uBright;
    varying vec2 vUv; varying float vHi;
    void main() { vec3 c = texture2D(map, vUv).rgb * uBright * (1.0 + 0.9 * vHi); gl_FragColor = vec4(c, 1.0); }`,
	blending: THREE.AdditiveBlending,
	depthWrite: false,
	depthTest: false,
	transparent: true,
});

export const spriteMeshes: Any[] = [];
const guides = new THREE.Group();
const labelGroup = new THREE.Group();
let skyMesh: Any = null;
let markerPts: Any = null;
scene.add(guides, labelGroup);

interface AtlasItem {
	o: Obj;
	x0: number;
	y0: number;
	w: number;
	h: number;
	ax: number;
	ay: number;
	atlas: number;
	u0: number;
	u1: number;
	v0: number;
	v1: number;
}
interface Atlas {
	x: number;
	y: number;
	shelf: number;
	items: AtlasItem[];
}

// Sprite atlas: each source's own pixels, sky-subtracted, masked to its footprint.
export function buildAll() {
	const { W, H, rgba } = S;
	if (!S.det || !rgba) return;
	const { objects, labels, bg } = S.det;
	view.W0 = (H0W * W) / H;
	S.objs = objects.map((o) => ({ ...o, det: o.cls })) as Obj[];
	S.notes = [];
	if (S.field) {
		const hits = matchCatalog(S.objs, S.field, W, H);
		for (const o of S.objs) {
			const m = hits.get(o.id);
			if (m && o.cls !== "star") o.zCat = m.z;
		}
	}

	for (const m of spriteMeshes) {
		m.geometry.dispose();
		m.material.uniforms.map.value?.dispose();
		scene.remove(m);
	}
	spriteMeshes.length = 0;
	const PAD = 2;
	const AW = 2048;
	const MAXH = 4096;
	const items: AtlasItem[] = S.objs.map((o) => {
		const x0 = Math.max(0, o.x0 - PAD);
		const y0 = Math.max(0, o.y0 - PAD);
		const x1 = Math.min(W - 1, o.x1 + PAD);
		const y1 = Math.min(H - 1, o.y1 + PAD);
		return {
			o,
			x0,
			y0,
			w: x1 - x0 + 1,
			h: y1 - y0 + 1,
			ax: 0,
			ay: 0,
			atlas: 0,
			u0: 0,
			u1: 0,
			v0: 0,
			v1: 0,
		};
	});
	const order = items.slice().sort((a, b) => b.h - a.h);
	const atlases: Atlas[] = [];
	let cur: Atlas | null = null;
	for (const it of order) {
		if (!cur || cur.x + it.w > AW) {
			if (cur) {
				cur.y += cur.shelf;
				cur.x = 0;
				cur.shelf = 0;
			}
		}
		if (!cur || cur.y + it.h > MAXH) {
			cur = { x: 0, y: 0, shelf: 0, items: [] };
			atlases.push(cur);
		}
		it.ax = cur.x;
		it.ay = cur.y;
		it.atlas = atlases.length - 1;
		cur.items.push(it);
		cur.x += it.w + 1;
		cur.shelf = Math.max(cur.shelf, it.h + 1);
	}
	for (const A of atlases) {
		const AH = Math.max(1, A.y + A.shelf);
		const cv = document.createElement("canvas");
		cv.width = AW;
		cv.height = AH;
		const ctx = cv.getContext("2d") as CanvasRenderingContext2D;
		const img = ctx.createImageData(AW, AH);
		const d = img.data;
		for (const it of A.items) {
			const id = it.o.id;
			const { w, h } = it;
			const own = new Uint8Array(w * h);
			const dil = new Uint8Array(w * h);
			const tmp = new Uint8Array(w * h);
			for (let y = 0; y < h; y++)
				for (let x = 0; x < w; x++)
					own[y * w + x] = labels[(it.y0 + y) * W + it.x0 + x] === id ? 1 : 0;
			for (let y = 0; y < h; y++)
				for (let x = 0; x < w; x++) {
					let m = 0;
					for (let k = -2; k <= 2 && !m; k++) {
						const xx = x + k;
						if (xx >= 0 && xx < w) m = own[y * w + xx];
					}
					tmp[y * w + x] = m;
				}
			for (let y = 0; y < h; y++)
				for (let x = 0; x < w; x++) {
					let m = 0;
					for (let k = -2; k <= 2 && !m; k++) {
						const yy = y + k;
						if (yy >= 0 && yy < h) m = tmp[yy * w + x];
					}
					dil[y * w + x] = m;
				}
			for (let y = 0; y < h; y++)
				for (let x = 0; x < w; x++) {
					const si = (it.y0 + y) * W + it.x0 + x;
					const li = labels[si];
					const wgt = own[y * w + x]
						? 1
						: li === 0 && dil[y * w + x]
							? 0.55
							: 0;
					if (!wgt) continue;
					const di = ((it.ay + y) * AW + it.ax + x) * 4;
					const b = bg[si] * 0.97;
					const s4 = si * 4;
					d[di] = Math.max(0, rgba[s4] - b) * wgt;
					d[di + 1] = Math.max(0, rgba[s4 + 1] - b) * wgt;
					d[di + 2] = Math.max(0, rgba[s4 + 2] - b) * wgt;
					d[di + 3] = 255;
				}
			it.u0 = it.ax / AW;
			it.u1 = (it.ax + w) / AW;
			it.v0 = it.ay / AH;
			it.v1 = (it.ay + h) / AH;
		}
		ctx.putImageData(img, 0, 0);
		const tex = new THREE.CanvasTexture(cv);
		tex.flipY = false;
		tex.minFilter = THREE.LinearFilter;
		tex.generateMipmaps = false;
		const n = A.items.length;
		const g = new THREE.BufferGeometry();
		const center = new Float32Array(n * 12);
		const corner = new Float32Array(n * 8);
		const halfSz = new Float32Array(n * 8);
		const uv = new Float32Array(n * 8);
		const cls = new Float32Array(n * 4);
		const oid = new Float32Array(n * 4);
		const idx = new Uint32Array(n * 6);
		A.items.forEach((it, k) => {
			const C = [
				[-1, -1],
				[1, -1],
				[1, 1],
				[-1, 1],
			];
			const U = [
				[it.u0, it.v1],
				[it.u1, it.v1],
				[it.u1, it.v0],
				[it.u0, it.v0],
			];
			for (let j = 0; j < 4; j++) {
				corner.set(C[j], (k * 4 + j) * 2);
				uv.set(U[j], (k * 4 + j) * 2);
				oid[k * 4 + j] = it.o.id;
			}
			idx.set(
				[k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3],
				k * 6,
			);
			it.o.sprite = {
				mesh: atlases.indexOf(A),
				slot: k,
				px: it.x0 + it.w / 2,
				py: it.y0 + it.h / 2,
				w: it.w,
				h: it.h,
			};
		});
		g.setAttribute(
			"position",
			new THREE.BufferAttribute(new Float32Array(n * 12), 3),
		);
		g.setAttribute("center", new THREE.BufferAttribute(center, 3));
		g.setAttribute("corner", new THREE.BufferAttribute(corner, 2));
		g.setAttribute("halfSize", new THREE.BufferAttribute(halfSz, 2));
		g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
		g.setAttribute("cls", new THREE.BufferAttribute(cls, 1));
		g.setAttribute("oid", new THREE.BufferAttribute(oid, 1));
		g.setIndex(new THREE.BufferAttribute(idx, 1));
		const mat = spriteMat.clone();
		mat.uniforms.map.value = tex;
		const mesh = new THREE.Mesh(g, mat);
		mesh.frustumCulled = false;
		scene.add(mesh);
		spriteMeshes.push(mesh);
	}

	// unresolved sky: the frame with every detected source painted out
	if (skyMesh) {
		skyMesh.geometry.dispose();
		skyMesh.material.map.dispose();
		scene.remove(skyMesh);
	}
	const cv = document.createElement("canvas");
	cv.width = W;
	cv.height = H;
	const sctx = cv.getContext("2d") as CanvasRenderingContext2D;
	const sim = sctx.createImageData(W, H);
	const sd = sim.data;
	for (let y = 0; y < H; y++)
		for (let x = 0; x < W; x++) {
			const i = y * W + x;
			let hit = labels[i] !== 0;
			if (!hit)
				for (let dy = -1; dy <= 1 && !hit; dy++)
					for (let dx = -1; dx <= 1 && !hit; dx++) {
						const yy = y + dy;
						const xx = x + dx;
						if (yy >= 0 && yy < H && xx >= 0 && xx < W && labels[yy * W + xx])
							hit = true;
					}
			const j = i * 4;
			if (hit) {
				const b = bg[i] * 0.6;
				sd[j] = sd[j + 1] = sd[j + 2] = b;
			} else {
				sd[j] = rgba[j];
				sd[j + 1] = rgba[j + 1];
				sd[j + 2] = rgba[j + 2];
			}
			sd[j + 3] = 255;
		}
	sctx.putImageData(sim, 0, 0);
	const st = new THREE.CanvasTexture(cv);
	skyMesh = new THREE.Mesh(
		new THREE.PlaneGeometry(1, 1),
		new THREE.MeshBasicMaterial({
			map: st,
			transparent: true,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			depthTest: false,
		}),
	);
	skyMesh.renderOrder = -1;
	scene.add(skyMesh);

	$("spikeInfo").textContent = S.det.spikeAngles.length
		? `spikes at ${S.det.spikeAngles.map((a) => `${(a + 360) % 180}°`).join(", ")}`
		: "no spike pattern found";
	update();
	hooks.afterBuild();
}

export function update() {
	if (!S.det) return;
	const { W0 } = view;
	estimate();
	const CI = { star: 0, near: 1, mid: 2, far: 3 };
	for (const o of S.objs) {
		const { d, k } = place(o);
		o.d = d;
		o.k = k;
		o.world = toWorld(o.cx + 0.5, o.cy + 0.5, d, k);
		const sp = o.sprite;
		const mesh = spriteMeshes[sp.mesh];
		const g = mesh.geometry;
		const c = toWorld(sp.px, sp.py, d, k);
		const hw = (sp.w / 2 / S.W) * W0 * k * P.scale;
		const hh = (sp.h / 2 / S.H) * H0W * k * P.scale;
		const C = g.attributes.center.array;
		const Hh = g.attributes.halfSize.array;
		const L = g.attributes.cls.array;
		for (let j = 0; j < 4; j++) {
			const v = sp.slot * 4 + j;
			C[v * 3] = c[0];
			C[v * 3 + 1] = c[1];
			C[v * 3 + 2] = c[2];
			Hh[v * 2] = hw;
			Hh[v * 2 + 1] = hh;
			L[v] = CI[o.cls];
		}
	}
	for (const m of spriteMeshes) {
		const a = m.geometry.attributes;
		a.center.needsUpdate = a.halfSize.needsUpdate = a.cls.needsUpdate = true;
		m.material.uniforms.uBright.value = P.bright;
		m.material.uniforms.uVis.value.set(
			+P.show.star,
			+P.show.near,
			+P.show.mid,
			+P.show.far,
		);
		m.material.uniforms.uSel.value = S.sel ? S.sel.id : -1;
	}
	// sky plane just behind the deepest shell
	const dFar = dOfU(1) * 1.002 + 0.001;
	const kF = kOfD(dFar);
	skyMesh.scale.set(W0 * kF, H0W * kF, 1);
	skyMesh.position.set(0, 0, -dFar);
	skyMesh.material.opacity = P.sky;
	skyMesh.visible = P.sky > 0;
	syncPivot();
	buildGuides();
	buildMarkers();
	buildLabels();
	hooks.afterUpdate();
}

// ---------------- guides: bounding volume and redshift shells
function textSprite(text: string, color: string, hPx = 26): Any {
	const cv = document.createElement("canvas");
	const cx = cv.getContext("2d") as CanvasRenderingContext2D;
	const font = `500 ${hPx}px ui-monospace, "SFMono-Regular", Menlo, monospace`;
	cx.font = font;
	const w = Math.ceil(cx.measureText(text).width) + 12;
	cv.width = w;
	cv.height = hPx + 10;
	cx.font = font;
	cx.fillStyle = color;
	cx.textBaseline = "middle";
	cx.fillText(text, 6, cv.height / 2);
	const t = new THREE.CanvasTexture(cv);
	t.minFilter = THREE.LinearFilter;
	const s = new THREE.Sprite(
		new THREE.SpriteMaterial({
			map: t,
			transparent: true,
			depthTest: false,
			depthWrite: false,
		}),
	);
	s.userData.aspect = cv.width / cv.height;
	s.center.set(0, 0);
	return s;
}
function clearGroup(g: Any) {
	while (g.children.length) {
		const c = g.children.pop();
		c.geometry?.dispose();
		if (c.material) {
			c.material.map?.dispose();
			c.material.dispose();
		}
	}
}
// label size follows the cone inside the telescope view (k < 1) and grows as sqrt(k) beyond it
const labelK = (k: number) => (k < 1 ? k : Math.sqrt(k));
function rect(d: number, k: number): number[][] {
	const x = (view.W0 / 2) * k;
	const y = (H0W / 2) * k;
	return [
		[-x, -y, -d],
		[x, -y, -d],
		[x, y, -d],
		[-x, y, -d],
	];
}
function buildGuides() {
	clearGroup(guides);
	guides.visible = P.shells;
	if (!P.shells) return;
	const { W0 } = view;
	const kOf = kOfD;
	const dA = dNear();
	const dB = dOfU(1);
	const a = rect(dA, kOf(dA));
	const b = rect(dB, kOf(dB));
	const edge: number[] = [];
	for (let i = 0; i < 4; i++) {
		edge.push(
			...a[i],
			...a[(i + 1) % 4],
			...b[i],
			...b[(i + 1) % 4],
			...a[i],
			...b[i],
		);
	}
	const eg = new THREE.BufferGeometry();
	eg.setAttribute("position", new THREE.Float32BufferAttribute(edge, 3));
	guides.add(
		new THREE.LineSegments(
			eg,
			new THREE.LineBasicMaterial({
				color: new THREE.Color(css("--df-accent")),
				transparent: true,
				opacity: 0.45,
			}),
		),
	);
	const shellZ = [0.1, 0.25, 0.5, 1, 2, 3, 5, 8, 12].filter(
		(z) => z < zMax() * 0.999,
	);
	const sh: number[] = [];
	const labelColor = css("--df-dim");
	function addTag(text: string, color: string, at: number[], k: number) {
		const s = textSprite(text, color);
		const h = 0.028 * H0W * labelK(k);
		s.scale.set(h * s.userData.aspect, h, 1);
		s.position.set(at[0], at[1] + h * 0.25, at[2]);
		guides.add(s);
	}
	for (const z of shellZ) {
		const d = dOfU(uOf(z));
		if (d - dA < 0.02 * W0) continue;
		const r = rect(d, kOf(d));
		for (let i = 0; i < 4; i++) sh.push(...r[i], ...r[(i + 1) % 4]);
		addTag(`z ${z}  ·  ${COS.lb(z).toFixed(1)} Gyr`, labelColor, r[3], kOf(d));
	}
	if (P.proj !== "pyramid") addTag("image plane", labelColor, a[3], kOf(dA));
	addTag(
		`z ${+zMax().toFixed(2)}  ·  ${COS.lb(zMax()).toFixed(1)} Gyr`,
		css("--df-accent"),
		b[3],
		kOf(dB),
	);
	if (sh.length) {
		const sg = new THREE.BufferGeometry();
		sg.setAttribute("position", new THREE.Float32BufferAttribute(sh, 3));
		guides.add(
			new THREE.LineSegments(
				sg,
				new THREE.LineBasicMaterial({
					color: new THREE.Color(css("--df-dim")),
					transparent: true,
					opacity: 0.32,
				}),
			),
		);
	}
}
function dotTexture() {
	const cv = document.createElement("canvas");
	cv.width = cv.height = 32;
	const c = cv.getContext("2d") as CanvasRenderingContext2D;
	c.strokeStyle = "#fff";
	c.lineWidth = 4;
	c.beginPath();
	c.arc(16, 16, 11, 0, 7);
	c.stroke();
	return new THREE.CanvasTexture(cv);
}
let DOT: Any = null;
function buildMarkers() {
	if (markerPts) {
		markerPts.geometry.dispose();
		markerPts.material.dispose();
		scene.remove(markerPts);
		markerPts = null;
	}
	if (!P.markers) return;
	DOT ??= dotTexture();
	const pos: number[] = [];
	const col: number[] = [];
	for (const o of S.objs) {
		if (!P.show[o.cls] || (o.cls === "near" && o.fragment)) continue;
		pos.push(...o.world);
		const c = new THREE.Color(COLORS[o.cls]);
		col.push(c.r, c.g, c.b);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
	markerPts = new THREE.Points(
		g,
		new THREE.PointsMaterial({
			size: 9,
			sizeAttenuation: false,
			vertexColors: true,
			map: DOT,
			transparent: true,
			opacity: 0.85,
			depthTest: false,
			depthWrite: false,
		}),
	);
	scene.add(markerPts);
}
function buildLabels() {
	clearGroup(labelGroup);
	if (!P.labels) return;
	for (const n of S.notes) {
		const lead =
			S.objs.find((o) => o.id === n.group) ||
			S.objs.find((o) => o.group === n.group);
		if (!lead || !P.show[lead.cls]) continue;
		const s = textSprite(
			`${n.name}  ·  z ${lead.z.toFixed(4)}`,
			css("--df-near"),
		);
		const h = 0.03 * H0W * labelK(lead.k);
		s.scale.set(h * s.userData.aspect, h, 1);
		const top = toWorld(lead.cx, lead.y0 - 6, lead.d, lead.k);
		s.position.set(top[0], top[1], top[2]);
		labelGroup.add(s);
	}
}
