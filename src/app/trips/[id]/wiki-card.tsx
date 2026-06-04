"use client";

import { useEffect, useState } from "react";
import styles from "./wiki-card.module.css";

type WikiData = {
	title: string;
	extract: string;
	thumbnail?: { source: string };
	content_urls?: { desktop?: { page?: string } };
};

export function WikiCard({ wikiTitle }: { wikiTitle: string }) {
	const [data, setData] = useState<WikiData | null>(null);

	useEffect(() => {
		const api = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`;
		fetch(api, { headers: { accept: "application/json" } })
			.then((r) => (r.ok ? r.json() : null))
			.then((j: WikiData | null) => {
				if (j?.title) setData(j);
			})
			.catch(() => {});
	}, [wikiTitle]);

	if (!data) return null;

	const imgSrc = data.thumbnail?.source;
	const pageUrl = data.content_urls?.desktop?.page;

	return (
		<div className={styles.wiki}>
			{imgSrc && (
				<div
					className={styles["wiki-thumb"]}
					style={{ backgroundImage: `url('${imgSrc}')` }}
				/>
			)}
			<div className={styles["wiki-body"]}>
				<h4>{data.title}</h4>
				<p>{data.extract}</p>
				{pageUrl && (
					<a href={pageUrl} target="_blank" rel="noopener noreferrer">
						Wikipedia →
					</a>
				)}
			</div>
		</div>
	);
}
