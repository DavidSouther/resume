import type { Metadata } from "next";
import { getTrip, getTripPaths } from "~/lib/trips";
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
	const { title, image } = await getTrip(id);
	const openGraph = {
		images: [...(image ? [image] : [])],
	};
	return {
		title: `${title} - David Souther`,
		metadataBase: new URL("https://davidsouther.com"),
		openGraph,
	};
}

export default async function Page({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const trip = await getTrip(id);
	return <TripPage trip={trip} />;
}
