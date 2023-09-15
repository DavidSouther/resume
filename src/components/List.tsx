"use client";

import Link from "next/link.js";
import { ReactNode } from "react";

export function List<T extends { id: string }>({
  items,
  item,
}: {
  items: T[];
  item: (t: T) => ReactNode;
}) {
  return (
    <ul>
      {items.map((t) => (
        <li key={t.id}>{item(t)}</li>
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
  href: (t: T) => string;
  link: (t: T) => string;
}) {
  return (
    <List
      items={items}
      item={(t) => <Link href={`${href(t)}`}>{link(t)}</Link>}
    />
  );
}
