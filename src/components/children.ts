// jiffies tag functions accept only `Node | string` children — a null or false
// child (React's `{cond && <X/>}` idiom) would break DOM insertion. `kids`
// drops conditional/absent children so the survivors can be spread safely.
export function kids<T>(...children: (T | null | undefined | false)[]): T[] {
	return children.filter((c): c is T => Boolean(c));
}
