// @vitest-environment jsdom
import {
	getAllByRole,
	getByAltText,
	getByRole,
	queryByRole,
} from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import type * as ResumeTypes from "../../lib/resume";
import { mount, resetDom } from "../test-dom.ts";
import { AboutMe, Contact } from "./about-me.ts";

afterEach(resetDom);

describe("Contact", () => {
	it("aggregates profiles, mails, and phones into one link each", () => {
		const contact: ResumeTypes.ContactMeans = {
			publicProfiles: [{ type: "github", URL: "https://github.com/d" }],
			contactMails: ["a@b.com"],
			phoneNumbers: [{ countryCode: 1, number: "555-1234" }],
		};

		const container = mount(Contact([], contact));

		const hrefs = getAllByRole(container, "link").map((a) =>
			a.getAttribute("href"),
		);
		expect(hrefs).toEqual([
			"https://github.com/d",
			"mailto:a@b.com",
			"tel:+1 555-1234",
		]);
	});

	it("labels each link with its type, not its raw URL", () => {
		const container = mount(
			Contact(undefined, {
				publicProfiles: [{ type: "github", URL: "https://github.com/d" }],
			}),
		);

		const link = getByRole(container, "link");
		expect(link.textContent).toBe("github");
		expect(link.getAttribute("href")).toBe("https://github.com/d");
	});

	it("renders the explicitly passed links ahead of contact-derived ones", () => {
		const container = mount(
			Contact([{ type: "site", URL: "https://x.test" }], {
				contactMails: ["a@b.com"],
			}),
		);

		const hrefs = getAllByRole(container, "link").map((a) =>
			a.getAttribute("href"),
		);
		expect(hrefs).toEqual(["https://x.test", "mailto:a@b.com"]);
	});

	it("wraps the links in a nav.contact", () => {
		const container = mount(Contact(undefined, { contactMails: ["a@b.com"] }));

		expect(container.querySelector("nav.contact")).not.toBeNull();
	});

	it("renders an empty nav when there is nothing to contact", () => {
		const container = mount(Contact());

		expect(queryByRole(container, "link")).toBeNull();
	});
});

describe("AboutMe", () => {
	const aboutMe: ResumeTypes.AboutMe = {
		profile: {
			name: "David",
			surnames: "Souther",
			title: "Engineer",
			location: { country: "US", region: "NY" },
			contact: { contactMails: ["a@b.com"] },
		},
		relevantLinks: [],
	};

	it("renders the name and surnames in an h1 linking home", () => {
		const container = mount(AboutMe(aboutMe));

		const h1 = getByRole(container, "heading", { level: 1 });
		const link = h1.querySelector("a");
		expect(link?.getAttribute("href")).toBe("/");
		expect(link?.textContent).toContain("David");
		expect(link?.textContent).toContain("Souther");
	});

	it("renders the title in an h2", () => {
		const container = mount(AboutMe(aboutMe));

		expect(getByRole(container, "heading", { level: 2 }).textContent).toBe(
			"Engineer",
		);
	});

	it("renders a span per location field", () => {
		const container = mount(AboutMe(aboutMe));

		expect(container.querySelector("span.country")?.textContent).toBe("US");
		expect(container.querySelector("span.region")?.textContent).toBe("NY");
	});

	it("renders the contact nav derived from the profile", () => {
		const container = mount(AboutMe(aboutMe));

		expect(container.querySelector("nav.contact a")?.getAttribute("href")).toBe(
			"mailto:a@b.com",
		);
	});

	it("renders an avatar image when the profile has one", () => {
		const container = mount(
			AboutMe({
				...aboutMe,
				profile: {
					...aboutMe.profile,
					avatar: { link: "https://img.test/a.png" },
				},
			}),
		);

		expect(getByAltText(container, "David Professional Photo")).not.toBeNull();
	});

	it("omits the avatar figure when the profile has none", () => {
		const container = mount(AboutMe(aboutMe));

		expect(container.querySelector("figure")).toBeNull();
	});
});
