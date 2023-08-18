import { InferGetStaticPropsType } from "next";
import { Card } from "~/components/Card";
import Layout from "~/components/Layout";
import { getPost, getPostPaths } from "~/lib/posts";

export function getStaticPaths() {
  const paths = getPostPaths();
  return { paths, fallback: false };
}

export async function getStaticProps({
  params: { id },
}: {
  params: { id: string };
}) {
  const post = await getPost(id);
  return { props: { post } };
}

export default function Page({
  post: { title, body, date },
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <Layout title={`${title} by David Souther`}>
      <Card header={`${title} - ${date?.replace(/T.*/, "")}`}>
        <div dangerouslySetInnerHTML={{ __html: body }}></div>
      </Card>
    </Layout>
  );
}
