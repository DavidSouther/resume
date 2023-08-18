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
  pathname,
}: {
  items: T[];
  link: (t: T) => string;
  pathname: string;
}) {
  return (
    <List
      items={items}
      item={(t) => (
        <Link
          href={{
            pathname,
            query: { id: t.id },
          }}
        >
          {link(t)}
        </Link>
      )}
    />
  );
}
