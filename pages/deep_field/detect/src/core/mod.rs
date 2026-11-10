//! Detection core: background mesh, matched-filter thresholding, 8-connected
//! extraction, multi-threshold deblending, cleaning and moments.
//!
//! Written from the published method (Bertin & Arnouts 1996, A&AS 117, 393)
//! and SEP's documentation (Barbary 2016, JOSS 1, 58). SEP's source was not
//! read; agreement with SEP is checked by running it as a black box
//! (`oracle/sep_oracle.py`).

pub mod background;
pub mod clean;
pub mod deblend;
pub mod filter;
pub mod moments;
pub mod segment;
pub mod spline;

pub use background::{Background, BackgroundParams};
pub use deblend::DeblendParams;
pub use filter::Kernel;
pub use moments::CoreObject;

use segment::Labeler;

/// How the detection image is formed from the data.
#[derive(Clone, Debug, PartialEq)]
pub enum Filter {
    /// Threshold the data itself, in units of the noise.
    None,
    /// Matched filter: threshold the signal-to-noise of the kernel fit.
    Matched(Kernel),
}

/// Extraction settings. The defaults are SEP's.
#[derive(Clone, Debug, PartialEq)]
pub struct ExtractParams {
    /// Detection threshold in units of the local noise.
    pub thresh: f32,
    pub min_area: usize,
    pub filter: Filter,
    pub deblend: DeblendParams,
    /// Moffat index used by cleaning, or `None` to skip cleaning.
    pub clean: Option<f64>,
}

impl Default for ExtractParams {
    fn default() -> Self {
        Self {
            thresh: 1.5,
            min_area: 5,
            filter: Filter::Matched(Kernel::default_3x3()),
            deblend: DeblendParams::default(),
            clean: Some(1.0),
        }
    }
}

/// Objects found by [`extract`], with their pixel lists.
#[derive(Clone, Debug)]
pub struct Extraction {
    pub objects: Vec<CoreObject>,
    pub pixels: Vec<Vec<u32>>,
}

/// Detect objects in background-subtracted `data` with per-pixel noise `rms`.
pub fn extract(
    data: &[f32],
    rms: &[f32],
    width: usize,
    height: usize,
    params: &ExtractParams,
) -> Extraction {
    assert_eq!(
        data.len(),
        width * height,
        "data size does not match width * height"
    );
    assert_eq!(
        rms.len(),
        width * height,
        "noise size does not match width * height"
    );
    let det: Vec<f32> = match &params.filter {
        Filter::None => data
            .iter()
            .zip(rms)
            .map(|(&d, &s)| if s > 0.0 { d / s } else { 0.0 })
            .collect(),
        Filter::Matched(kernel) => filter::matched(data, rms, width, height, kernel),
    };
    let above: Vec<u32> = (0..det.len() as u32)
        .filter(|&p| det[p as usize] > params.thresh)
        .collect();
    let mut labeler = Labeler::new(width, height);
    let roots = labeler.components(&above, |_| true);
    let deblend = DeblendParams {
        min_area: params.min_area,
        ..params.deblend
    };
    let mut pixels: Vec<Vec<u32>> = Vec::new();
    for root in roots {
        if root.len() < params.min_area {
            continue;
        }
        let parts = deblend::deblend(
            root,
            &det,
            data,
            params.thresh,
            width,
            &mut labeler,
            &deblend,
        );
        pixels.extend(parts.into_iter().filter(|p| p.len() >= params.min_area));
    }
    if let Some(beta) = params.clean {
        let kernel = match &params.filter {
            Filter::Matched(kernel) => kernel.clone(),
            Filter::None => Kernel::default_3x3(),
        };
        let conv = filter::convolve(data, width, height, &kernel);
        pixels = clean::clean(pixels, data, &conv, rms, width, params.thresh, beta);
    }
    let objects = pixels
        .iter()
        .map(|p| moments::measure(p, data, width))
        .collect();
    Extraction { objects, pixels }
}

/// Run the whole core on raw luminance with SEP's defaults: a 64 by 64
/// background mesh with a 3 by 3 filter, then extraction at 5 sigma.
pub fn detect_core(luminance: &[f32], width: usize, height: usize) -> (Background, Extraction) {
    let bg = background::estimate(luminance, width, height, &BackgroundParams::default());
    let data: Vec<f32> = luminance.iter().zip(&bg.back).map(|(l, b)| l - b).collect();
    let params = ExtractParams {
        thresh: 5.0,
        ..Default::default()
    };
    let ex = extract(&data, &bg.rms, width, height, &params);
    (bg, ex)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Deterministic pseudo-random noise in [-1, 1).
    fn noise(seed: u64, n: usize) -> Vec<f32> {
        let mut s = seed;
        (0..n)
            .map(|_| {
                s = s
                    .wrapping_mul(6364136223846793005)
                    .wrapping_add(1442695040888963407);
                ((s >> 40) as f32 / (1u64 << 24) as f32) * 2.0 - 1.0
            })
            .collect()
    }

    fn scene(w: usize, h: usize, sources: &[(f32, f32, f32)]) -> Vec<f32> {
        let n = noise(7, w * h);
        (0..w * h)
            .map(|i| {
                let (x, y) = ((i % w) as f32, (i / w) as f32);
                let s: f32 = sources
                    .iter()
                    .map(|&(cx, cy, a)| a * (-((x - cx).powi(2) + (y - cy).powi(2)) / 4.0).exp())
                    .sum();
                20.0 + n[i] + s
            })
            .collect()
    }

    #[test]
    fn finds_isolated_sources_at_their_centres() {
        let (w, h) = (128, 128);
        let srcs = [(30.0, 30.0, 40.0), (90.0, 40.0, 60.0), (60.0, 100.0, 30.0)];
        let img = scene(w, h, &srcs);
        let (_, ex) = detect_core(&img, w, h);
        assert_eq!(ex.objects.len(), 3, "{:?}", ex.objects);
        for &(cx, cy, _) in &srcs {
            assert!(ex
                .objects
                .iter()
                .any(|o| (o.cx - f64::from(cx)).abs() < 0.5 && (o.cy - f64::from(cy)).abs() < 0.5));
        }
    }

    #[test]
    fn blank_sky_has_no_detections() {
        let (w, h) = (96, 96);
        let img = scene(w, h, &[]);
        let (bg, ex) = detect_core(&img, w, h);
        assert!(ex.objects.is_empty());
        assert!(bg.back.iter().all(|&b| (b - 20.0).abs() < 0.2));
    }

    #[test]
    fn close_pair_is_deblended() {
        let (w, h) = (96, 64);
        let img = scene(w, h, &[(40.0, 32.0, 80.0), (49.0, 32.0, 50.0)]);
        let (_, ex) = detect_core(&img, w, h);
        assert_eq!(ex.objects.len(), 2, "{:?}", ex.objects);
    }
}
