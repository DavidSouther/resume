// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type * as ResumeTypes from "~/lib/resume";
import { AboutMe, Contact } from "./AboutMe";

afterEach(cleanup);

describe("Contact", () => {
	it("aggregates profiles, mails, and phones into one link each", () => {
		const contact: ResumeTypes.Contact = {
			publicProfiles: [{ type: "github", URL: "https://github.com/d" }],
			contactMails: ["a@b.com"],
			phoneNumbers: [{ countryCode: 1, number: "555-1234" }],
		};

		render(<Contact links={[]} contact={contact} />);

		const hrefs = screen
			.getAllByRole("link")
			.map((a) => a.getAttribute("href"));
		expect(hrefs).toEqual([
			"https://github.com/d",
			"mailto:a@b.com",
			"tel:+1 555-1234",
		]);
	});

	it("labels each link with its type, not its raw URL", () => {
		render(
			<Contact
				contact={{
					publicProfiles: [{ type: "github", URL: "https://github.com/d" }],
				}}
			/>,
		);

		const link = screen.getByRole("link");
		expect(link.textContent).toBe("github");
		expect(link.getAttribute("href")).toBe("https://github.com/d");
	});

	it("renders the explicitly passed links ahead of contact-derived ones", () => {
		render(
			<Contact
				links={[{ type: "site", URL: "https://x.test" }]}
				contact={{ contactMails: ["a@b.com"] }}
			/>,
		);

		const hrefs = screen
			.getAllByRole("link")
			.map((a) => a.getAttribute("href"));
		expect(hrefs).toEqual(["https://x.test", "mailto:a@b.com"]);
	});

	it("wraps the links in a nav.contact", () => {
		const { container } = render(
			<Contact contact={{ contactMails: ["a@b.com"] }} />,
		);

		expect(container.querySelector("nav.contact")).not.toBeNull();
	});

	it("renders an empty nav when there is nothing to contact", () => {
		render(<Contact />);

		expect(screen.queryByRole("link")).toBeNull();
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
		render(<AboutMe aboutMe={aboutMe} />);

		const h1 = screen.getByRole("heading", { level: 1 });
		const link = h1.querySelector("a");
		expect(link?.getAttribute("href")).toBe("/");
		expect(link?.textContent).toContain("David");
		expect(link?.textContent).toContain("Souther");
	});

	it("renders the title in an h2", () => {
		render(<AboutMe aboutMe={aboutMe} />);

		expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
			"Engineer",
		);
	});

	it("renders a span per location field", () => {
		const { container } = render(<AboutMe aboutMe={aboutMe} />);

		expect(container.querySelector("span.country")?.textContent).toBe("US");
		expect(container.querySelector("span.region")?.textContent).toBe("NY");
	});

	it("renders the contact nav derived from the profile", () => {
		const { container } = render(<AboutMe aboutMe={aboutMe} />);

		const contact = container.querySelector("nav.contact a");
		expect(contact?.getAttribute("href")).toBe("mailto:a@b.com");
	});

	it("renders an avatar image when the profile has one", () => {
		const withAvatar: ResumeTypes.AboutMe = {
			...aboutMe,
			profile: {
				...aboutMe.profile,
				avatar: { link: "https://img.test/a.png" },
			},
		};

		render(<AboutMe aboutMe={withAvatar} />);

		expect(screen.getByAltText("David Professional Photo")).not.toBeNull();
	});

	it("omits the avatar figure when the profile has none", () => {
		const { container } = render(<AboutMe aboutMe={aboutMe} />);

		expect(container.querySelector("figure")).toBeNull();
	});
});
