import { InferGetStaticPropsType } from "next";
import { Card } from "~/components/Card";
import Layout from "~/components/Layout";
import { IDLinkList } from "~/components/List";
import { Resume } from "~/components/resume/Resume";
import { getSortedPosts } from "~/lib/posts";
import * as ResumeTypes from "~/resume";
import resume from "./resume.json";

export function getStaticProps() {
  const posts = getSortedPosts();
  return { props: { posts } };
}

export default function Home({
  posts,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const name = `${resume.aboutMe.profile.name} ${resume.aboutMe.profile.surnames}`;
  const title = `${name} - Resume`;
  return (
    <Layout title={title}>
      <Card header="Posts">
        <IDLinkList
          items={posts}
          pathname="blog/[id]"
          link={({ title }) => title ?? "Unknown"}
        />
      </Card>
      <Resume resume={resume as ResumeTypes.ResumeData} />
    </Layout>
  );
}
