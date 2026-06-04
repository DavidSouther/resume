import styles from "./city-banner.module.css";
import { WikiPhoto } from "./wiki-photo";

export function CityBanner({
	city,
	wikiTitle,
}: {
	city: string;
	wikiTitle?: string;
}) {
	return (
		<div className={styles["city-banner"]}>
			{wikiTitle && <WikiPhoto wikiTitle={wikiTitle} />}
			<div className={styles["city-banner-inner"]}>
				<div className={styles.eyebrow}>Next stop</div>
				<h2>{city}</h2>
			</div>
		</div>
	);
}
