// Inline SVG figures, built at SSG time. Colors come from CSS custom properties
// declared in page.ts so light and dark themes both work.

import {
	MACHINES,
	type Machine,
	MECHANISMS,
	type Mechanism,
	NS,
	REFERENCE_NS,
} from "./data.ts";

const fmt = (ns: number): string =>
	ns >= 1000
		? `${(ns / 1000).toFixed(ns >= 10000 ? 1 : 2)} µs`
		: ns >= 100
			? `${Math.round(ns)} ns`
			: `${ns.toFixed(ns >= 10 ? 1 : 1)} ns`;

export const MACHINE_CLASS: Record<Machine, string> = {
	m7i: "m-a",
	c7a: "m-b",
	c7g: "m-c",
};
const SERIES: Record<string, string> = {
	thread: "s-thread",
	ucontext: "s-uctx",
	green: "s-green",
};

const svg = (w: number, h: number, label: string, body: string): string =>
	`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}" class="fig">${body}</svg>`;

const ticks = [10, 100, 1000, 10000];
const tickLabel = (t: number) => (t >= 1000 ? `${t / 1000} µs` : `${t} ns`);

/** Figure 1: log-scale bars of ns per handoff at zero working set. */
export function ladder(): string {
	const left = 140,
		right = 690,
		top = 28,
		rowH = 56,
		barH = 13;
	const lo = Math.log10(5),
		hi = Math.log10(10000);
	const x = (ns: number) =>
		left + ((Math.log10(ns) - lo) / (hi - lo)) * (right - left);
	const h = top + MECHANISMS.length * rowH + 24;
	let b = "";
	for (const t of ticks) {
		b += `<line class="grid" x1="${x(t)}" x2="${x(t)}" y1="${top - 8}" y2="${h - 24}"/><text class="tick" x="${x(t)}" y="${top - 14}" text-anchor="middle">${tickLabel(t)}</text>`;
	}
	b += `<line class="ref" x1="${x(REFERENCE_NS)}" x2="${x(REFERENCE_NS)}" y1="${top - 8}" y2="${h - 24}"/><text class="reftext" x="${x(REFERENCE_NS) + 4}" y="${h - 8}">Jansen et al.: 3.15 µs</text>`;
	MECHANISMS.forEach((m, i) => {
		const y0 = top + i * rowH;
		b += `<text class="rowlabel" x="${left - 10}" y="${y0 + 26}" text-anchor="end">${m.label}</text>`;
		MACHINES.forEach((mc, j) => {
			const ns = NS[mc.id][m.id][0];
			const y = y0 + j * (barH + 2);
			b += `<rect class="${MACHINE_CLASS[mc.id]}" x="${left}" y="${y}" width="${x(ns) - left}" height="${barH}" rx="2"><title>${mc.label}: ${fmt(ns)}</title></rect><text class="val" x="${x(ns) + 5}" y="${y + 10.5}">${fmt(ns)}</text>`;
		});
	});
	return svg(
		720,
		h,
		"Log-scale bar chart of nanoseconds per handoff for six mechanisms on three machines",
		b,
	);
}

/** Figure 2: three small multiples, ns per handoff versus working set. */
export function sweep(): string {
	const pw = 220,
		gap = 30,
		left = 44,
		top = 34,
		ph = 210;
	const lo = Math.log10(5),
		hi = Math.log10(10000);
	const y = (ns: number) => top + ph - ((Math.log10(ns) - lo) / (hi - lo)) * ph;
	const labels = ["0", "32 KiB", "256 KiB"];
	let b = "";
	MACHINES.forEach((mc, p) => {
		const ox = left + p * (pw + gap);
		const x = (i: number) => ox + 16 + (i / 2) * (pw - 40);
		b += `<text class="panel" x="${ox}" y="16">${mc.label}</text>`;
		for (const t of ticks) {
			b += `<line class="grid" x1="${ox}" x2="${ox + pw}" y1="${y(t)}" y2="${y(t)}"/>`;
			if (p === 0)
				b += `<text class="tick" x="${ox - 6}" y="${y(t) + 4}" text-anchor="end">${tickLabel(t)}</text>`;
		}
		labels.forEach((l, i) => { b += `<text class="tick" x="${x(i)}" y="${top + ph + 18}" text-anchor="middle">${l}</text>`; });
		for (const id of ["thread", "ucontext", "green"] as Mechanism[]) {
			const v = NS[mc.id][id];
			const pts = v
				.map((n, i) => `${x(i).toFixed(1)},${y(n).toFixed(1)}`)
				.join(" ");
			b += `<polyline class="line ${SERIES[id]}" points="${pts}"/>`;
			v.forEach((n, i) => { b += `<circle class="dot ${SERIES[id]}" cx="${x(i)}" cy="${y(n)}" r="3.5"><title>${mc.label}, ${labels[i]}, ${id}: ${fmt(n)}</title></circle>`; });
		}
	});
	return svg(
		left + 3 * (pw + gap) + 40,
		top + ph + 34,
		"Line charts of nanoseconds per handoff against working set size for thread, ucontext and green on three machines",
		b,
	);
}

const box = (
	x: number,
	y: number,
	w: number,
	h: number,
	text: string,
	cls = "box",
) =>
	`<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/><text class="boxtext" x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle">${text}</text>`;
const arrow = (x1: number, y1: number, x2: number, y2: number, cls = "arrow") =>
	`<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#ah)"/>`;
const defs = `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="head"/></marker></defs>`;

/** Figure 3: what one handoff does in the kernel versus in user space. */
export function paths(): string {
	let b = defs;
	b += `<text class="panel" x="10" y="18">Linux thread handoff (socket)</text>`;
	b += `<rect class="zone" x="10" y="72" width="690" height="60" rx="6"/><text class="zonelabel" x="20" y="88">kernel</text>`;
	b +=
		box(20, 28, 120, 36, "A: write()") +
		box(165, 96, 150, 30, "wake B, mark ready", "box k") +
		box(340, 96, 150, 30, "scheduler picks B", "box k") +
		box(515, 96, 150, 30, "switch stacks, mm", "box k") +
		box(540, 28, 130, 36, "B: read() returns");
	b +=
		arrow(80, 64, 220, 96) +
		arrow(315, 111, 340, 111) +
		arrow(490, 111, 515, 111) +
		arrow(590, 96, 605, 64);
	b += `<text class="panel" x="10" y="170">Green fiber handoff (user space)</text>`;
	b +=
		box(20, 184, 150, 36, "A: yield_now()") +
		box(255, 184, 190, 36, "push regs, swap sp, pop regs", "box u") +
		box(530, 184, 150, 36, "B resumes");
	b += arrow(170, 202, 255, 202) + arrow(445, 202, 530, 202);
	b += `<text class="note" x="10" y="250">Two syscalls, a wakeup and a scheduler pass versus one function call that returns on a different stack.</text>`;
	return svg(
		710,
		262,
		"Diagram comparing a kernel socket handoff with a user-space fiber switch",
		b,
	);
}

/** Figure 4: green scheduler cycle with a FIFO queue. */
export function scheduler(): string {
	let b = defs;
	b += box(260, 14, 180, 40, "scheduler (run loop)", "box s");
	b +=
		box(20, 150, 130, 40, "task 1", "box u") +
		box(285, 150, 130, 40, "task 2", "box u") +
		box(550, 150, 130, 40, "task 3", "box u");
	b +=
		arrow(150, 150, 270, 54, "arrow y") +
		arrow(285, 150, 335, 54, "arrow y") +
		arrow(560, 150, 440, 54, "arrow y");
	b += `<text class="note" x="35" y="115">yield_now</text><text class="note" x="355" y="115">yield_now</text><text class="note" x="575" y="115">finish</text>`;
	b += `<text class="panel" x="10" y="226">Run queue (FIFO)</text>`;
	["task 3", "task 1", "task 2"].forEach((t, i) => { b += box(180 + i * 100, 236, 90, 30, t, i === 0 ? "box u" : "box"); });
	b += `<text class="note" x="500" y="256">next out ← front, yielder → back</text>`;
	return svg(
		710,
		282,
		"Diagram of three green tasks yielding to a scheduler that dequeues the next task from a FIFO",
		b,
	);
}

/** Figure 5: the register frame swapped by one fiber switch. */
export function frames(): string {
	const col = (x: number, title: string, rows: string[], cls: string) => {
		let s = `<text class="panel" x="${x}" y="18">${title}</text>`;
		rows.forEach((r, i) => {
			s += box(x, 30 + i * 30, 170, 26, r, cls);
		});
		return s;
	};
	let b = defs;
	b += col(
		10,
		"Outgoing fiber stack",
		["callee-saved regs", "return address", "frame…"],
		"box u",
	);
	b += col(
		270,
		"Incoming fiber stack",
		["callee-saved regs", "return address", "frame…"],
		"box s",
	);
	b += box(520, 30, 170, 26, "stack pointer: sp", "box k");
	b +=
		arrow(180, 52, 270, 52) +
		`<text class="note" x="184" y="36">1 push, save sp</text>`;
	b +=
		arrow(440, 73, 520, 50) +
		`<text class="note" x="446" y="96">2 load sp</text>`;
	b += `<text class="note" x="10" y="140">3 pop registers, then ret resumes the incoming fiber. No signal mask, no syscall, no kernel.</text>`;
	return svg(
		710,
		154,
		"Diagram of saving callee-saved registers and swapping the stack pointer between two fibers",
		b,
	);
}
