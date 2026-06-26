import { BODIES, EARTH_YEAR, FULLNAME } from "./bodies.ts";
import { displayedRate } from "./math.ts";
import type { Body } from "./types.ts";
import { GALILEAN } from "./types.ts";

const EARTH_RATE_DEG_PER_SECOND = 360 / EARTH_YEAR;

export interface GoingTrainRow {
	id: string;
	wheel: string;
	pinionTeeth: number;
	teeth: number;
	rph?: number;
	rateLabel: string;
	arbor: string;
}

export interface MotionTrainRow {
	kind: "reference" | "orbital";
	disk: string;
	arbor: string;
	relativeRate: number;
	direction: "forward" | "reverse" | "locked";
	ratioLabel: string;
	mechanism: string;
}

export type ClockworkMode = "ptolemaic" | "galilean" | "keplerian";

export interface MotionTrain {
	id: ClockworkMode;
	label: string;
	branchArbor: string;
	rows: MotionTrainRow[];
}

export const GOING_TRAIN: readonly GoingTrainRow[] = [
	{
		id: "barrel",
		wheel: "Barrel",
		pinionTeeth: 0,
		teeth: 80,
		rph: 0.125,
		rateLabel: "0.125 RPH",
		arbor: "Mainspring, 5 windings for ~40 hr reserve",
	},
	{
		id: "center",
		wheel: "Center Wheel",
		pinionTeeth: 10,
		teeth: 80,
		rph: 1,
		rateLabel: "1 RPH",
		arbor: "Minute / cannon pinion reference",
	},
	{
		id: "third",
		wheel: "Third Wheel",
		pinionTeeth: 10,
		teeth: 75,
		rph: 8,
		rateLabel: "8 RPH",
		arbor: "Intermediate train",
	},
	{
		id: "fourth",
		wheel: "Fourth Wheel",
		pinionTeeth: 10,
		teeth: 60,
		rph: 60,
		rateLabel: "60 RPH",
		arbor: "Seconds hand",
	},
	{
		id: "escape",
		wheel: "Escape Wheel",
		pinionTeeth: 6,
		teeth: 15,
		rph: 600,
		rateLabel: "600 RPH",
		arbor: "Pallet fork / balance impulse",
	},
	{
		id: "balance",
		wheel: "Balance Wheel",
		pinionTeeth: 0,
		teeth: 0,
		rateLabel: "18,000 BPH",
		arbor: "Balance staff",
	},
];

function displayName(key: string): string {
	return FULLNAME[key] ?? key;
}

function directionOf(rate: number): MotionTrainRow["direction"] {
	if (Math.abs(rate) < 0.0005) return "locked";
	return rate > 0 ? "forward" : "reverse";
}

function formatYearRate(rate: number): string {
	const abs = Math.abs(rate);
	if (abs < 0.0005) return "locked";
	if (abs >= 10) return `${abs.toFixed(2)} rev/year`;
	return `${abs.toFixed(3)} rev/year`;
}

function motionRow(
	trainId: MotionTrain["id"],
	key: string,
	rate: number,
	mechanism: string,
): MotionTrainRow {
	const direction = directionOf(rate);
	return {
		kind: "orbital",
		disk: displayName(key),
		arbor: `${trainId}-${key}-arbor`,
		relativeRate: rate,
		direction,
		ratioLabel:
			direction === "locked"
				? "locked to reference"
				: `${direction} ${formatYearRate(rate)}`,
		mechanism,
	};
}

const siderealRows = (trainId: MotionTrain["id"], mechanism: string) =>
	BODIES.map((body) =>
		motionRow(trainId, body.key, 1 / body.period, mechanism),
	);

function ptolemaicMeanRate(body: Body): number {
	if (body.key === "earth") return 0;
	if (body.moon) return 1 / body.period;
	return 1 / body.period - 1;
}

const ptolemaicRows = () => [
	motionRow(
		"ptolemaic",
		"sun",
		1,
		"Annual solar deferent opposite the Earth center",
	),
	...BODIES.filter((body) => body.key !== "earth").map((body) =>
		motionRow(
			"ptolemaic",
			body.key,
			ptolemaicMeanRate(body),
			"Mean geocentric epicycle differential with display cam",
		),
	),
];

const galileanRows = () =>
	BODIES.map((body) =>
		motionRow(
			"galilean",
			body.key,
			displayedRate(body, GALILEAN) / EARTH_RATE_DEG_PER_SECOND,
			"Differential from the Earth annual arbor",
		),
	);

export const MODE_TRAINS: readonly MotionTrain[] = [
	{
		id: "ptolemaic",
		label: "Ptolemaic",
		branchArbor: "Center wheel, through Earth-center annual differential",
		rows: [
			{
				kind: "reference",
				disk: "Earth",
				arbor: "ptolemaic-earth-center",
				relativeRate: 0,
				direction: "locked",
				ratioLabel: "case center",
				mechanism: "Fixed geocentric dial center",
			},
			...ptolemaicRows(),
		],
	},
	{
		id: "galilean",
		label: "Galilean",
		branchArbor: "Center wheel, through Earth annual differential",
		rows: [
			{
				kind: "reference",
				disk: "Earth",
				arbor: "galilean-earth-reference",
				relativeRate: 0,
				direction: "locked",
				ratioLabel: "earth fixed",
				mechanism: "Case reference",
			},
			...galileanRows(),
		],
	},
	{
		id: "keplerian",
		label: "Keplerian",
		branchArbor: "Center wheel, through annual arbor plus equation cam",
		rows: [
			{
				kind: "reference",
				disk: "Sun",
				arbor: "keplerian-sun-center",
				relativeRate: 0,
				direction: "locked",
				ratioLabel: "focus reference",
				mechanism: "Stationary focus marker",
			},
			...siderealRows(
				"keplerian",
				"Sidereal reduction with per-disk equation cam",
			),
		],
	},
];

export function motionTrainForMode(mode: string | undefined): MotionTrain {
	return (
		MODE_TRAINS.find((train) => train.id === mode) ??
		MODE_TRAINS.find((train) => train.id === "galilean") ??
		MODE_TRAINS[0]
	);
}

export function escapeBeatsPerHour(): number {
	const escapeWheel = GOING_TRAIN.find((row) => row.id === "escape");
	if (!escapeWheel?.rph) return 0;
	return escapeWheel.rph * escapeWheel.teeth * 2;
}

export function goingTrainRatio(
	fromId: string,
	toId: string,
): number | undefined {
	const from = GOING_TRAIN.find((row) => row.id === fromId);
	const to = GOING_TRAIN.find((row) => row.id === toId);
	if (!from?.rph || !to?.rph) return undefined;
	return to.rph / from.rph;
}

export function formatSignedRate(rate: number): string {
	const direction = directionOf(rate);
	if (direction === "locked") return "locked";
	return `${direction} ${formatYearRate(rate)}`;
}
