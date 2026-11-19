// Median ns per handoff, one run per machine. Copied from results/aws/20261118T232639Z/*/bench.csv
// (git-ignored) so the page builds without the raw data.

export type Machine = "c7i" | "c7a" | "c7g";
export type Mechanism =
	| "thread"
	| "process"
	| "ucontext"
	| "regswitch"
	| "green"
	| "socket"
	| "work";

export const MACHINES: {
	id: Machine;
	label: string;
	arch: string;
	run: string;
}[] = [
	{ id: "c7i", label: "Intel c7i.large", arch: "x86-64", run: "Nov. 18" },
	{ id: "c7a", label: "AMD c7a.large", arch: "x86-64", run: "Nov. 18" },
	{ id: "c7g", label: "Graviton c7g.large", arch: "AArch64", run: "Nov. 18" },
];

export const MECHANISMS: { id: Mechanism; label: string; note: string }[] = [
	{
		id: "socket",
		label: "Socket baseline",
		note: "Socket calls without a second task",
	},
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
];

/** Working-set sizes in bytes. */
export const WORKING_SETS = [0, 32768, 262144] as const;

/** ns per handoff, indexed by working set (controls are present at every size). */
export const NS: Record<Machine, Record<Mechanism, number[]>> = {
	c7i: {
		work: [1.9, 308.7, 4758.4],
		thread: [1731.6, 2359.2, 6505.2],
		process: [1796.4, 2421.2, 6580.2],
		ucontext: [218.8, 788.8, 4991.5],
		regswitch: [12.5, 597.0, 4767.8],
		green: [31.7, 602.3, 4799.5],
		socket: [898.7, 1067.7, 5604.7],
	},
	c7a: {
		work: [1.7, 283.3, 2229.3],
		thread: [5241.0, 5477.6, 7565.2],
		process: [5148.1, 5421.1, 7581.7],
		ucontext: [574.0, 849.7, 2814.1],
		regswitch: [9.3, 298.9, 2249.7],
		green: [26.6, 321.7, 2349.6],
		socket: [2726.2, 3187.6, 4969.7],
	},
	c7g: {
		work: [2.3, 388.4, 4862.8],
		thread: [2497.9, 2974.3, 7922.2],
		process: [5089.4, 5491.0, 10505.7],
		ucontext: [519.6, 991.4, 5672.1],
		regswitch: [11.6, 437.8, 5125.9],
		green: [36.2, 468.3, 4941.8],
		socket: [1359.7, 1800.0, 6865.3],
	},
};

/** Jansen, Newsome, Wails, USENIX ATC 2022, Figure 16: same-core Unix socket round trip, 6.3 us, so 3.15 us per handoff. */
export const REFERENCE_NS = 3150;
