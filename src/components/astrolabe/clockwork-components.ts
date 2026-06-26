import { type DomAttrs, up } from "@davidsouther/jiffies/dom/dom.ts";
import { FCC } from "@davidsouther/jiffies/dom/fc.ts";
import {
	article,
	button,
	div,
	h2,
	h3,
	section,
	span,
} from "@davidsouther/jiffies/dom/html.ts";
import {
	svg as buildSvg,
	circle,
	g,
	line,
	text,
} from "@davidsouther/jiffies/dom/svg.ts";
import {
	formatSignedRate,
	GOING_TRAIN,
	type MotionTrain,
	motionTrainForMode,
} from "../../lib/astrolabe/clockwork.ts";

type EventMap = NonNullable<DomAttrs["events"]>;

const GEAR_POINTS = [
	{ id: "barrel", x: 58, y: 92, r: 35 },
	{ id: "center", x: 133, y: 92, r: 29 },
	{ id: "third", x: 193, y: 72, r: 25 },
	{ id: "fourth", x: 248, y: 100, r: 22 },
	{ id: "escape", x: 298, y: 74, r: 14 },
	{ id: "balance", x: 338, y: 112, r: 23 },
];

function gearDurationSeconds(speed: number): number {
	const safeSpeed = Number.isFinite(speed) && speed > 0 ? speed : 1;
	return Math.max(0.7, 28 / Math.max(1, Math.log10(safeSpeed + 1)));
}

function gearDiagram() {
	return buildSvg(
		{
			class: "clockwork-map",
			viewBox: "0 0 396 174",
			role: "img",
			"aria-label": "Going train gear map",
		},
		g(
			{ class: "clockwork-links" },
			...GEAR_POINTS.slice(0, -1).map((point, i) => {
				const next = GEAR_POINTS[i + 1];
				return line({
					x1: point.x,
					y1: point.y,
					x2: next.x,
					y2: next.y,
				});
			}),
		),
		g(
			{ class: "clockwork-gears" },
			...GEAR_POINTS.map((point, i) =>
				g(
					{
						class: `clock-gear clock-gear-${point.id}`,
						"data-gear": point.id,
						transform: `rotate(${i * 17} ${point.x} ${point.y})`,
					},
					circle({ cx: point.x, cy: point.y, r: point.r }),
					circle({ cx: point.x, cy: point.y, r: Math.max(4, point.r * 0.18) }),
					text(
						{
							x: point.x,
							y: point.y + point.r + 17,
							"text-anchor": "middle",
						},
						point.id.toUpperCase(),
					),
				),
			),
		),
	);
}

function goingTrainTable() {
	return div(
		{ class: "clockwork-list going-train" },
		div({ class: "clockwork-caption" }, "Going train"),
		div(
			{ class: "clockwork-row clockwork-head going-row" },
			span({}, "Wheel"),
			span({}, "Pinion"),
			span({}, "Teeth"),
			span({}, "Rate"),
			span({}, "Arbor"),
		),
		...GOING_TRAIN.map((row) =>
			div(
				{ class: "clockwork-row going-row", "data-wheel": row.id },
				span({}, row.wheel),
				span({}, String(row.pinionTeeth)),
				span({}, String(row.teeth)),
				span({}, row.rateLabel),
				span({}, row.arbor),
			),
		),
	);
}

function motionTrainTable(train: MotionTrain) {
	return div(
		{
			class: `clockwork-list motion-train motion-train-${train.id}`,
			"data-motion-train": train.id,
		},
		div({ class: "clockwork-caption" }, `${train.label} motion train`),
		div(
			{ class: "clockwork-row clockwork-head motion-row" },
			span({}, "Disk"),
			span({}, "Arbor"),
			span({}, "Rate"),
			span({}, "Mechanism"),
		),
		div(
			{ class: "clockwork-row branch-row" },
			span({}, "Branch"),
			span({}, train.branchArbor),
		),
		...train.rows.map((row) =>
			div(
				{
					class:
						row.kind === "orbital"
							? "clockwork-row motion-row orbital-row"
							: "clockwork-row motion-row reference-row",
					"data-orbit-arbor": row.kind === "orbital" ? row.arbor : false,
				},
				span({}, row.disk),
				span({}, row.arbor),
				span({}, formatSignedRate(row.relativeRate)),
				span({}, row.mechanism),
			),
		),
	);
}

export type ClockworkRearFaceProps = {
	mode?: string;
	speed?: number;
	flipped?: boolean;
	events?: EventMap;
};

export const ClockworkRearFace = FCC<ClockworkRearFaceProps>(
	"astro-clockwork-rear",
	() =>
		section({
			id: "caseback",
			class: "caseback",
			"aria-label": "Astrolabe rear clockwork",
		}),
	(el, attrs) => {
		const speed = attrs.speed ?? 1;
		const train = motionTrainForMode(attrs.mode);
		up(el, {
			class: attrs.flipped ? "flipped" : "!flipped",
			"data-flipped": String(Boolean(attrs.flipped)),
			"data-mode": train.id,
			"data-speed": String(speed),
			style: `--gear-duration:${gearDurationSeconds(speed).toFixed(2)}s`,
		});
		return [
			div(
				{ class: "caseback-head" },
				div(
					{},
					span({ class: "caseback-kicker" }, "Rear face"),
					h2({}, "Clockwork"),
				),
				button(
					{
						id: "flipCase",
						class: attrs.flipped ? "caseback-flip active" : "caseback-flip",
						type: "button",
						"aria-pressed": String(Boolean(attrs.flipped)),
					},
					attrs.flipped ? "Front" : "Flip",
				),
			),
			gearDiagram(),
			article(
				{ class: "caseback-block" },
				h3({}, "Going train"),
				goingTrainTable(),
			),
			article(
				{ class: "caseback-block motion-block" },
				h3({}, "Motion train"),
				motionTrainTable(train),
			),
		];
	},
);
