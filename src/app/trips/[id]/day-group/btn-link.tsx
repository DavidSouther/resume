import type { ReactNode } from "react";
import { SvgIcon } from "../icons";
import styles from "./btn-link.module.css";

export function BtnLink({
	href,
	icon,
	children,
}: {
	href: string;
	icon: string;
	children: ReactNode;
}) {
	const external = /^https?:/.test(href);
	return (
		<a
			className={styles.btn}
			href={href}
			{...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
		>
			<SvgIcon name={icon} />
			{children}
		</a>
	);
}
