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
import {
	MACHINES,
	type Machine,
	MECHANISMS,
	type Mechanism,
	NS,
} from "./data.ts";
import { direct, frames, ladder, scheduler, sweep } from "./figures.ts";

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
.cs-toggle input { position: absolute; opacity: 0; }
.cs-toggle label { display: inline-block; cursor: pointer; border: 1px solid currentColor; padding: 0.35rem 1rem; }
.cs-toggle input:checked + label { background: CanvasText; color: Canvas; }
.cs-toggle input:focus-visible + label { outline: 3px solid var(--m-a); outline-offset: 2px; }
.cs-toggle .direct-view { display: none; }
.cs-toggle #chart-direct:checked ~ .total-view { display: none; }
.cs-toggle #chart-direct:checked ~ .direct-view { display: block; }
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
svg.fig .axis-center { stroke: currentColor; stroke-width: 1.5; }
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

function indirectTable(): HTMLElement {
	const rows: [Mechanism, string, "socket" | "work"][] = [
		["thread", "Linux thread", "socket"],
		["regswitch", "Register fiber", "work"],
		["green", "Green scheduler", "work"],
	];
	const increment = (
		machine: Machine,
		mechanism: Mechanism,
		control: "socket" | "work",
		size: number,
	) => {
		const values = NS[machine];
		return (
			values[mechanism][size] -
			values[control][size] -
			(values[mechanism][0] - values[control][0])
		).toFixed(1);
	};
	return div(
		{ class: "cs-table" },
		table(
			thead(
				tr(th("Mechanism / working set"), ...MACHINES.map((m) => th(m.label))),
			),
			tbody(
				...rows.flatMap(([mechanism, label, control]) =>
					[1, 2].map((size) =>
						tr(
							td(`${label} / ${size === 1 ? "32" : "256"} KiB`),
							...MACHINES.map((m) =>
								td(increment(m.id, mechanism, control, size)),
							),
						),
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
						"Twenty years later, what does a task handoff cost—and what happens when the task resumes?",
					),
				],
			},
			div(
				{ class: "cs-page" },
				section(
					h2("1. What are we measuring?"),
					prose(
						"A <strong>handoff</strong> transfers execution from task A to task B. A round trip A → B → A is two handoffs.",
					),
					prose(
						"A <strong>direct cost</strong> is the work of handing off: saving state, scheduling, synchronization and wakeup. An <strong>indirect cost</strong> is extra work after resumption, including cache and translation misses. Interrupts can also disturb a task without scheduling another.",
					),
					prose(
						'<a href="https://www.cs.rochester.edu/u/kshen/papers/expcs2007.pdf">Li, Ding and Shen’s 2007 study</a> estimated a 3.8 µs direct cost on a Pentium Xeon. Its synthetic total estimates ranged from several microseconds to over a millisecond as working set and access pattern changed.',
					),
					prose(
						'Modern CPUs can retain translations using address-space tags; <a href="https://kernel.org/doc/html/v5.18/x86/pti.html">page-table isolation</a> adds work to some kernel transitions. In a <a href="https://arxiv.org/abs/2508.15703">2025 serverless study</a>, scheduler time reached 28% of CPU time at the highest tested colocation level.',
					),
					prose(
						'<strong>Independent reference.</strong> Jansen, Newsome and Wails (<a href="https://www.usenix.org/system/files/atc22-jansen.pdf">USENIX ATC 2022, Figure 16</a>) measured Linux processes using a Unix socket on one core. They found 6.3 µs per round trip, or about <strong>3.15 µs per handoff</strong>. This measures the whole socket handoff and gives us a rough reference for comparison.',
					),
				),
				section(
					h2("2. The experiment"),
					prose(
						"The <code>switchbench</code> program compares Linux threads, processes, glibc <code>ucontext</code>, a register-only fiber and a green-thread scheduler. All participants are pinned to one logical CPU. The thread and process tests pass a one-byte token over a Unix socket: one side writes and waits for a reply while the other reads, touches its buffer and replies. The user-space tests transfer control explicitly between two flows on one OS thread.",
					),
					prose(
						"Each task reads and increments one byte every 64 bytes of its private buffer. We test 0, 32 KiB and 256 KiB per task. After one warmup, each of five repetitions times 200,000 planned handoffs using a monotonic clock. We divide elapsed time by the planned count and report the median. Kernel switch counters come from that median repetition; they include additional switches caused by preemption.",
					),
					prose(
						"We use the median of the five repetition averages to reduce the influence of an unusually slow repetition caused by scheduling or VM noise. Li’s paper uses averages over repeated round trips. Our subtraction combines separately measured medians; it does not report the average cost or the median of paired differences.",
					),
					prose(
						"The socket control touches one buffer and writes and reads its own socket without a peer. The memory control touches one buffer without a handoff. Each uses the same number of buffer touches per planned handoff. We subtract the matching control at each working-set size to estimate the additional handoff cost.",
					),
					prose(
						"The Nov. 18 EC2 instances ran Debian 13 with Docker 26.1.5. Each instance exposed two virtual CPUs; the container was limited to one CPU and 256 MiB. Cache sizes below are the totals and instance counts reported by lscpu inside each virtual machine.",
					),
					raw(`<div class="cs-table"><table><thead><tr><th>Instance</th><th>CPU and topology</th><th>Linux kernel</th><th>L1 data</th><th>L2</th><th>L3</th></tr></thead><tbody>
<tr><td>Intel c7i.large</td><td>Xeon Platinum 8488C; 2 threads, 1 core</td><td>6.12.117+deb13-cloud-amd64</td><td>48 KiB (1)</td><td>2 MiB (1)</td><td>105 MiB (1)</td></tr>
<tr><td>AMD c7a.large</td><td>EPYC 9R14; 2 cores, 1 thread/core</td><td>6.12.117+deb13-cloud-amd64</td><td>64 KiB (2)</td><td>2 MiB (2)</td><td>8 MiB (1)</td></tr>
<tr><td>Graviton c7g.large</td><td>Neoverse V1; 2 cores, 1 thread/core</td><td>6.12.117+deb13-cloud-arm64</td><td>128 KiB (2)</td><td>2 MiB (2)</td><td>32 MiB (1)</td></tr>
</tbody></table></div>`),
				),
				section(
					h2("3. Results at zero working set"),
					legend([
						["--m-a", "Intel c7i"],
						["--m-b", "AMD c7a"],
						["--m-c", "Graviton c7g"],
					]),
					raw(`<div class="cs-toggle" role="group" aria-label="Kernel handoff chart view">
<input type="radio" name="chart-view" id="chart-total" checked><label for="chart-total">Total</label>
<input type="radio" name="chart-view" id="chart-direct"><label for="chart-direct">Direct</label>
<figure class="total-view">${ladder("kernel")}<figcaption>Total elapsed time per handoff.</figcaption></figure>
<figure class="direct-view">${direct()}<figcaption>Socket baseline to the left; additional handoff time to the right.</figcaption></figure>
</div>`),
					prose(
						"The left side shows the socket baseline, an indirect component of this handoff measurement. The right side subtracts that baseline from the thread or process total. This baseline measures socket operations; it does not measure the indirect cache cost discussed below.",
					),
					fig(
						ladder("user"),
						"User-space handoffs at zero working set, on a logarithmic axis.",
					),
					resultsTable(),
					p("Values are µs per handoff."),
					div(
						{ class: "cs-callout" },
						prose(
							"Subtracting the socket control gives rough additional thread handoff costs of 0.83 µs (Intel), 2.51 µs (AMD), and 1.14 µs (Graviton). These include blocking and wakeup differences and are not isolated kernel switch costs.",
						),
					),
					prose(
						"With no working-set access, a green handoff costs <strong>27 to 36 ns</strong>, and a Linux thread handoff costs <strong>1.7 to 5.2 µs</strong>. Green tasks switch cooperatively; Linux threads are scheduled by the kernel and use a socket to coordinate in this test.",
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
						"At 256 KiB per task, green handoffs take 2.35 µs on AMD and 4.94 µs on Graviton. The corresponding single-task buffer controls take 2.23 and 4.86 µs.",
					),
				),
				section(
					h2("5. Register fibers and green threads"),
					prose(
						"A register fiber provides the control-transfer mechanism: it switches directly to a known peer. A green thread is a task managed by a scheduler built on that mechanism. A green handoff runs task A → scheduler → task B, adding queue work and two fiber switches.",
					),
					fig(
						scheduler(),
						"A yielding task goes to the back of the FIFO queue.",
					),
					fig(
						frames(),
						"One switch pushes callee-saved registers, swaps the stack pointer, pops the incoming registers, and returns into the suspended code. x86-64 and AArch64 frames differ.",
					),
					raw(`<ol>
<li><code>spawn</code> maps a <strong>32 KiB stack</strong> with a guard page, builds an initial frame pointing at a trampoline and the task entry, and queues the task.</li>
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
					h2("6. Estimating indirect cost"),
					prose(
						"At 32 KiB, the Intel thread estimate adds 459 ns per handoff above the zero-size estimate; at 256 KiB it adds 68 ns. On Graviton, the 256 KiB estimate is −81 ns. These figures subtract a no-handoff control at each size and then subtract the zero-size difference.",
					),
					raw(
						`<div class="cs-callout"><p><strong>Estimated total at size</strong> = handoff and work − matched control<br><strong>Estimated increment</strong> = estimated total at size − estimated total at zero</p></div>`,
					),
					prose(
						"The control repeatedly touches one hot buffer; the socket control also reads and writes without a second task. Its read does not block or wake a peer. The estimates are differences of separately measured medians, so noise and imperfect matching can produce negative values.",
					),
					indirectTable(),
					p(
						"Estimated increment in ns per planned handoff, computed from the median rows above and their matching controls.",
					),
					prose(
						'The Graviton thread repetition at 256 KiB recorded 113,220 involuntary switches for 200,000 planned handoffs. The CSV pairs kernel switch counters with the median timed repetition. For another working-set control, see <a href="https://lmbench.sourceforge.net/man/lat_ctx.8.html">lmbench’s lat_ctx</a>.',
					),
					prose(
						"Each machine contributed one run; the five repetitions share the same instance and measurement order. No cache or TLB counters were collected. The controls use one hot buffer rather than two private buffers, and the socket control does not reproduce blocking or wakeup. These differences limit what the subtraction can attribute to the switch itself.",
					),
				),
				p(
					{ class: "cs-close" },
					"The handoff is only the beginning. The work that resumes afterward—and the scheduler load around it—helps determine what the application actually pays.",
				),
			),
		),
	clientModules: [],
} satisfies PageModule;
