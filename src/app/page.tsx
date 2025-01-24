import { Card } from "~/components/Card";
import Layout from "~/components/Layout";
import { Resume } from "~/components/resume/Resume";
import { getSortedPosts } from "~/lib/posts";
import Link from "next/link.js";
import { jsonLoader, ResumeLoader, tomlLoader } from "~/lib/loader";

const resumeLoader: ResumeLoader = tomlLoader;

export default async function Home() {
  const [posts, resume] = await Promise.all([getSortedPosts(), resumeLoader()]);
  const name = `${resume.aboutMe.profile.name} ${resume.aboutMe.profile.surnames}`;
  const title = `${name} - Resume`;
  return (
    <Layout title={title}>
      <Card header="Posts" className="posts no-print">
        {posts.map(({ id, title, summary }) => (
          <>
            <div style={{ gridArea: "title" }}>
              <h4>
                <Link href={`blog/${id}`}>{title}</Link>
              </h4>
            </div>
            <p key={id} style={{ gridArea: "summary" }}>
              {summary}
            </p>
          </>
        ))}
      </Card>
      <Resume resume={resume} />
    </Layout>
  );
}
