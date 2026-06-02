import NextImage from "next/image";
import { Card } from "~/components/Card";
import type { Trip } from "~/lib/trips";
import styles from "./blog-page.module.css";

export default async function BlogPage({ trip }: { trip: Trip }) {
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
				className={styles.BlogPage}
			>
				<p>
					Trip to {trip.title} {trip.image && <NextImage src={trip.image} alt={trip.title} width={800} height={600} />}
				</p>
			</Card>
		</>
	);
}
