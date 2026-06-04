import type { ReactNode } from "react";
import styles from "./fact.module.css";

export function Facts({ children }: { children: ReactNode }) {
	return <div className={styles.facts}>{children}</div>;
}

export default function Fact({
	label,
	value,
}: {
	label: string;
	value: string;
}) {
	return (
		<div className={styles.fact}>
			<b>{label}</b>
			<span>{value}</span>
		</div>
	);
}
