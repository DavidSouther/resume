import {
	div,
	figcaption,
	figure,
	h1,
	h2,
	p,
	section,
	style,
	table,
	tbody,
	td,
	th,
	thead,
	tr,
} from "@davidsouther/jiffies/dom/html.ts";
import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { Layout } from "../../../../src/components/layout.ts";
import { pageHead } from "../../../../src/lib/page-head.ts";
import { MACHINES, MECHANISMS, NS } from "./data.ts";
import { frames, ladder, paths, scheduler, sweep } from "./figures.ts";

// Page role: a scrolling write-up of the ctxswitch experiment. Every figure is
// static inline SVG generated from data.ts, so the page needs no client script.

const CSS = `
.root.cs-root > header { display: block; background: Canvas; color: CanvasText; max-width: 56rem; margin: 0 auto; padding: 1rem; }
.cs-root { --m-a: light-dark(#1d4ed8, #7aa2ff); --m-b: light-dark(#b45309, #f5b04c); --m-c: light-dark(#0f766e, #4fd1b5);
  --u: light-dark(#0f766e, #4fd1b5); --k: light-dark(#b91c1c, #ff8a80); --grid: color-mix(in srgb, currentColor 18%, transparent); }
.cs-page { max-width: 56rem; margin: 0 auto; padding: 0 1rem 4rem; }
.cs-page section { margin: 2.5rem 0; }
.cs-page figure { margin: 1rem 0; }
.cs-page figcaption { font-size: 0.85rem; opacity: 0.75; margin-top: 0.4rem; }
.cs-lede { font-size: 1.15rem; }
.cs-legend { display: flex; flex-wrap: wrap; gap: 0.4rem 1.2rem; font-size: 0.85rem; margin: 0.5rem 0; }
.cs-legend i { display: inline-block; width: 0.9rem; height: 0.9rem; border-radius: 2px; margin-right: 0.35rem; vertical-align: -0.1rem; }
.cs-callout { border-left: 4px solid var(--m-b); padding: 0.4rem 1rem; background: color-mix(in srgb, var(--m-b) 10%, Canvas); }
.cs-table { overflow-x: auto; }
.cs-table table { border-collapse: collapse; font-size: 0.85rem; width: 100%; }
.cs-table th, .cs-table td { border: 1px solid var(--grid); padding: 0.25rem 0.6rem; text-align: right; }
.cs-table th:first-child, .cs-table td:first-child, .cs-table td:last-child { text-align: left; }
.cs-close { font-size: 1.3rem; font-style: italic; border-top: 2px solid currentColor; padding-top: 1rem; }
svg.fig { width: 100%; height: auto; font-family: inherit; fill: currentColor; }
svg.fig text { font-size: 12px; }
svg.fig .tick, svg.fig .note, svg.fig .zonelabel { font-size: 11px; opacity: 0.7; }
svg.fig .panel { font-weight: 600; font-size: 13px; }
svg.fig .rowlabel, svg.fig .val { font-size: 12px; }
svg.fig .grid { stroke: var(--grid); stroke-width: 1; }
svg.fig .ref { stroke: var(--k); stroke-width: 1.5; stroke-dasharray: 5 4; }
svg.fig .reftext { fill: var(--k); font-size: 11px; }
svg.fig .m-a { fill: var(--m-a); } svg.fig .m-b { fill: var(--m-b); } svg.fig .m-c { fill: var(--m-c); }
svg.fig .line { fill: none; stroke-width: 2.5; }
svg.fig .s-thread { stroke: var(--k); } svg.fig .s-uctx { stroke: var(--m-b); } svg.fig .s-green { stroke: var(--u); }
svg.fig circle.s-thread { fill: var(--k); } svg.fig circle.s-uctx { fill: var(--m-b); } svg.fig circle.s-green { fill: var(--u); }
svg.fig text.s-thread { fill: var(--k); } svg.fig text.s-uctx { fill: var(--m-b); } svg.fig text.s-green { fill: var(--u); }
svg.fig .box { fill: color-mix(in srgb, currentColor 8%, Canvas); stroke: currentColor; stroke-width: 1.2; }
svg.fig .box.u { fill: color-mix(in srgb, var(--u) 22%, Canvas); stroke: var(--u); }
svg.fig .box.k { fill: color-mix(in srgb, var(--k) 18%, Canvas); stroke: var(--k); }
svg.fig .box.s { fill: color-mix(in srgb, var(--m-a) 20%, Canvas); stroke: var(--m-a); }
svg.fig .boxtext { fill: currentColor; font-size: 12px; }
svg.fig .zone { fill: none; stroke: var(--k); stroke-dasharray: 4 4; opacity: 0.7; }
svg.fig .arrow { stroke: currentColor; stroke-width: 1.5; } svg.fig .arrow.y { stroke: var(--u); }
svg.fig .head { fill: currentColor; }
`;

const raw = (html: string): HTMLElement =>
	Object.assign(div(), { innerHTML: html });
const prose = (html: string): HTMLElement =>
	Object.assign(p(), { innerHTML: html });
const fig = (svgHtml: string, caption: string): HTMLElement =>
	figure(raw(svgHtml), figcaption(caption));
const legend = (items: [string, string][]): HTMLElement =>
	raw(
		`<div class="cs-legend">${items.map(([c, l]) => `<span><i style="background:var(${c})"></i>${l}</span>`).join("")}</div>`,
	);

function resultsTable(): HTMLElement {
	const cell = (n: number) =>
		n < 100 ? `${(n / 1000).toFixed(4)}` : (n / 1000).toFixed(3);
	return div(
		{ class: "cs-table" },
		table(
			thead(
				tr(
					th("Mechanism"),
					...MACHINES.map((m) => th(m.label)),
					th("What it includes"),
				),
			),
			tbody(
				...MECHANISMS.map((m) =>
					tr(
						td(m.label),
						...MACHINES.map((mc) => td(cell(NS[mc.id][m.id][0]))),
						td(m.note),
					),
				),
			),
		),
	);
}

export default {
	head: () => [
		...pageHead("What a Context Switch Costs: David Souther"),
		style({}, CSS),
	],
	default: () =>
		Layout(
			{
				lastUpdate: new Date().toISOString(),
				class: "cs-root",
				header: [
					h1("What does a context switch cost?"),
					p(
						{ class: "cs-lede" },
						"We measured five ways to transfer control between tasks on EC2, with both tasks pinned to one CPU.",
					),
				],
			},
			div(
				{ class: "cs-page" },
				section(
					h2("1. What are we measuring?"),
					prose(
						"A <strong>handoff</strong> transfers execution from task A to task B. A round trip A → B → A is two handoffs. The cost depends on how the switch is performed. Saving registers takes time; scheduling, waking tasks, synchronization, and changes in cache locality can add more.",
					),
					fig(
						paths(),
						"A kernel handoff goes through syscalls, a wakeup and the scheduler. A fiber handoff is a function call that returns on another stack.",
					),
					prose(
						'<strong>Independent reference.</strong> Jansen, Newsome and Wails (<a href="https://www.usenix.org/system/files/atc22-jansen.pdf">USENIX ATC 2022, Figure 16</a>) measured Linux processes using a Unix socket on one core. They found 6.3 µs per round trip, or about <strong>3.15 µs per handoff</strong>. This measures the whole socket handoff and gives us a rough reference for comparison.',
					),
				),
				section(
					h2("2. The experiment"),
					prose(
						"The <code>switchbench</code> program compares two Linux threads, two processes, glibc <code>ucontext</code>, a register-only fiber, and a small green-thread scheduler. Two tasks share one pinned CPU. Each repetition performs 200,000 handoffs. We report the median of five repetitions after a warmup. The threads and processes exchange one byte over a Unix socket. Each task touches its own working set.",
					),
					prose(
						"Runs were EC2 instances in Debian 13 containers limited to one CPU and 256 MiB: Intel on Nov. 4, AMD and Graviton on Nov. 18.",
					),
				),
				section(
					h2("3. Results at zero working set"),
					legend([
						["--m-a", "Intel m7i"],
						["--m-b", "AMD c7a"],
						["--m-c", "Graviton c7g"],
					]),
					fig(
						ladder(),
						"Nanoseconds per handoff on a log axis. Each step to the right is ten times slower. The dashed line is the Jansen et al. socket reference.",
					),
					resultsTable(),
					p("Values are µs per handoff."),
					div(
						{ class: "cs-callout" },
						prose(
							"Thread and process handoffs take 0.54 to 1.70 times the published 3.15 µs reference. All are in the microsecond range, but the hardware and kernel differ. Subtracting the socket baseline gives rough additional thread costs of 2.49 µs (AMD) and 1.12 µs (Graviton). These are not isolated kernel switch costs.",
						),
					),
					prose(
						"With no working-set access, a green handoff costs <strong>26 to 34 ns</strong>, and a Linux thread handoff costs <strong>1.7 to 5.2 µs</strong>. Green tasks switch cooperatively; Linux threads are scheduled by the kernel and use a socket to coordinate in this test.",
					),
				),
				section(
					h2("4. Adding memory access"),
					legend([
						["--k", "Linux thread"],
						["--m-b", "glibc ucontext"],
						["--u", "Green scheduler"],
					]),
					fig(
						sweep(),
						"Nanoseconds per handoff as each task touches a larger working set. The vertical axis is logarithmic. These measurements include the work of touching memory.",
					),
					prose(
						"At 256 KiB per task, green handoffs take 2.28 µs on AMD and 4.99 µs on Graviton. Thread handoffs take 7.49 and 7.60 µs. These measurements include both the handoff and the buffer-touch loop. We did not measure cache misses, so we cannot say how much of the increase comes from cache locality.",
					),
				),
				section(
					h2("5. How the green threads work"),
					fig(
						scheduler(),
						"Every task runs until it calls yield_now or finishes. A yielding task goes to the back of a FIFO queue: task → scheduler → task.",
					),
					fig(
						frames(),
						"One switch pushes callee-saved registers, swaps the stack pointer, pops the incoming registers, and returns into the suspended code. x86-64 and AArch64 frames differ.",
					),
					raw(`<ol>
<li><code>spawn</code> allocates a <strong>32 KiB guarded stack</strong>, builds an initial frame pointing at a trampoline and the task entry, and queues the task.</li>
<li><code>run</code> switches from the scheduler's stack to the next task's stack.</li>
<li><code>yield_now</code> requeues the current task and switches back to the scheduler, which picks the next one.</li>
<li>Assembly saves ABI callee-saved registers and the stack pointer. This is cooperative, and no signal mask is saved per switch.</li>
<li>When the closure finishes, its result is stored for <code>JoinHandle::take</code> and the guarded stack is released.</li>
</ol>`),
					prose(
						'All green tasks run on one OS thread, so the kernel sees one schedulable task. A blocking syscall blocks every task, and a task that never yields starves its peers. This is a single-worker teaching implementation, not the M:N work-stealing runtime in <a href="https://dzania.github.io/green-threads-from-scratch/">Green Threads from Scratch</a>. Code is in <code>src/green.rs</code>, <code>src/regswitch.rs</code> and <code>src/stack.rs</code>.',
					),
				),
				section(
					h2("6. Caveats"),
					raw(`<ul>
<li>One run per machine; values are medians within a run, not confidence intervals across independent runs.</li>
<li>The Nov. 18 Intel c7i Spot request failed for insufficient capacity, so Intel is the Nov. 4 m7i run. A second Nov. 4 Intel c6i run measured 1.96 µs per thread handoff and 2.06 µs per process handoff.</li>
<li>VM scheduling, CPU architecture and container limits matter. Thread versus process differences alone do not establish page-table switch or TLB cost.</li>
<li>Creation cost and cross-core handoffs are not measured.</li>
</ul>`),
				),
				p(
					{ class: "cs-close" },
					"The cost depends on the work being measured. In this experiment, a green handoff with no working-set access takes tens of nanoseconds. A Linux handoff using a socket takes microseconds. Touching memory adds to both measurements.",
				),
			),
		),
	clientModules: [],
} satisfies PageModule;
