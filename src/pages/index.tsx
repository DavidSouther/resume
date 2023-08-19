import { InferGetStaticPropsType } from "next";
import { Card } from "~/components/Card";
import Layout from "~/components/Layout";
import { IDLinkList } from "~/components/List";
import { Resume } from "~/components/resume/Resume";
import { getSortedPosts } from "~/lib/posts";
import * as ResumeTypes from "~/resume";
import resume from "./resume.json";
import Link from "next/link.js";

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
      <Card header="Posts" className="posts no-print">
        {posts.map(({ id, title, summary }) => (
          <>
            <div style={{ gridArea: "title" }}>
              <h4>
                <Link href={{ pathname: "blog/[id]", query: { id } }}>
                  {title}
                </Link>
              </h4>
            </div>
            <p key={id} style={{ gridArea: "summary" }}>
              {summary}
            </p>
          </>
        ))}
      </Card>
      <Resume resume={resume as ResumeTypes.ResumeData} />
    </Layout>
  );
}
