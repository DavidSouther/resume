//! Isophotal measurements of a detected object: pixel count, flux, peak,
//! bounding box, flux-weighted centroid and second moments.

use serde::Serialize;

/// One object found by the core, measured on the background-subtracted data.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct CoreObject {
    pub cx: f64,
    pub cy: f64,
    pub area: usize,
    pub flux: f64,
    pub peak: f64,
    pub x0: usize,
    pub y0: usize,
    pub x1: usize,
    pub y1: usize,
    /// Second central moments, in square pixels.
    #[serde(skip)]
    pub x2: f64,
    #[serde(skip)]
    pub y2: f64,
    #[serde(skip)]
    pub xy: f64,
}

/// Measure the pixels `pixels` of a `width`-wide image of values `data`.
/// Moments weight each pixel by its value; when the total is not positive
/// they fall back to unit weights.
pub fn measure(pixels: &[u32], data: &[f32], width: usize) -> CoreObject {
    let (mut x0, mut y0, mut x1, mut y1) = (usize::MAX, usize::MAX, 0, 0);
    let (mut flux, mut peak) = (0.0f64, f64::NEG_INFINITY);
    for &p in pixels {
        let p = p as usize;
        let (x, y) = (p % width, p / width);
        x0 = x0.min(x);
        y0 = y0.min(y);
        x1 = x1.max(x);
        y1 = y1.max(y);
        let v = f64::from(data[p]);
        flux += v;
        peak = peak.max(v);
    }
    let weight = |v: f64| if flux > 0.0 { v } else { 1.0 };
    let (mut sw, mut sx, mut sy) = (0.0, 0.0, 0.0);
    for &p in pixels {
        let p = p as usize;
        let w = weight(f64::from(data[p]));
        sw += w;
        sx += w * (p % width) as f64;
        sy += w * (p / width) as f64;
    }
    let (cx, cy) = (sx / sw, sy / sw);
    let (mut sxx, mut syy, mut sxy) = (0.0, 0.0, 0.0);
    for &p in pixels {
        let p = p as usize;
        let w = weight(f64::from(data[p]));
        let dx = (p % width) as f64 - cx;
        let dy = (p / width) as f64 - cy;
        sxx += w * dx * dx;
        syy += w * dy * dy;
        sxy += w * dx * dy;
    }
    CoreObject {
        cx,
        cy,
        area: pixels.len(),
        flux,
        peak,
        x0,
        y0,
        x1,
        y1,
        x2: sxx / sw,
        y2: syy / sw,
        xy: sxy / sw,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn centroid_weights_by_flux() {
        // Two pixels on a row, the right one three times brighter.
        let data = [1.0f32, 3.0, 0.0, 0.0];
        let o = measure(&[0, 1], &data, 4);
        assert!((o.cx - 0.75).abs() < 1e-12);
        assert_eq!(o.cy, 0.0);
        assert_eq!(o.area, 2);
        assert_eq!(o.flux, 4.0);
        assert_eq!(o.peak, 3.0);
        assert_eq!((o.x0, o.x1), (0, 1));
    }

    #[test]
    fn second_moments_follow_elongation() {
        // A horizontal bar of five equal pixels.
        let data = [1.0f32; 5];
        let o = measure(&[0, 1, 2, 3, 4], &data, 5);
        assert!((o.x2 - 2.0).abs() < 1e-12);
        assert_eq!(o.y2, 0.0);
        assert_eq!(o.xy, 0.0);
    }

    #[test]
    fn non_positive_flux_falls_back_to_geometric_centre() {
        let data = [-1.0f32, -1.0, -1.0];
        let o = measure(&[0, 2], &data, 3);
        assert_eq!(o.cx, 1.0);
    }
}
