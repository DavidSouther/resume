import type { Metadata } from "next";
import { getTripItinerary, getTripPaths } from "~/lib/trips";
import TripPage from "./trip-page";

export async function generateStaticParams() {
	return getTripPaths().map((id) => ({ id }));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	const { itinerary } = await getTripItinerary(id);
	const image = itinerary.trip.cover_image;
	return {
		title: `${itinerary.trip.title} - David Souther`,
		metadataBase: new URL("https://davidsouther.com"),
		openGraph: {
			images: [...(image ? [image] : [])],
		},
	};
}

export default async function Page({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const { itinerary, enrichment } = await getTripItinerary(id);
	return <TripPage itinerary={itinerary} enrichment={enrichment} />;
}
