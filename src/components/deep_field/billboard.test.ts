import { expect, it } from "vitest";
import { billboardBasis, MIN_SPRITE_FACING } from "./billboard.ts";

it("preserves the photograph at the telescope", () => {
	expect(billboardBasis(0, 0)).toEqual([1, 0, 0, 1]);
});

it("keeps even a wide source visible at Side and Top", () => {
	const side = billboardBasis(Math.PI / 2, 0);
	const top = billboardBasis(0, Math.PI / 2);
	expect(side[0]).toBeCloseTo(MIN_SPRITE_FACING);
	expect(side[3]).toBeCloseTo(1);
	expect(top[0]).toBeCloseTo(1);
	expect(top[3]).toBeCloseTo(MIN_SPRITE_FACING);
});

it("preserves the image-plane projection when the source is already visible enough", () => {
	for (const az of [-0.5, 0, 0.5]) {
		for (const el of [-0.5, 0, 0.5]) {
			const [a, b, c, d] = billboardBasis(az, el);
			expect(a).toBeCloseTo(Math.cos(az));
			expect(b).toBeCloseTo(-Math.sin(az) * Math.sin(el));
			expect(c).toBeCloseTo(0);
			expect(d).toBeCloseTo(Math.cos(el));
		}
	}
});

it("bounds foreshortening throughout the allowed rotations without enlarging a source", () => {
	for (let az = -90; az <= 90; az += 5) {
		for (let el = -90; el <= 90; el += 5) {
			const [a, b, c, d] = billboardBasis(
				(az * Math.PI) / 180,
				(el * Math.PI) / 180,
			);
			const area = a * d - b * c;
			expect(area).toBeGreaterThanOrEqual(MIN_SPRITE_FACING - 1e-12);
			for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
				const x = Math.cos(angle);
				const y = Math.sin(angle);
				const size = Math.hypot(a * x + c * y, b * x + d * y);
				expect(size).toBeGreaterThanOrEqual(MIN_SPRITE_FACING - 1e-12);
				expect(size).toBeLessThanOrEqual(1 + 1e-12);
			}
		}
	}
});
