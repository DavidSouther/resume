//! Detection filtering. The matched filter weights each kernel tap by the
//! inverse variance of its pixel and divides by the propagated noise, so the
//! output is a signal-to-noise image (SEP documentation, "Matched Filter"):
//!
//! ```text
//! snr(x) = sum_k T_k D_{x+k} / s_{x+k}^2  /  sqrt(sum_k T_k^2 / s_{x+k}^2)
//! ```
//!
//! Taps that fall outside the image are left out of both sums.

/// A small odd-sized convolution kernel.
#[derive(Clone, Debug, PartialEq)]
pub struct Kernel {
    pub width: usize,
    pub height: usize,
    pub taps: Vec<f32>,
}

impl Kernel {
    /// SExtractor's default 3 by 3 pyramidal kernel.
    pub fn default_3x3() -> Self {
        Self {
            width: 3,
            height: 3,
            taps: vec![1.0, 2.0, 1.0, 2.0, 4.0, 2.0, 1.0, 2.0, 1.0],
        }
    }

    /// Visit each in-image tap around `(x, y)` as `(pixel index, weight)`.
    fn for_each_tap(
        &self,
        x: usize,
        y: usize,
        width: usize,
        height: usize,
        mut f: impl FnMut(usize, f64),
    ) {
        let (hx, hy) = ((self.width / 2) as isize, (self.height / 2) as isize);
        for (ky, row) in self.taps.chunks_exact(self.width).enumerate() {
            let yy = y as isize + ky as isize - hy;
            if yy < 0 || yy >= height as isize {
                continue;
            }
            for (kx, &t) in row.iter().enumerate() {
                let xx = x as isize + kx as isize - hx;
                if xx < 0 || xx >= width as isize || t == 0.0 {
                    continue;
                }
                f(yy as usize * width + xx as usize, f64::from(t));
            }
        }
    }
}

/// Matched-filter signal-to-noise image of `data` with per-pixel noise `rms`.
pub fn matched(
    data: &[f32],
    rms: &[f32],
    width: usize,
    height: usize,
    kernel: &Kernel,
) -> Vec<f32> {
    let mut out = vec![0.0f32; width * height];
    for y in 0..height {
        for x in 0..width {
            let (mut num, mut den) = (0.0f64, 0.0f64);
            kernel.for_each_tap(x, y, width, height, |i, t| {
                let var = f64::from(rms[i]).powi(2);
                if var > 0.0 {
                    num += t * f64::from(data[i]) / var;
                    den += t * t / var;
                }
            });
            out[y * width + x] = if den > 0.0 {
                (num / den.sqrt()) as f32
            } else {
                0.0
            };
        }
    }
    out
}

/// Convolution of `data` with `kernel`, normalised by the in-image tap sum.
pub fn convolve(data: &[f32], width: usize, height: usize, kernel: &Kernel) -> Vec<f32> {
    let mut out = vec![0.0f32; width * height];
    for y in 0..height {
        for x in 0..width {
            let (mut sum, mut weight) = (0.0f64, 0.0f64);
            kernel.for_each_tap(x, y, width, height, |i, t| {
                sum += t * f64::from(data[i]);
                weight += t;
            });
            out[y * width + x] = if weight > 0.0 {
                (sum / weight) as f32
            } else {
                0.0
            };
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matched_filter_of_flat_signal_is_snr_gain() {
        // Constant signal 1 with unit noise: snr = sum T / sqrt(sum T^2) = 16 / 6.
        let (w, h) = (5, 5);
        let data = vec![1.0f32; w * h];
        let rms = vec![1.0f32; w * h];
        let out = matched(&data, &rms, w, h, &Kernel::default_3x3());
        assert!((out[2 * w + 2] - 16.0 / 6.0).abs() < 1e-6);
    }

    #[test]
    fn matched_filter_scales_with_noise() {
        let (w, h) = (3, 3);
        let data = vec![2.0f32; 9];
        let one = matched(&data, &[1.0; 9], w, h, &Kernel::default_3x3());
        let two = matched(&data, &[2.0; 9], w, h, &Kernel::default_3x3());
        assert!((one[4] - 2.0 * two[4]).abs() < 1e-6);
    }

    #[test]
    fn convolution_preserves_a_constant() {
        let (w, h) = (4, 3);
        let out = convolve(&[5.0; 12], w, h, &Kernel::default_3x3());
        assert!(out.iter().all(|&v| (v - 5.0).abs() < 1e-6));
    }
}
