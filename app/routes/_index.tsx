import type * as ResumeTypes from "~/resume";

import type { V2_MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import resume from "./resume.json";
import { AboutMe } from "~/components/resume/AboutMe";
import { Resume } from "~/components/resume/Resume";

export const meta: V2_MetaFunction = () => [
  { title: "David Souther - Resume" },
];

export async function loader() {
  return resume;
}

export default function Index() {
  const resume = useLoaderData<ResumeTypes.ResumeData>();

  return (
    <>
      <header>
        {resume ? <AboutMe aboutMe={resume.aboutMe} /> : <h1>Resume</h1>}
      </header>
      {resume ? (
        <main>
          <Resume resume={resume} />
        </main>
      ) : (
        <main aria-busy={true} />
      )}
      <footer>
        © David Souther 2022
        <cite>
          <a href="https://github.com/davidsouther/resume">Page Source</a>
          <span className="print-only">github.com/davidsouther/resume</span>
        </cite>
      </footer>
    </>
  );
}
