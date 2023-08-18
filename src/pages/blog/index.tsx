import { InferGetStaticPropsType } from "next";
import Link from "next/link";
import { Card } from "~/components/Card";
import Layout from "~/components/Layout";
import { IDLinkList } from "~/components/List";
import { getSortedPosts } from "~/lib/posts";

export function getStaticProps() {
  const posts = getSortedPosts();
  return { props: { posts } };
}

export default function Blog({
  posts,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <Layout title="Posts by David Souther">
      <Card header="Posts">
        <IDLinkList
          items={posts}
          pathname="blog/[id]"
          link={({ title }) => title ?? "Unknown"}
        />
      </Card>
    </Layout>
  );
}
