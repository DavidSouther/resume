//! Per-source measurements the page uses: flux above sky, centroid, moment
//! ellipse, peak significance and colour.

use serde::Serialize;

/// Distance class of a source.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Class {
    Star,
    Near,
    Mid,
    Far,
}

/// Images the page measures on, all row-major and `width` wide.
pub struct Planes<'a> {
    pub width: usize,
    pub height: usize,
    pub rgba: &'a [u8],
    /// Luminance, the mean of R, G and B.
    pub lum: &'a [f32],
    /// Sky level.
    pub back: &'a [f32],
    /// Noise, floored.
    pub sigma: &'a [f32],
    /// Smoothed significance: 3 by 3 weighted mean of the sky-subtracted
    /// luminance, in units of the noise.
    pub signif: &'a [f32],
}

impl Planes<'_> {
    /// Flux above sky at pixel `i`.
    pub fn flux(&self, i: usize) -> f64 {
        f64::from((self.lum[i] - self.back[i]).max(0.0))
    }
}

/// A detected source and everything the page stages attach to it.
#[derive(Clone, Debug)]
pub struct Blob {
    pub id: u32,
    pub pixels: Vec<u32>,
    pub area: usize,
    pub flux: f64,
    pub x0: usize,
    pub y0: usize,
    pub x1: usize,
    pub y1: usize,
    /// Peak smoothed significance and where it is.
    pub peak: f64,
    pub px: usize,
    pub py: usize,
    pub cx: f64,
    pub cy: f64,
    pub major: f64,
    pub minor: f64,
    pub theta: f64,
    /// log((R + 1) / (B + 1)) of the sky-subtracted light; above 0 is redder.
    pub color: f64,
    pub spike: f64,
    pub is_star: bool,
    pub cls: Class,
    pub group: Option<u32>,
    pub fragment: bool,
}

/// Measure the source made of `pixels`.
pub fn measure(id: u32, pixels: Vec<u32>, im: &Planes) -> Blob {
    let w = im.width;
    let (mut x0, mut y0, mut x1, mut y1) = (w, im.height, 0, 0);
    let (mut flux, mut sx, mut sy, mut sxx, mut syy, mut sxy) = (0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
    let (mut peak, mut px, mut py) = (-1e9, 0, 0);
    let (mut r, mut b) = (0.0, 0.0);
    for &p in &pixels {
        let i = p as usize;
        let (x, y) = (i % w, i / w);
        let f = im.flux(i);
        let (xf, yf) = (x as f64, y as f64);
        flux += f;
        sx += f * xf;
        sy += f * yf;
        sxx += f * xf * xf;
        syy += f * yf * yf;
        sxy += f * xf * yf;
        x0 = x0.min(x);
        y0 = y0.min(y);
        x1 = x1.max(x);
        y1 = y1.max(y);
        let s = f64::from(im.signif[i]);
        if s > peak {
            (peak, px, py) = (s, x, y);
        }
        let bg = f64::from(im.back[i]);
        r += (f64::from(im.rgba[i * 4]) - bg).max(0.0);
        b += (f64::from(im.rgba[i * 4 + 2]) - bg).max(0.0);
    }
    let f = if flux != 0.0 { flux } else { 1.0 };
    let (cx, cy) = (sx / f, sy / f);
    let a = sxx / f - cx * cx;
    let c = syy / f - cy * cy;
    let bxy = sxy / f - cx * cy;
    let t = ((a - c) * (a - c) / 4.0 + bxy * bxy).max(0.0).sqrt();
    Blob {
        id,
        area: pixels.len(),
        pixels,
        flux,
        x0,
        y0,
        x1,
        y1,
        peak,
        px,
        py,
        cx,
        cy,
        major: ((a + c) / 2.0 + t).max(0.25).sqrt(),
        minor: ((a + c) / 2.0 - t).max(0.25).sqrt(),
        theta: 0.5 * (2.0 * bxy).atan2(a - c),
        color: ((r + 1.0) / (b + 1.0)).ln(),
        spike: 0.0,
        is_star: false,
        cls: Class::Far,
        group: None,
        fragment: false,
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    /// Owned planes for tests: a uniform sky of 10 with unit noise.
    pub struct Owned {
        pub width: usize,
        pub height: usize,
        pub rgba: Vec<u8>,
        pub lum: Vec<f32>,
        pub back: Vec<f32>,
        pub sigma: Vec<f32>,
        pub signif: Vec<f32>,
    }

    impl Owned {
        pub fn new(width: usize, height: usize, pixel: impl Fn(usize, usize) -> [u8; 3]) -> Self {
            let n = width * height;
            let mut rgba = vec![255u8; n * 4];
            let mut lum = vec![0.0f32; n];
            for i in 0..n {
                let c = pixel(i % width, i / width);
                rgba[i * 4..i * 4 + 3].copy_from_slice(&c);
                lum[i] = (f32::from(c[0]) + f32::from(c[1]) + f32::from(c[2])) / 3.0;
            }
            let back = vec![10.0f32; n];
            let sigma = vec![1.0f32; n];
            let signif = lum.iter().map(|l| l - 10.0).collect();
            Self {
                width,
                height,
                rgba,
                lum,
                back,
                sigma,
                signif,
            }
        }

        pub fn planes(&self) -> Planes<'_> {
            Planes {
                width: self.width,
                height: self.height,
                rgba: &self.rgba,
                lum: &self.lum,
                back: &self.back,
                sigma: &self.sigma,
                signif: &self.signif,
            }
        }
    }

    #[test]
    fn measures_flux_centroid_and_colour() {
        // Two lit pixels: a red one at (1, 1) and a blue one at (2, 1).
        let o = Owned::new(4, 3, |x, y| match (x, y) {
            (1, 1) => [70, 10, 10],
            (2, 1) => [10, 10, 70],
            _ => [10, 10, 10],
        });
        let b = measure(1, vec![5, 6], &o.planes());
        assert_eq!(b.area, 2);
        assert!((b.flux - 40.0).abs() < 1e-9);
        assert!((b.cx - 1.5).abs() < 1e-9);
        assert!((b.cy - 1.0).abs() < 1e-9);
        assert!(b.color.abs() < 1e-9, "equal red and blue light");
        assert_eq!((b.x0, b.x1, b.y0, b.y1), (1, 2, 1, 1));
    }

    #[test]
    fn redder_light_has_positive_colour() {
        let o = Owned::new(
            3,
            1,
            |x, _| if x == 1 { [90, 40, 20] } else { [10, 10, 10] },
        );
        let b = measure(1, vec![1], &o.planes());
        assert!(b.color > 0.0);
        assert_eq!((b.px, b.py), (1, 0));
    }

    #[test]
    fn ellipse_follows_a_diagonal_bar() {
        let o = Owned::new(
            5,
            5,
            |x, y| if x == y { [40, 40, 40] } else { [10, 10, 10] },
        );
        let b = measure(1, vec![0, 6, 12, 18, 24], &o.planes());
        assert!(b.major > 2.0 * b.minor);
        assert!((b.theta - std::f64::consts::FRAC_PI_4).abs() < 1e-9);
    }
}
