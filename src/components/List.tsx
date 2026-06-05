"use client";

import Link from "next/link.js";
import type { ReactNode } from "react";

export function List<T extends { id: string }>({
	items,
	item,
}: {
	items: T[];
	item: (element: T) => ReactNode;
}) {
	return (
		<ul>
			{items.map((element) => (
				<li key={element.id}>{item(element)}</li>
			))}
		</ul>
	);
}

export function IDLinkList<T extends { id: string }>({
	items,
	link,
	href,
}: {
	items: T[];
	href: (element: T) => string;
	link: (element: T) => string;
}) {
	return (
		<List
			items={items}
			item={(element) => <Link href={`${href(element)}`}>{link(element)}</Link>}
		/>
	);
}
