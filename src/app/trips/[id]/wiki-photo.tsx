"use client";

import { useEffect, useState } from "react";
import styles from "./wiki-photo.module.css";

export function WikiPhoto({ wikiTitle }: { wikiTitle: string }) {
	const [src, setSrc] = useState("");

	useEffect(() => {
		const api = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`;
		fetch(api, { headers: { accept: "application/json" } })
			.then((r) => (r.ok ? r.json() : null))
			.then((j) => {
				if (!j) return;
				const imgSrc =
					(j.originalimage?.source as string | undefined) ??
					(j.thumbnail?.source as string | undefined);
				if (!imgSrc) return;
				const img = new Image();
				img.onload = () => setSrc(imgSrc);
				img.src = imgSrc;
			})
			.catch(() => {});
	}, [wikiTitle]);

	return (
		<div
			className={`${styles["hero-img"]}${src ? ` ${styles.in}` : ""}`}
			style={src ? { backgroundImage: `url("${src}")` } : undefined}
		/>
	);
}
