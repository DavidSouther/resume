// AVM tangent-plane world coordinates, as published in the ESA image feeds.
// Pixels are fractions of the reference image, so any downscaled copy of the
// same picture maps to the same sky.

export interface Wcs {
	/** ICRS [ra, dec] in degrees at the reference pixel. */
	ref: [number, number];
	/** Reference pixel [x, y] in the reference image, top-left origin. */
	px: [number, number];
	/** Reference image size [width, height] in pixels. */
	dim: [number, number];
	/** Degrees per reference pixel [x, y]. */
	scale: [number, number];
	/** Rotation of north from image up, degrees. */
	rot: number;
}

const RAD = Math.PI / 180;

/** Sky [ra, dec] to normalised image position [x / width, y / height]. */
export function skyToUnit(w: Wcs, ra: number, dec: number): [number, number] {
	const xi = (ra - w.ref[0]) * Math.cos(w.ref[1] * RAD);
	const eta = dec - w.ref[1];
	const c = Math.cos(w.rot * RAD);
	const s = Math.sin(w.rot * RAD);
	const u = xi * c + eta * s;
	const v = -xi * s + eta * c;
	return [
		(w.px[0] - u / Math.abs(w.scale[0])) / w.dim[0],
		(w.px[1] - v / Math.abs(w.scale[1])) / w.dim[1],
	];
}

/** Normalised image position to sky [ra, dec]. */
export function unitToSky(w: Wcs, x: number, y: number): [number, number] {
	const u = (w.px[0] - x * w.dim[0]) * Math.abs(w.scale[0]);
	const v = (w.px[1] - y * w.dim[1]) * Math.abs(w.scale[1]);
	const c = Math.cos(w.rot * RAD);
	const s = Math.sin(w.rot * RAD);
	const xi = u * c - v * s;
	const eta = u * s + v * c;
	return [w.ref[0] + xi / Math.cos(w.ref[1] * RAD), w.ref[1] + eta];
}

/** Arcseconds per pixel of an image `width` pixels wide. */
export function arcsecPerPixel(w: Wcs, width: number): number {
	return (Math.abs(w.scale[0]) * w.dim[0] * 3600) / width;
}
