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
					<p>Photo Booooooth</p>
					<p><a href="https://photos.app.goo.gl/ZJPPdbvcX15qyJSs8">Shared Google Album</a></p>
					<p>Please upload and share your photos - of the party, or any memories you want to share!</p>
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
			</article>
		</div>
	);
}
