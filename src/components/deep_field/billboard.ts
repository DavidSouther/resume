// At least a quarter of a cutout's width survives an edge-on view. All corners
// stay at the source centre's camera depth, so width cannot imply extra depth.
export const MIN_SPRITE_FACING = 0.25;

/** Camera-plane projection columns, with foreshortening bounded by MIN_SPRITE_FACING. */
export function billboardBasis(
	az: number,
	el: number,
): [number, number, number, number] {
	const ca = Math.cos(az);
	const sa = Math.sin(az);
	const ce = Math.cos(el);
	const se = Math.sin(el);
	const x = sa * ce;
	const y = se;
	const length = Math.hypot(x, y);
	if (length < 1e-9) return [1, 0, 0, 1];
	const mx = x / length;
	const my = y / length;
	// The perpendicular axis retains its full size; only the foreshortened axis
	// needs a floor. This also handles simultaneous yaw and pitch near a corner.
	const vx = -ca * my;
	const vy = sa * se * my + ce * mx;
	const facing = Math.max(MIN_SPRITE_FACING, ca * ce);
	return [
		-vx * my + vy * mx * facing,
		-vy * my - vx * mx * facing,
		vx * mx + vy * my * facing,
		vy * mx - vx * my * facing,
	];
}
