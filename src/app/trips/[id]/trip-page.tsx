import NextImage from "next/image";
import { Card } from "~/components/Card";
import type { Trip } from "~/lib/trips";
import styles from "./trip-page.module.css";

export default async function TripPage({ trip }: { trip: Trip }) {
	const { title, date } = trip;
	return (
		<>
			<Card
				header={
					<>
						<a href="/">David Souther</a> - {title} - {date?.replace(/T.*/, "")}
					</>
				}
				footer={
					<>
						<a href="../../">Back</a>
					</>
				}
				className={styles.TripPage}
			>
				<p>
					Trip to {trip.title} {trip.image && <NextImage src={trip.image} alt={trip.title} width={800} height={600} />}
				</p>
			</Card>
		</>
	);
}
