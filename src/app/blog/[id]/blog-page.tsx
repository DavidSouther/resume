import { Card } from "~/components/Card";
import { Post } from "~/lib/posts";
import styles from "./blog-page.module.css";

export default async function BlogPage({ post }: { post: Post }) {
  const { title, body, date } = post;
  return (
    <>
      <Card
        header={
          <>
            <a href="/">David Souther</a> - {title} - {date?.replace(/T.*/, "")}
          </>
        }
        footer={
          <>
            <a href="../../">Back</a>
          </>
        }
        className={styles.BlogPage}
      >
        <div dangerouslySetInnerHTML={{ __html: body ?? "" }}></div>
      </Card>
    </>
  );
}
