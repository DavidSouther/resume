//! Multi-threshold deblending (Bertin & Arnouts 1996, section 5).
//!
//! An object's detection values are re-thresholded at `levels` exponentially
//! spaced levels between the detection threshold and its peak, which grows a
//! tree of nested components. At a node, a child branch counts as a separate
//! object when its detection flux above its own level exceeds `contrast` times
//! the flux of the whole object above the detection threshold;
//! the node splits when at least two children count. The split propagates
//! upward from the tips. Pixels below the split levels go to the component
//! whose bivariate Gaussian model, built from its moments and peak, predicts
//! the most light there.

use super::moments::measure;
use super::segment::Labeler;

/// Deblending settings, named as in SExtractor.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct DeblendParams {
    /// Number of thresholds between the detection level and the peak.
    pub levels: usize,
    /// Minimum fraction of the total flux for a branch to split off.
    pub contrast: f64,
    /// Minimum pixel count for a branch to split off.
    pub min_area: usize,
}

impl Default for DeblendParams {
    fn default() -> Self {
        Self {
            levels: 32,
            contrast: 0.005,
            min_area: 5,
        }
    }
}

struct Tree<'a> {
    det: &'a [f32],
    thresholds: Vec<f32>,
    min_flux: f64,
    min_area: usize,
    labeler: &'a mut Labeler,
}

impl Tree<'_> {
    /// Detection flux of `pixels` above the level `t`.
    fn flux_above(&self, pixels: &[u32], t: f32) -> f64 {
        pixels
            .iter()
            .map(|&p| f64::from(self.det[p as usize] - t))
            .sum()
    }

    /// The objects inside `node`, which sits at threshold index `level`.
    fn branches(&mut self, node: &[u32], level: usize) -> Vec<Vec<u32>> {
        let Some(&t) = self.thresholds.get(level + 1) else {
            return vec![node.to_vec()];
        };
        let det = self.det;
        let kids: Vec<Vec<u32>> = self
            .labeler
            .components(node, |p| det[p as usize] > t)
            .into_iter()
            .filter(|c| c.len() >= self.min_area && self.flux_above(c, t) > self.min_flux)
            .collect();
        match kids.len() {
            0 => vec![node.to_vec()],
            1 => {
                let inner = self.branches(&kids[0], level + 1);
                if inner.len() >= 2 {
                    inner
                } else {
                    vec![node.to_vec()]
                }
            }
            _ => kids
                .iter()
                .flat_map(|k| self.branches(k, level + 1))
                .collect(),
        }
    }
}

/// Split `root`, a connected set of pixels whose detection values `det` all
/// exceed `base`, into deblended objects. `data` holds the measurement image.
pub fn deblend(
    root: Vec<u32>,
    det: &[f32],
    data: &[f32],
    base: f32,
    width: usize,
    labeler: &mut Labeler,
    params: &DeblendParams,
) -> Vec<Vec<u32>> {
    let peak = root
        .iter()
        .map(|&p| det[p as usize])
        .fold(f32::NEG_INFINITY, f32::max);
    if params.levels < 2 || params.contrast >= 1.0 || base <= 0.0 || peak <= base {
        return vec![root];
    }
    let ratio = f64::from(peak) / f64::from(base);
    let thresholds: Vec<f32> = (0..params.levels)
        .map(|k| (f64::from(base) * ratio.powf(k as f64 / params.levels as f64)) as f32)
        .collect();
    let mut tree = Tree {
        det,
        thresholds,
        min_flux: 0.0,
        min_area: params.min_area.max(1),
        labeler,
    };
    tree.min_flux = params.contrast * tree.flux_above(&root, base);
    let seeds = tree.branches(&root, 0);
    if seeds.len() < 2 {
        return vec![root];
    }
    assign(&root, seeds, data, width)
}

/// A component's light model: a bivariate Gaussian from its moments.
struct Gaussian {
    cx: f64,
    cy: f64,
    /// Inverse covariance.
    ixx: f64,
    iyy: f64,
    ixy: f64,
    log_amp: f64,
}

impl Gaussian {
    fn of(pixels: &[u32], data: &[f32], width: usize) -> Self {
        let m = measure(pixels, data, width);
        // A pixel is a unit square, so add its variance (1/12) to each axis.
        let (xx, yy, xy) = (m.x2 + 1.0 / 12.0, m.y2 + 1.0 / 12.0, m.xy);
        let det = (xx * yy - xy * xy).max(1e-9);
        Self {
            cx: m.cx,
            cy: m.cy,
            ixx: yy / det,
            iyy: xx / det,
            ixy: -xy / det,
            log_amp: m.peak.max(1e-12).ln(),
        }
    }

    fn log_density(&self, x: f64, y: f64) -> f64 {
        let (dx, dy) = (x - self.cx, y - self.cy);
        self.log_amp - 0.5 * (self.ixx * dx * dx + self.iyy * dy * dy + 2.0 * self.ixy * dx * dy)
    }
}

/// Give every root pixel outside the seeds to the seed whose Gaussian model is
/// brightest there.
fn assign(root: &[u32], mut seeds: Vec<Vec<u32>>, data: &[f32], width: usize) -> Vec<Vec<u32>> {
    let (mut x0, mut y0, mut x1, mut y1) = (usize::MAX, usize::MAX, 0, 0);
    for &p in root {
        let (x, y) = (p as usize % width, p as usize / width);
        x0 = x0.min(x);
        y0 = y0.min(y);
        x1 = x1.max(x);
        y1 = y1.max(y);
    }
    let bw = x1 - x0 + 1;
    let local = |p: u32| (p as usize / width - y0) * bw + (p as usize % width - x0);
    let mut owned = vec![false; bw * (y1 - y0 + 1)];
    for seed in &seeds {
        for &p in seed {
            owned[local(p)] = true;
        }
    }
    let models: Vec<Gaussian> = seeds.iter().map(|s| Gaussian::of(s, data, width)).collect();
    for &p in root {
        if owned[local(p)] {
            continue;
        }
        let (x, y) = ((p as usize % width) as f64, (p as usize / width) as f64);
        let best = models
            .iter()
            .map(|g| g.log_density(x, y))
            .enumerate()
            .max_by(|a, b| a.1.total_cmp(&b.1))
            .map_or(0, |(k, _)| k);
        seeds[best].push(p);
    }
    seeds
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Two Gaussian blobs on a 40 by 20 image, joined by a faint bridge.
    fn pair(gap_flux: f32) -> (usize, usize, Vec<f32>) {
        let (w, h) = (40, 20);
        let mut img = vec![0.0f32; w * h];
        for (i, v) in img.iter_mut().enumerate() {
            let (x, y) = ((i % w) as f32, (i / w) as f32);
            let g =
                |cx: f32, amp: f32| amp * (-((x - cx).powi(2) + (y - 10.0).powi(2)) / 8.0).exp();
            *v = g(12.0, 100.0)
                + g(28.0, 60.0)
                + if (y - 10.0).abs() < 1.5 {
                    gap_flux
                } else {
                    0.0
                };
        }
        (w, h, img)
    }

    fn root(img: &[f32], base: f32) -> Vec<u32> {
        (0..img.len() as u32)
            .filter(|&p| img[p as usize] > base)
            .collect()
    }

    #[test]
    fn two_bright_peaks_split() {
        let (w, h, img) = pair(2.0);
        let base = 1.5;
        let r = root(&img, base);
        let mut lab = Labeler::new(w, h);
        let parts = deblend(
            r.clone(),
            &img,
            &img,
            base,
            w,
            &mut lab,
            &DeblendParams::default(),
        );
        assert_eq!(parts.len(), 2);
        assert_eq!(parts.iter().map(Vec::len).sum::<usize>(), r.len());
        let left = parts
            .iter()
            .find(|p| p.contains(&(10 * w as u32 + 12)))
            .unwrap();
        assert!(left.contains(&(10 * w as u32 + 15)));
        assert!(!left.contains(&(10 * w as u32 + 25)));
    }

    #[test]
    fn faint_bump_below_contrast_stays_joined() {
        let (w, h, img) = pair(2.0);
        let base = 1.5;
        let mut lab = Labeler::new(w, h);
        let params = DeblendParams {
            contrast: 0.6,
            ..Default::default()
        };
        let parts = deblend(root(&img, base), &img, &img, base, w, &mut lab, &params);
        assert_eq!(parts.len(), 1);
    }

    #[test]
    fn single_peak_is_untouched() {
        let (w, h) = (15, 15);
        let img: Vec<f32> = (0..w * h)
            .map(|i| {
                let (x, y) = ((i % w) as f32 - 7.0, (i / w) as f32 - 7.0);
                50.0 * (-(x * x + y * y) / 6.0).exp()
            })
            .collect();
        let r = root(&img, 1.0);
        let mut lab = Labeler::new(w, h);
        let parts = deblend(
            r.clone(),
            &img,
            &img,
            1.0,
            w,
            &mut lab,
            &DeblendParams::default(),
        );
        assert_eq!(parts, vec![r]);
    }
}
