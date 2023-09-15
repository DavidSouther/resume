"use client";

import { Card } from "~/components/Card";
import { IDLinkList } from "~/components/List";
import { Post } from "~/lib/posts";

export default function BlogList({ posts }: { posts: Post[] }) {
  return (
    <Card header="Posts">
      <IDLinkList
        items={posts}
        href={({ id }) => `blog/${id}`}
        link={({ title }) => title ?? "Unknown"}
      />
    </Card>
  );
}
