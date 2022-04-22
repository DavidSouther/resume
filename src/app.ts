import {
  footer,
  h1,
  main,
  header,
  cite,
  a,
  span,
} from "@davidsouther/jiffies/dom/html.js";
import { Resume, AboutMe } from "./resume.js";

export const App = () => {
  const title = header(h1("Resume"));
  const body = main({ ariaBusy: "true" });
  const pageFooter = footer(
    {
      style: {
        display: "flex",
        justifyContent: "space-between",
      },
    },
    "© David Souther 2022",
    cite(
      a(
        {
          href: "https://github.com/davidsouther/resume",
        },
        "Page Source",
        span({ class: "print-only" }, ": github.com/davidsouther/resume")
      )
    )
  );

  fetch("./resume.json").then(async (result) => {
    if (result.ok) {
      const resume = await result.json();
      title.update(...AboutMe(resume.aboutMe));
      body.update({ ariaBusy: "" }, ...Resume(resume));
    } else {
      body.update({ ariaBusy: "" }, "Failed to load resume!");
    }
  });

  const app = [title, body, pageFooter];
  return app;
};
