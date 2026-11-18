// Median ns per handoff, one run per machine. Copied from results/aws/*/bench.csv
// (git-ignored) so the page builds without the raw data.

export type Machine = "m7i" | "c7a" | "c7g";
export type Mechanism =
	| "thread"
	| "process"
	| "ucontext"
	| "regswitch"
	| "green"
	| "socket";

export const MACHINES: {
	id: Machine;
	label: string;
	arch: string;
	run: string;
}[] = [
	{ id: "m7i", label: "Intel m7i.large", arch: "x86-64", run: "Nov. 4" },
	{ id: "c7a", label: "AMD c7a.large", arch: "x86-64", run: "Nov. 18" },
	{ id: "c7g", label: "Graviton c7g.large", arch: "AArch64", run: "Nov. 18" },
];

export const MECHANISMS: { id: Mechanism; label: string; note: string }[] = [
	{
		id: "thread",
		label: "Linux thread",
		note: "Socket calls, wakeup and scheduling",
	},
	{
		id: "process",
		label: "Linux process",
		note: "Same socket handoff across processes",
	},
	{
		id: "ucontext",
		label: "glibc ucontext",
		note: "Context switch and signal-mask syscalls",
	},
	{
		id: "green",
		label: "Green scheduler",
		note: "Two fiber switches through scheduler and queue",
	},
	{
		id: "regswitch",
		label: "Register fiber",
		note: "Save/restore registers and stack pointer",
	},
	{
		id: "socket",
		label: "Socket baseline",
		note: "Socket calls without a second task",
	},
];

/** Working-set sizes in bytes. */
export const WORKING_SETS = [0, 32768, 262144] as const;

/** ns per handoff, indexed by working set (socket baseline is zero-set only). */
export const NS: Record<Machine, Record<Mechanism, number[]>> = {
	m7i: {
		thread: [1704.2, 2156.1, 5969.8],
		process: [1779.5, 2226.6, 6029.2],
		ucontext: [199.4, 725.5, 4621.3],
		regswitch: [10.8, 550.4, 4421.4],
		green: [28.9, 560.8, 4442.5],
		socket: [879.4],
	},
	c7a: {
		thread: [5221.8, 5533.0, 7494.5],
		process: [5267.4, 5541.8, 7649.6],
		ucontext: [575.5, 851.7, 2814.3],
		regswitch: [8.9, 298.3, 2252.9],
		green: [25.8, 318.3, 2279.6],
		socket: [2733.0],
	},
	c7g: {
		thread: [2476.0, 2961.5, 7597.5],
		process: [5354.3, 5230.1, 9197.4],
		ucontext: [519.6, 986.2, 5747.6],
		regswitch: [11.0, 434.1, 5189.0],
		green: [34.3, 459.3, 4988.4],
		socket: [1357.0],
	},
};

/** Jansen, Newsome, Wails, USENIX ATC 2022, Figure 16: same-core Unix socket round trip, 6.3 us, so 3.15 us per handoff. */
export const REFERENCE_NS = 3150;
