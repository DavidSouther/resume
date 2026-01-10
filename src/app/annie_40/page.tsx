import "./page.css";
import type { Metadata } from "next";
import Background from "./background";

const URLS = [
	"grelli.jpg",
	"walk.jpg",
	"pants.jpg",
	"krummi.jpg",
	"cover.jpg",
	"puffin.jpg",
	"pumpkins.jpg",
];

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: `Annie's 40th Save the Date`,
		metadataBase: new URL("https://davidsouther.com"),
		openGraph: {
			description: `Save the Date! Annie's 40th Birthday
        Saturday, March 28th, 2026
        Midtown, Manhattan
        Location TBA,
        Hotel Block TBA,
        Tentative RSVP with David or Annie by Feb 20th`,
			images: [
				{
					url: "https://davidsouther.com/annie_40/cover.jpg",
					alt: "Annie sits overlooking a fjord, pensively.",
				},
			],
		},
	};
}

export default function Page() {
	return (
		<div className="annie_40">
			<Background urls={URLS} />
			<article>
				<h1>Save the Date!</h1>
				<div className="subtitle">Annie's 40th Birthday</div>

				<div className="divider"></div>

				<div className="details">
					<p>Saturday, March 28th, 2026</p>
					<p>Midtown, Manhattan</p>
					<p>Location TBA</p>
					<p>Hotel Block TBA</p>
				</div>

				<div className="divider"></div>

				<div className="rsvp">
					Tentative RSVP with David or Annie by Feb 20th
				</div>
			</article>
		</div>
	);
}
