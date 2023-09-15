"use client";

import { Card } from "~/components/Card";
import { Post } from "~/lib/posts";

export default function BlogPage({
  post: { title, body, date },
}: {
  post: Post;
}) {
  return (
    <Card header={`${title} - ${date?.replace(/T.*/, "")}`}>
      <div dangerouslySetInnerHTML={{ __html: body ?? "" }}></div>
    </Card>
  );
}
