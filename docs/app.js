const Events = Symbol("events");
const CLEAR = Symbol("Clear children");
function isAttrs(attrs) {
    if (!attrs) {
        return false;
    }
    if (typeof attrs === "string") {
        return false;
    }
    return !attrs.nodeType;
}
function normalizeArguments(attrs, children = [], defaultAttrs = {}) {
    let attributes;
    if (isAttrs(attrs)) {
        attributes = attrs;
    }
    else {
        if (attrs !== undefined) {
            children.unshift(attrs);
        }
        attributes = defaultAttrs;
    }
    return [attributes, children.flat()];
}
function up(element, attrs, ...children) {
    return update(element, ...normalizeArguments(attrs, children));
}
function update(element, attrs, children) {
    // Track events, to remove later
    const $events = (element[Events] ??= new Map());
    const { style = {}, events = {}, ...rest } = attrs;
    Object.entries(events).forEach(([k, v]) => {
        if (v === null && $events.has(k)) {
            const listener = $events.get(k);
            element.removeEventListener(k, listener);
        }
        else if (!$events.has(k)) {
            element.addEventListener(k, v);
            $events.set(k, v);
        }
    });
    const _style = element.style;
    if (_style) {
        if (typeof style === "string") {
            _style.cssText = style;
        }
        else {
            Object.entries(style).forEach(([k, v]) => {
                // @ts-ignore Object.entries is unable to statically look into args
                _style[k] = v;
            });
        }
    }
    Object.entries(rest).forEach(([k, v]) => {
        if (k === "class" && typeof v === "string") {
            v.split(/\s+/m)
                .filter((s) => s !== "")
                .forEach((c) => element.classList.add(c));
        }
        let useAttributes = k.startsWith("aria-") ||
            element.namespaceURI != "http://www.w3.org/1999/xhtml";
        if (useAttributes) {
            switch (v) {
                case false:
                    element.removeAttributeNS(element.namespaceURI, k);
                    break;
                case true:
                    element.setAttributeNS(element.namespaceURI, k, k);
                    break;
                default:
                    if (v === "") {
                        element.removeAttributeNS(element.namespaceURI, k);
                    }
                    else {
                        element.setAttributeNS(element.namespaceURI, k, v);
                    }
            }
        }
        else {
            // @ts-ignore Object.entries is unable to statically look into args
            element[k] = v;
        }
    });
    if (children?.length > 0) {
        if (children[0] === CLEAR) {
            element.replaceChildren();
        }
        else {
            element.replaceChildren(...children);
        }
    }
    element.update ??= (attrs, ...children) => update(element, ...normalizeArguments(attrs, children));
    return element;
}

const makeHTMLElement = (name) => (attrs, ...children) => up(document.createElement(name), attrs, ...children);
const a = makeHTMLElement("a");
const article = makeHTMLElement("article");
const cite = makeHTMLElement("cite");
const div = makeHTMLElement("div");
const em = makeHTMLElement("em");
const figure = makeHTMLElement("figure");
const footer = makeHTMLElement("footer");
const h1 = makeHTMLElement("h1");
const h2 = makeHTMLElement("h2");
const h3 = makeHTMLElement("h3");
const h4 = makeHTMLElement("h4");
const header = makeHTMLElement("header");
const hgroup = makeHTMLElement("hgroup");
const img = makeHTMLElement("img");
const li = makeHTMLElement("li");
const main = makeHTMLElement("main");
const nav = makeHTMLElement("nav");
const p = makeHTMLElement("p");
const section = makeHTMLElement("section");
const small = makeHTMLElement("small");
const span = makeHTMLElement("span");
const style = makeHTMLElement("style");
const ul = makeHTMLElement("ul");

function dashCase(identifier) {
    return identifier
        .replace(/([a-z])([A-Z])/g, (_, a, b) => `${a}-${b.toLowerCase()}`)
        .replace(/ ([A-Z])/g, (_, b) => `-${b.toLowerCase()}`);
}

function compileFStyle(fstyle, prefix = "") {
    const properties = [];
    const rules = [];
    for (const [key, value] of Object.entries(fstyle)) {
        if (typeof value == "string") {
            properties.push({ key, value });
        }
        else {
            rules.push({ key, value });
        }
    }
    let rule = "";
    if (properties.length > 0) {
        rule += `${prefix} {\n`;
        for (const { key, value } of properties) {
            rule += `  ${dashCase(key)}: ${value};\n`;
        }
        rule += "}\n\n";
    }
    for (const { key, value } of rules) {
        if (key.startsWith("@media")) {
            rule += `${key} {\n`;
            rule += compileFStyle(value, "  ");
            rule += `}\n\n`;
        }
        else {
            rule += compileFStyle(value, `${prefix} ${key}`);
        }
    }
    return rule;
}

const Resume = (resume) => [
    style(compileFStyle({
        body: {
            marginTop: "var(--block-spacing-vertical)",
        },
        "article > header > h3": {
            marginBottom: "0",
        },
        ".organization": {
            gridArea: "org",
            marginBottom: "0",
            borderBottom: "thin solid var(--card-border-color)",
        },
        ".role, .education, .project": {
            display: "contents",
        },
        ".job, .education": {
            display: "grid",
            grid: "'_a org _b' auto\n" +
                "'about details competences' auto\n" +
                "/ 1fr 4fr 1fr",
            gap: "calc(var(--block-spacing-vertical) / 2) calc(var(--block-spacing-horizontal) / 2)",
        },
        ".about": {
            gridArea: "about",
            display: "flex",
            flexDirection: "column",
        },
        ".details": {
            gridArea: "details",
        },
        ".competences": {
            gridArea: "competences",
        },
    })),
    jobDetails(resume.experience.jobs),
    studies(resume.knowledge.studies ?? []),
    projects(resume.experience.projects),
    publications(resume.experience.publicArtifacts),
];
const AboutMe = (
// {
//     profile: { name, surnames, title, avatar, location },
//     relevantLinks,
//   },
// }:
aboutMe) => [
    style(compileFStyle({
        "body > header": {
            display: "grid",
            grid: `'avatar name links' auto
               'avatar title links' auto
               'avatar location links' auto
                  / 150px auto`,
            gap: "0 var(--block-spacing-horizontal)",
            hgroup: {
                display: "contents",
            },
            h1: {
                gridArea: "name",
            },
            h2: {
                gridArea: "title",
            },
            figure: {
                gridArea: "avatar",
                margin: "0",
                img: {
                    borderRadius: "10%",
                },
            },
            "div.location": {
                gridArea: "location",
                display: "flex",
                flexDirection: "row-reverse",
                justifyContent: "flex-end",
                gap: "0.25em",
                "span:not(:first-child)::after": {
                    content: "','",
                },
            },
            nav: {
                gridArea: "links",
                flexDirection: "row-reverse",
                ul: {
                    flexDirection: "column",
                },
            },
        },
    })),
    hgroup(h1(`${aboutMe.profile.name} ${aboutMe.profile.surnames ?? ""}`), h2(aboutMe.profile.title)),
    ...(aboutMe.profile.avatar ? [Avatar(aboutMe.profile.avatar)] : []),
    ...(aboutMe.profile.location ? [Location(aboutMe.profile.location)] : []),
    ...((aboutMe.relevantLinks ?? []).length == 0
        ? []
        : [Links(aboutMe.relevantLinks ?? [])]),
];
const Avatar = (avatar) => figure(img({
    height: 136,
    width: 136,
    src: avatar.link
        ? avatar.link
        : `data:${avatar.mediaType};base64,${avatar.data}`,
}));
const Location = (location) => div({ class: "location" }, ...Object.entries(location).map(([k, v]) => span({ class: `location ${k}` }, v)));
const Links = (relevantLinks) => nav(ul(...relevantLinks.map((link) => li(a({ href: link.URL }, span({ class: "no-print" }, link.type), span({ class: "print-only" }, link.URL))))));
const jobDetails = (jobs) => article(header(h3("Work Experience")), ...jobs.map(jobDetail));
const jobDetail = (job) => div({ class: "job" }, organization(job.organization), ...job.roles.map(role));
const organization = (org) => h4({ class: "organization" }, org.URL ? a({ href: org.URL }, org.name) : org.name);
const role = (role) => div({ class: "role" }, div({ class: "about" }, em({ class: "name" }, role.name), small({ class: "start date" }, role.startDate), ...(role.finishDate
    ? [small({ class: "finish date" }, role.finishDate)]
    : [])), div({ class: "details" }, ...role.challenges.map(({ description }) => p({ class: "justify" }, description))), div({ class: "competences" }, small((role.competences ?? []).map(({ name }) => name).join(", "))));
const studies = (knowledge) => article(header(h3("Education")), ...knowledge.map(education));
const education = (study) => div({ class: "education" }, h4({ class: "organization" }, ...(study.institution ? [organization(study.institution)] : [])), div({ class: "about" }, em({ class: "name" }, study.name), small({ class: "start" }, study.startDate), ...(study.finishDate
    ? [small({ class: "finish" }, study.finishDate)]
    : [])), p({ class: "details justify" }, study.description ?? ""));
const projects = (projects) => article(header(h3("Projects")), ...projects.map(projectDetail).flat());
const publications = (artifacts) => article({ class: "publications" }, style(compileFStyle({
    ".publications section": {
        columns: "2",
        marginBottom: "0",
        p: {
            display: "grid",
            grid: "fit-content(0) / 3fr minmax(fit-content, 1fr);",
            gap: "0 calc(var(--block-spacing-vertical) / 2)",
            marginBottom: "0",
        },
    },
})), header(h3("publications")), section(...artifacts
    .filter(({ details: { URL } }) => URL != undefined)
    .map(publication)
    .flat()));
const projectDetail = ({ details }) => details
    ? div({ class: "project" }, span(details.URL ? a({ href: details.URL }, details.name) : details.name), ...(details.description ? [p(details.description)] : []))
    : [];
const publication = ({ details: { name, URL }, publishingDate, }) => p(a({ href: URL }, name), span({ class: "print-only" }, URL ?? ""), small(em(publishingDate)));

const App = () => {
    const title = header(h1("Resume"));
    const body = main({ ariaBusy: "true" });
    const pageFooter = footer({
        style: {
            display: "flex",
            justifyContent: "space-between",
        },
    }, "© David Souther 2022", cite(a({
        href: "https://github.com/davidsouther/resume",
    }, "Page Source", span({ class: "print-only" }, ": github.com/davidsouther/resume"))));
    fetch("./resume.json").then(async (result) => {
        if (result.ok) {
            const resume = await result.json();
            title.update(...AboutMe(resume.aboutMe));
            body.update({ ariaBusy: "" }, ...Resume(resume));
        }
        else {
            body.update({ ariaBusy: "" }, "Failed to load resume!");
        }
    });
    const app = [title, body, pageFooter];
    return app;
};

export { App };
