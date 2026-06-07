// (wikiTitle) — positional from the original prop object.
// The original is a client component that fetches a Wikipedia summary in a
// useEffect and renders `null` until the data arrives. Server-rendered with no
// interactivity, the data is never present, so it contributes nothing. Returning
// null keeps the structure faithful; callers filter it via `kids`.
export function WikiCard(_wikiTitle: string): null {
	return null;
}
