import Head from "next/head";
import { AboutMe } from "~/components/resume/AboutMe";
import { Resume } from "~/components/resume/Resume";
import resume from "./resume.json";

export default function Home() {
  const name = `${resume.aboutMe.profile.name} ${resume.aboutMe.profile.surnames}`;
  return (
    <>
      <div className="root">
        <Head>
          <title>{name} - Resume</title>
          <meta name="description" content={`${name} - Resume`} />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          {/* <link rel="icon" href="/favicon.ico" /> */}
        </Head>
        <header>
          <AboutMe aboutMe={resume.aboutMe} />
        </header>
        <main>
          <Resume resume={resume} />
        </main>
        <footer>
          © {name} 2008-{new Date().getFullYear()}
          <cite>
            <a href="https://github.com/davidsouther/resume">Page Source</a>
            <span className="print-only">github.com/davidsouther/resume</span>
          </cite>
        </footer>
      </div>
    </>
  );
}
