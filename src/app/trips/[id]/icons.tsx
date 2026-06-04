export const ICON: Record<string, string> = {
	plane:
		'<path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1L15 22v-1.5L13 19v-5.5z"/>',
	bed: '<path d="M3 18v-6m0 0V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4m-18 0h18m0 0v6M7 12V9h4v3"/>',
	bedout:
		'<path d="M3 18v-6m0 0V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4m-18 0h18m0 0v6"/><path d="M15 6l3 3-3 3M9 9h9" transform="translate(-1 0)"/>',
	car: '<path d="M5 16a2 2 0 1 0 4 0m6 0a2 2 0 1 0 4 0M3 16v-3.5L5 7h12l2 5.5V16M3 12.5h18M7 7l-1 3"/>',
	boat: '<path d="M4 14l1.5 5h13L20 14M3 14h18l-2-5H5zM12 4v5M9 9V6.5h6"/>',
	compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
	fork: '<path d="M7 3v7a2 2 0 0 0 4 0V3M9 10v11M17 3c-1.5 0-2 2-2 5s.5 4 2 4m0 0v9"/>',
	moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
	chev: '<path d="M9 6l6 6-6 6"/>',
	ext: '<path d="M14 5h5v5M19 5l-8 8M19 13v6H5V5h6"/>',
	pin: '<path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/>',
	phone:
		'<path d="M5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5V19a2 2 0 0 1-2 2A16 16 0 0 1 4 6a2 2 0 0 1 1-2z"/>',
};

export function SvgIcon({
	name,
	className,
}: {
	name: string;
	className?: string;
}) {
	const content = ICON[name] ?? "";
	return (
		<svg
			viewBox="0 0 24 24"
			className={className}
			dangerouslySetInnerHTML={{ __html: content }}
		/>
	);
}
