//! The page's own stages on top of the core: measurement on the colour image,
//! the diffraction-spike star finder, classification and fragment grouping.
//! Ported from the Deep Field Volume page's JavaScript `detectSources`, with
//! the same option names and defaults, except that `minArea` and `nThresh`
//! follow SEP (5 and 32).

pub mod classify;
pub mod measure;
pub mod stars;

use serde::{Deserialize, Serialize};

use crate::core::{
    self, background, filter, BackgroundParams, DeblendParams, ExtractParams, Kernel,
};
use measure::{Blob, Class, Planes};

/// Detection options, named as the page passes them.
#[derive(Clone, Debug, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Options {
    /// Detection threshold above local sky, in sigma.
    pub k_sigma: f32,
    /// Noise floor in counts (8-bit quantisation).
    pub sigma_floor: f32,
    /// Smallest blob kept, in pixels.
    pub min_area: usize,
    /// Deblending levels between threshold and peak.
    pub n_thresh: usize,
    /// A branch must hold this fraction of its parent's flux to split off.
    pub min_cont: f64,
    /// Area fraction of the frame above which a galaxy can be near.
    pub near_frac: f64,
    /// A near galaxy must be this much bluer (log R/B) than the field median.
    pub near_bluer: f64,
    /// Fragments within this multiple of a near galaxy's 2-sigma ellipse join its group.
    pub group_scale: f64,
    /// Area below which a galaxy is far (barely resolved), in pixels.
    pub far_area: f64,
    /// Mean spike contrast (noise units) needed to call a star.
    pub spike_score: f64,
    /// Per-angle contrast for a spike to count as present.
    pub spike_contrast: f64,
    /// Single-spike stars must not be redder than this (log R/B).
    pub star_max_color: f64,
    /// A single clean spike suffices when the core is this close to the frame's brightest peak.
    pub star_peak_frac: f64,
}

impl Default for Options {
    fn default() -> Self {
        Self {
            k_sigma: 5.0,
            sigma_floor: 1.5,
            min_area: 5,
            n_thresh: 32,
            min_cont: 0.005,
            near_frac: 0.0022,
            near_bluer: 0.35,
            group_scale: 1.5,
            far_area: 40.0,
            spike_score: 3.0,
            spike_contrast: 2.5,
            star_max_color: 0.45,
            star_peak_frac: 0.75,
        }
    }
}

/// One source as the page receives it.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct PageObject {
    pub id: u32,
    pub cls: Class,
    pub group: u32,
    pub fragment: bool,
    pub cx: f64,
    pub cy: f64,
    pub x0: usize,
    pub y0: usize,
    pub x1: usize,
    pub y1: usize,
    pub area: usize,
    pub flux: f64,
    pub peak: f64,
    pub color: f64,
    pub major: f64,
    pub minor: f64,
    pub theta: f64,
    pub spike: f64,
}

impl From<&Blob> for PageObject {
    fn from(s: &Blob) -> Self {
        Self {
            id: s.id,
            cls: s.cls,
            group: s.group.unwrap_or(s.id),
            fragment: s.fragment,
            cx: if s.is_star { s.px as f64 } else { s.cx },
            cy: if s.is_star { s.py as f64 } else { s.cy },
            x0: s.x0,
            y0: s.y0,
            x1: s.x1,
            y1: s.y1,
            area: s.area,
            flux: s.flux,
            peak: s.peak,
            color: s.color,
            major: s.major,
            minor: s.minor,
            theta: s.theta,
            spike: (s.spike * 10.0).round() / 10.0,
        }
    }
}

/// Everything the page needs from one analysis.
#[derive(Clone, Debug)]
pub struct Analysis {
    pub objects: Vec<PageObject>,
    /// Object id per pixel, 0 for sky.
    pub labels: Vec<i32>,
    /// Sky level per pixel.
    pub back: Vec<f32>,
    pub field_color: f64,
    /// Diffraction-spike angles in degrees, 0 to 179.
    pub spike_angles: Vec<u32>,
}

/// Mean of R, G and B for each RGBA pixel.
pub fn luminance(rgba: &[u8]) -> Vec<f32> {
    rgba.chunks_exact(4)
        .map(|p| (f32::from(p[0]) + f32::from(p[1]) + f32::from(p[2])) / 3.0)
        .collect()
}

/// Run the core and the page stages on an RGBA image.
pub fn analyse(rgba: &[u8], width: usize, height: usize, opt: &Options) -> Analysis {
    let n = width * height;
    assert_eq!(
        rgba.len(),
        n * 4,
        "rgba size does not match width * height * 4"
    );
    let lum = luminance(rgba);
    let bg = background::estimate(&lum, width, height, &BackgroundParams::default());
    let sigma: Vec<f32> = bg.rms.iter().map(|&r| r.max(opt.sigma_floor)).collect();
    let data: Vec<f32> = lum.iter().zip(&bg.back).map(|(l, b)| l - b).collect();
    let params = ExtractParams {
        thresh: opt.k_sigma,
        min_area: opt.min_area,
        deblend: DeblendParams {
            levels: opt.n_thresh,
            contrast: opt.min_cont,
            min_area: opt.min_area,
        },
        ..ExtractParams::default()
    };
    let ex = core::extract(&data, &sigma, width, height, &params);
    let signif: Vec<f32> = filter::convolve(&data, width, height, &Kernel::default_3x3())
        .iter()
        .zip(&sigma)
        .map(|(c, s)| c / s)
        .collect();
    let im = Planes {
        width,
        height,
        rgba,
        lum: &lum,
        back: &bg.back,
        sigma: &sigma,
        signif: &signif,
    };
    let mut blobs: Vec<Blob> = ex
        .pixels
        .into_iter()
        .enumerate()
        .map(|(k, px)| measure::measure(k as u32 + 1, px, &im))
        .collect();
    let spike_angles = stars::find_stars(&mut blobs, &im, opt);
    let field_color = classify::field_color(&blobs, opt);
    classify::classify(&mut blobs, field_color, n, opt);
    let mut labels = vec![0i32; n];
    for s in &blobs {
        for &p in &s.pixels {
            labels[p as usize] = s.id as i32;
        }
    }
    classify::group_fragments(&mut blobs, &labels, width, height, field_color, opt);
    Analysis {
        objects: blobs.iter().map(PageObject::from).collect(),
        labels,
        back: bg.back,
        field_color,
        spike_angles: spike_angles.into_iter().map(|a| a as u32).collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn options_default_to_the_page_values() {
        let o = Options::default();
        assert_eq!(o.k_sigma, 5.0);
        assert_eq!(o.min_cont, 0.005);
        assert_eq!(o.far_area, 40.0);
        assert_eq!(o.spike_contrast, 2.5);
    }

    #[test]
    fn analyse_labels_each_source() {
        let (w, h) = (128, 96);
        let mut rgba = vec![255u8; w * h * 4];
        let mut s: u32 = 1;
        for i in 0..w * h {
            let (x, y) = ((i % w) as f32, (i / w) as f32);
            s = s.wrapping_mul(1664525).wrapping_add(1013904223);
            let noise = (s >> 30) as f32; // 0..3
            let blue = 120.0 * (-((x - 40.0).powi(2) + (y - 50.0).powi(2)) / 18.0).exp();
            let red = 90.0 * (-((x - 95.0).powi(2) + (y - 30.0).powi(2)) / 10.0).exp();
            rgba[i * 4] = (20.0 + noise + red) as u8;
            rgba[i * 4 + 1] = (20.0 + noise + 0.5 * (red + blue)) as u8;
            rgba[i * 4 + 2] = (20.0 + noise + blue) as u8;
        }
        let a = analyse(&rgba, w, h, &Options::default());
        assert_eq!(a.objects.len(), 2, "{:?}", a.objects);
        assert_eq!(a.labels.len(), w * h);
        let blue = a
            .objects
            .iter()
            .find(|o| (o.cx - 40.0).abs() < 1.0)
            .expect("blue source");
        let red = a
            .objects
            .iter()
            .find(|o| (o.cx - 95.0).abs() < 1.0)
            .expect("red source");
        assert!(blue.color < 0.0 && red.color > 0.0);
        assert_eq!(a.labels[50 * w + 40], blue.id as i32);
        assert_eq!(a.labels[30 * w + 95], red.id as i32);
        assert_eq!(a.labels[5 * w + 5], 0);
        assert!(a.objects.iter().all(|o| o.group == o.id && !o.fragment));
    }
}
