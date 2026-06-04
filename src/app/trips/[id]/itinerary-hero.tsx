import { initials, rangeLabel } from "~/lib/itinerary-helpers";
import type { Itinerary } from "~/lib/trip-itinerary";
import styles from "./itinerary-hero.module.css";
import { WikiPhoto } from "./wiki-photo";

export function ItineraryHero({
	itinerary,
	wikiTitle,
}: {
	itinerary: Itinerary;
	wikiTitle?: string;
}) {
	const { trip } = itinerary;
	const start = String(trip.start_date);
	const end = String(trip.end_date);

	return (
		<div className={styles.hero}>
			{wikiTitle && <WikiPhoto wikiTitle={wikiTitle} />}
			<div className={styles["hero-inner"]}>
				<p className={styles.kicker}>Itinerary</p>
				<h1>{trip.title}</h1>
				<div className={styles["hero-meta"]}>
					<div className={styles.avatar}>{initials(trip.traveler)}</div>
					<div>
						<div className={styles["hero-dates"]}>
							{start && end ? rangeLabel(start, end) : ""}
						</div>
						{trip.traveler && (
							<div className={styles["hero-traveler"]}>{trip.traveler}</div>
						)}
					</div>
				</div>
				{trip.notes && <div className={styles["hero-note"]}>{trip.notes}</div>}
			</div>
		</div>
	);
}
