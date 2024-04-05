"use client";

import { Card } from "~/components/Card";
import { Post } from "~/lib/posts";
import styles from "./blog-page.module.css";

export default function BlogPage({
  post: { title, body, date },
}: {
  post: Post;
}) {
  return (
    <Card
      header={`${title} - ${date?.replace(/T.*/, "")}`}
      className={styles.blogPage}
    >
      <div dangerouslySetInnerHTML={{ __html: body ?? "" }}></div>
    </Card>
  );
}
