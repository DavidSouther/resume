import { PropsWithChildren } from "react";
import Head from "next/head";
import { AboutMe } from "./resume/AboutMe";
import * as ResumeTypes from "~/resume";
import resume from "../pages/resume.json";

export default function Layout({
  children,
  title,
}: PropsWithChildren<{ title: string }>) {
  return (
    <>
      <div id="root" className="root">
        <Head>
          <title>{title}</title>
          <meta name="description" content={title} />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <header>
          <AboutMe aboutMe={resume.aboutMe as ResumeTypes.AboutMe} />
        </header>
        <main>{children}</main>
        <footer className="no-print">
          <nav>
            <p>
              © David Souther 2008-
              {new Date(resume.settings.lastUpdate).getFullYear()}
            </p>
            <cite>
              <a href="https://github.com/davidsouther/resume">Page Source</a>
            </cite>
          </nav>
        </footer>
      </div>
    </>
  );
}
