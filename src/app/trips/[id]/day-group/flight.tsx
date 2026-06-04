import type { ReactNode } from "react";
import {
	fmtClock,
	type ItineraryItem,
	parseDateTime,
	tzAbbr,
} from "~/lib/itinerary-helpers";
import type { TripEnrichment } from "~/lib/trip-enrichment";
import styles from "../day-group.module.css";
import { TimelineItem } from "../timeline-item";
import { BtnLink } from "./btn-link";
import Fact, { Facts } from "./fact";

type FlightItemData = Extract<ItineraryItem, { kind: "flight" }>;

export function FlightItem({
	item,
	enrichment,
}: {
	item: FlightItemData;
	enrichment: TripEnrichment | undefined;
}) {
	const f = item.data;
	const dep = parseDateTime(f.depart?.datetime);
	const arr = parseDateTime(f.arrive?.datetime);
	const isNextDay = arr && dep && arr.date > dep.date;

	const row: ReactNode = (
		<>
			{dep && (
				<span className={styles["timeline-times"]}>
					<span>
						{fmtClock(dep.h, dep.min)} {tzAbbr(dep.date, f.depart?.timezone)}
					</span>
					<span className={styles.arrow}>—</span>
					{arr && (
						<span>
							{fmtClock(arr.h, arr.min)} {tzAbbr(arr.date, f.arrive?.timezone)}
						</span>
					)}
					{isNextDay && <span className={styles.plus1}>+1 day</span>}
				</span>
			)}
			<span className={styles.title}>
				<span className={styles.route}>{f.origin?.airport}</span>
				<span className={styles.arrow}>→</span>
				<span className={styles.route}>{f.destination?.airport}</span>
				{f.status === "to_book" && (
					<span className={`${styles.badge} ${styles.book}`}>To book</span>
				)}
			</span>
			<span className={styles.sub}>
				{[
					f.airline_code && f.flight_number
						? `${f.airline_code} ${f.flight_number}`
						: null,
					f.airline,
					f.cabin,
					f.seat ? `Seat ${f.seat}` : null,
				]
					.filter(Boolean)
					.join("  ·  ")}
			</span>
		</>
	);

	const flightKey = `${f.airline_code ?? ""}${f.flight_number ?? ""}`;
	const ef = enrichment?.flights?.find((e) => e.flight === flightKey);

	const detail: ReactNode = (
		<>
			<Facts>
				{f.confirmation && <Fact label="Confirmation" value={f.confirmation} />}
				{f.origin?.terminal && (
					<Fact
						label="Departs"
						value={`${f.origin.airport} T${f.origin.terminal}`}
					/>
				)}
				{f.destination?.terminal && (
					<Fact
						label="Arrives"
						value={`${f.destination.airport} T${f.destination.terminal}`}
					/>
				)}
				{f.cabin && <Fact label="Cabin" value={f.cabin} />}
				{f.seat && <Fact label="Seat" value={f.seat} />}
			</Facts>
			{ef && (ef.airline_status_url || ef.tracker_url) && (
				<div className={styles.links}>
					{ef.airline_status_url && (
						<BtnLink href={ef.airline_status_url} icon="ext">
							Flight status
						</BtnLink>
					)}
					{ef.tracker_url && (
						<BtnLink href={ef.tracker_url} icon="ext">
							Track live
						</BtnLink>
					)}
				</div>
			)}
		</>
	);

	return (
		<TimelineItem
			icon="plane"
			expandable={true}
			isToBook={f.status === "to_book"}
			row={row}
		>
			{detail}
		</TimelineItem>
	);
}
