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
				<h1>Save the Date!</h1>
				<div className="subtitle">Annie's 40th Birthday</div>

				<div className="divider"></div>

				<div className="details">
					<p>Saturday, March 28th, 2026</p>
					<p>6:30pm 1234 Broadway #147</p>
					<p>Food, soft drinks, & music provided; BYOB</p>
					<p>Afterparty: <a href="https://www.hoteleventi.com/chelsea-bars/">Kimpton Eventi Back Bar</a></p>
				</div>

				<div className="divider"></div>

				<div className="rsvp">
					<p>RSVP with David or Annie by March 21st</p>
					<ul>
						<li>Hotel Block Booking Links:</li>
						<li><a href="https://www.ihg.com/redirect?path=asearch&brandCode=KI&localeCode=en&regionCode=1&hotelCode=NYCAA&checkInDate=27&checkInMonthYear=022026&checkOutDate=29&checkOutMonthYear=022026&rateCode=6CBARC&_PMID=99801505&GPC=EUF&cn=no&adjustMonth=false&showApp=true&monthIndex=00">Kimpton Eventi $299</a></li>
						<li><a href="https://app.marriott.com/reslink?id=1770236208872&key=GRP&app=resvlink">Moxy NYC Chelsea $249</a></li>
						<li>Last day to book: Wednesday, February 25, 2026</li>
					</ul>
				</div>
			</article>
		</div>
	);
}
