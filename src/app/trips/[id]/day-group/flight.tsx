import type { ReactNode } from "react";
import {
	formatClock,
	type ItineraryItem,
	parseDateTime,
	timezoneAbbreviation,
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
	const flight = item.data;
	const departure = parseDateTime(flight.depart?.datetime);
	const arrival = parseDateTime(flight.arrive?.datetime);
	const isNextDay = arrival && departure && arrival.date > departure.date;

	const row: ReactNode = (
		<>
			{departure && (
				<span className={styles["timeline-times"]}>
					<span>
						{formatClock(departure.hours, departure.minutes)}{" "}
						{timezoneAbbreviation(departure.date, flight.depart?.timezone)}
					</span>
					<span className={styles.arrow}>—</span>
					{arrival && (
						<span>
							{formatClock(arrival.hours, arrival.minutes)}{" "}
							{timezoneAbbreviation(arrival.date, flight.arrive?.timezone)}
						</span>
					)}
					{isNextDay && <span className={styles.plus1}>+1 day</span>}
				</span>
			)}
			<span className={styles.title}>
				<span className={styles.route}>{flight.origin?.airport}</span>
				<span className={styles.arrow}>→</span>
				<span className={styles.route}>{flight.destination?.airport}</span>
				{flight.status === "to_book" && (
					<span className={`${styles.badge} ${styles.book}`}>To book</span>
				)}
			</span>
			<span className={styles.sub}>
				{[
					flight.airline_code && flight.flight_number
						? `${flight.airline_code} ${flight.flight_number}`
						: null,
					flight.airline,
					flight.cabin,
					flight.seat ? `Seat ${flight.seat}` : null,
				]
					.filter(Boolean)
					.join("  ·  ")}
			</span>
		</>
	);

	const flightKey = `${flight.airline_code ?? ""}${flight.flight_number ?? ""}`;
	const flightEnrichment = enrichment?.flights?.find(
		(enrichedFlight) => enrichedFlight.flight === flightKey,
	);

	const detail: ReactNode = (
		<>
			<Facts>
				{flight.confirmation && (
					<Fact label="Confirmation" value={flight.confirmation} />
				)}
				{flight.origin?.terminal && (
					<Fact
						label="Departs"
						value={`${flight.origin.airport} T${flight.origin.terminal}`}
					/>
				)}
				{flight.destination?.terminal && (
					<Fact
						label="Arrives"
						value={`${flight.destination.airport} T${flight.destination.terminal}`}
					/>
				)}
				{flight.cabin && <Fact label="Cabin" value={flight.cabin} />}
				{flight.seat && <Fact label="Seat" value={flight.seat} />}
			</Facts>
			{flightEnrichment &&
				(flightEnrichment.airline_status_url ||
					flightEnrichment.tracker_url) && (
					<div className={styles.links}>
						{flightEnrichment.airline_status_url && (
							<BtnLink href={flightEnrichment.airline_status_url} icon="ext">
								Flight status
							</BtnLink>
						)}
						{flightEnrichment.tracker_url && (
							<BtnLink href={flightEnrichment.tracker_url} icon="ext">
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
			isToBook={flight.status === "to_book"}
			row={row}
		>
			{detail}
		</TimelineItem>
	);
}
