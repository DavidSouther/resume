import { getSortedTrips } from "~/lib/trips";
import TripList from "./trip-list";

export default async function Page() {
	const trips = await getSortedTrips();
	return <TripList trips={trips} />;
}
