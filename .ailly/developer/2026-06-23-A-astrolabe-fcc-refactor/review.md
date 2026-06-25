# Human code review of fcc refactor

## Prefer `range().map` to `for (...)`

Common pattern:

```ts
const points: { x: number; y: number }[] = [];
for (let s = 0; s <= samples; s++) {
	// calculations
	points.push({
		// fields
	});
}
return points;
```

This can be better expresed with `range` in jiffies:

```ts
return range(0, samples).map<{x: number, y: number}>(s => {
	// calculations
	return {
		// fields
	};
});
```

## Prefer `prop?: foo` to `prop: foo | null`

It's prefered to elide properies than to null them.


## Short variables for loops, not math

`aEr`, `cosAe`, `rD` etc are unknowable without context and a glossary. Better is to give them semantic names.

## NO DOM METHODS

Period. Anywhere. What is this?

```
	const q = <T extends Element>(sel: string): (T & Updatable) | null =>
		svg.querySelector<T>(sel) as (T & Updatable) | null;
```

You can't just hide them in a helper. None means none.

`bindCheck` calls getElementById.


## Fix Jiffies

`setAttrs` and `a<T>(attrs): T` are hiding issues in Jiffies. If there's a real problem with typing, suggest a fix to enable Jiffies to expose a mechanism to widen types in a constrained fashion.

## Controls are named as verbs, not components.

`buildControlsPanel` is just a `ControlsPanel`. That's all it needs to be.
