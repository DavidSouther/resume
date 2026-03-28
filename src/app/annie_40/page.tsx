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
		title: `Annie's 40th birthday`,
		metadataBase: new URL("https://davidsouther.com"),
		openGraph: {
			description: `Annie's 40th Birthday
        Saturday, March 28th, 2026
		1234 Broadway #147
        Hotel: Kimpton Eventi,
        Food & Music; BYOB`,
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
				<h1>Annie's 40th</h1>

				<div className="details">
					<p>Arrival Instructions</p>
					<p>NEST Broadway 1234 Broadway #147 New York 10001</p>
					<p>Entrance on 31st St (<a href="https://maps.app.goo.gl/6Fy7iT96TK3ucURZ8">Google maps</a>) (<a href="https://maps.apple/p/1Bzx90wK6qHHo_">Apple maps</a>)</p>
					<p>First, Buzz unit 147</p>
					<p>Give us a minute to buzz you through?</p>
					<p>Then try ButterflyMX code 349105</p>
					<p>
						If that doesn't work{" "}
						<a href="tel:+1-650-595-5402">text or call David (650) 495-5402</a>
					</p>
					<p>End of the hall, up the stairs, follow signs for unit 147</p>
					<p>Right from the stairs, end of the hall, door on the left.</p>
				</div>

				<div className="divider"></div>

				<div className="playlist">
					<iframe
						title="Annie's 40th Playlist"
						allow="autoplay *; encrypted-media *;"
						sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
						src="https://embed.music.apple.com/us/playlist/40th-birthday/pl.u-06oxp9gFJ3XAG6"
					></iframe>
				</div>

				<div className="divider"></div>

				<div className="details">
					<p>Saturday, March 28th, 2026</p>
					<p>6:30pm 1234 Broadway #147</p>
					<p>Food, soft drinks, & music provided; BYOB</p>
					<p>Dress code: Millenial Dance Party / that thing you never wear</p>
					<p>
						Afterparty:{" "}
						<a href="https://www.hoteleventi.com/chelsea-bars/">
							Kimpton Eventi Back Bar
						</a>
					</p>
				</div>

			</article>
		</div>
	);
}
