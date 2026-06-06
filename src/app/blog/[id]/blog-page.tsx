import { Card } from "~/components/Card";
import type { Post } from "~/lib/posts";

export default async function BlogPage({ post }: { post: Post }) {
	const { title, body, date } = post;
	// A page-spine <main> lets jiffies-css clamp the post to the responsive
	// --base-viewport-width; the card itself stays a plain semantic article.
	return (
		<main>
			<Card
				header={
					<>
						<a href="/">David Souther</a> - {title} - {date?.replace(/T.*/, "")}
					</>
				}
				footer={<a href="../../">Back</a>}
			>
				<div dangerouslySetInnerHTML={{ __html: body ?? "" }}></div>
			</Card>
		</main>
	);
}
