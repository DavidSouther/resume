"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import styles from "./day-group.module.css";
import { SvgIcon } from "./icons";

export function TimelineItem({
	icon,
	expandable,
	isToBook,
	row,
	children,
}: {
	icon: string;
	expandable: boolean;
	isToBook?: boolean;
	row: ReactNode;
	children?: ReactNode;
}) {
	const [open, setOpen] = useState(false);

	const cardClass = [styles.card, isToBook ? styles.tobook : ""]
		.filter(Boolean)
		.join(" ");
	const itemClass = [styles.item, open ? styles.open : ""]
		.filter(Boolean)
		.join(" ");

	return (
		<div className={itemClass}>
			<div className={cardClass}>
				<button
					type="button"
					className={styles.row}
					disabled={!expandable}
					aria-expanded={open}
					onClick={() => expandable && setOpen((o) => !o)}
				>
					<span className={styles.node}>
						<SvgIcon name={icon} />
					</span>
					<span className={styles["row-main"]}>{row}</span>
					{expandable && (
						<span className={styles.chev}>
							<SvgIcon name="chev" />
						</span>
					)}
				</button>
				{expandable && <div className={styles.detail}>{children}</div>}
			</div>
		</div>
	);
}
