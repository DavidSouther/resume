"use client";
import { List } from "~/components/List";
import { Content } from "~/lib/content";

export default function ContentList({ contents }: { contents: Content[] }) {
  return (
    <List
      items={contents}
      item={(c: Content) => (
        <span>
          {c.id} ({c.predecessor?.id ?? "None"})
        </span>
      )}
    />
  );
}
