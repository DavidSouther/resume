//! Sky background and noise maps, after the SExtractor background mesh
//! (Bertin & Arnouts 1996, section 3.1).
//!
//! The image is cut into tiles. Each tile's pixel values are sigma-clipped at
//! three standard deviations around their median until the clipped set stops
//! changing. The clipped standard deviation is the tile's noise. The tile's sky
//! level is the mode estimate `2.5 * median - 1.5 * mean`, or the median when
//! the clipped distribution is strongly skewed (`(mean - median) / sigma >
//! 0.3`). The tile grid is median filtered and then interpolated to every pixel
//! with a bicubic spline that passes through the tile centres.

use super::spline::Spline;

/// Tile and filter sizes for the background mesh, in pixels and tiles.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct BackgroundParams {
    pub tile_width: usize,
    pub tile_height: usize,
    pub filter_width: usize,
    pub filter_height: usize,
}

impl Default for BackgroundParams {
    fn default() -> Self {
        Self {
            tile_width: 64,
            tile_height: 64,
            filter_width: 3,
            filter_height: 3,
        }
    }
}

/// Per-pixel sky level and noise, row-major.
#[derive(Clone, Debug)]
pub struct Background {
    pub back: Vec<f32>,
    pub rms: Vec<f32>,
}

/// Sky level and noise of one tile.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct TileStats {
    pub back: f64,
    pub rms: f64,
}

/// Sigma-clip `values` and estimate the sky level and noise. Returns `None`
/// for an empty tile.
pub fn tile_stats(values: &mut [f64]) -> Option<TileStats> {
    if values.is_empty() {
        return None;
    }
    values.sort_unstable_by(f64::total_cmp);
    let (mut lo, mut hi) = (0, values.len());
    loop {
        let set = &values[lo..hi];
        let med = median_sorted(set);
        let (_, sigma) = mean_std(set);
        let new_lo = values.partition_point(|&v| v < med - 3.0 * sigma);
        let new_hi = values.partition_point(|&v| v <= med + 3.0 * sigma);
        if (new_lo, new_hi) == (lo, hi) || new_hi <= new_lo {
            break;
        }
        (lo, hi) = (new_lo, new_hi);
    }
    let set = &values[lo..hi];
    let med = median_sorted(set);
    let (mean, sigma) = mean_std(set);
    let back = if sigma <= 0.0 {
        mean
    } else if (mean - med) / sigma > 0.3 {
        med
    } else {
        2.5 * med - 1.5 * mean
    };
    Some(TileStats { back, rms: sigma })
}

fn median_sorted(sorted: &[f64]) -> f64 {
    let n = sorted.len();
    if n % 2 == 1 {
        sorted[n / 2]
    } else {
        0.5 * (sorted[n / 2 - 1] + sorted[n / 2])
    }
}

fn mean_std(values: &[f64]) -> (f64, f64) {
    let n = values.len() as f64;
    let mean = values.iter().sum::<f64>() / n;
    let var = values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / n;
    (mean, var.sqrt())
}

/// Median filter a `nx` by `ny` grid with a `fw` by `fh` window, shrinking the
/// window at the edges.
pub fn median_filter(grid: &[f64], nx: usize, ny: usize, fw: usize, fh: usize) -> Vec<f64> {
    let (hx, hy) = (fw / 2, fh / 2);
    let mut window = Vec::with_capacity(fw * fh);
    let mut out = vec![0.0; grid.len()];
    for j in 0..ny {
        for i in 0..nx {
            window.clear();
            for jj in j.saturating_sub(hy)..(j + hy + 1).min(ny) {
                for ii in i.saturating_sub(hx)..(i + hx + 1).min(nx) {
                    window.push(grid[jj * nx + ii]);
                }
            }
            window.sort_unstable_by(f64::total_cmp);
            out[j * nx + i] = median_sorted(&window);
        }
    }
    out
}

/// Centre of each tile along one axis, for tiles of `size` over `len` pixels.
/// A partial last tile keeps the centre a full tile would have, which agrees
/// better with SEP on the bundled sample.
fn tile_centres(len: usize, size: usize) -> Vec<f64> {
    (0..len.div_ceil(size))
        .map(|k| {
            let start = k * size;
            let end = start + size;
            0.5 * (start + end - 1) as f64
        })
        .collect()
}

/// Interpolate a tile grid to every pixel with a bicubic spline.
fn interpolate(grid: &[f64], xs: &[f64], ys: &[f64], width: usize, height: usize) -> Vec<f32> {
    let nx = xs.len();
    // Spline each tile column along y, evaluated at every pixel row.
    let columns: Vec<Vec<f64>> = (0..nx)
        .map(|i| {
            let values: Vec<f64> = (0..ys.len()).map(|j| grid[j * nx + i]).collect();
            let spline = Spline::natural(ys, &values);
            (0..height).map(|y| spline.eval(y as f64)).collect()
        })
        .collect();
    let mut out = vec![0.0f32; width * height];
    let mut row = vec![0.0; nx];
    for (y, line) in out.chunks_exact_mut(width).enumerate() {
        for (value, column) in row.iter_mut().zip(&columns) {
            *value = column[y];
        }
        let spline = Spline::natural(xs, &row);
        for (x, px) in line.iter_mut().enumerate() {
            *px = spline.eval(x as f64) as f32;
        }
    }
    out
}

/// Estimate the background and noise maps of `data`.
pub fn estimate(
    data: &[f32],
    width: usize,
    height: usize,
    params: &BackgroundParams,
) -> Background {
    let (bw, bh) = (params.tile_width.max(1), params.tile_height.max(1));
    let (nx, ny) = (width.div_ceil(bw), height.div_ceil(bh));
    let mut backs = vec![0.0; nx * ny];
    let mut rmss = vec![0.0; nx * ny];
    let mut values = Vec::with_capacity(bw * bh);
    for j in 0..ny {
        for i in 0..nx {
            values.clear();
            for y in j * bh..((j + 1) * bh).min(height) {
                let row = &data[y * width..(y + 1) * width];
                values.extend(
                    row[i * bw..((i + 1) * bw).min(width)]
                        .iter()
                        .map(|&v| f64::from(v))
                        .filter(|v| v.is_finite()),
                );
            }
            let stats = tile_stats(&mut values).unwrap_or(TileStats {
                back: 0.0,
                rms: 0.0,
            });
            backs[j * nx + i] = stats.back;
            rmss[j * nx + i] = stats.rms;
        }
    }
    let fw = params.filter_width.max(1);
    let fh = params.filter_height.max(1);
    let backs = median_filter(&backs, nx, ny, fw, fh);
    let rmss = median_filter(&rmss, nx, ny, fw, fh);
    let xs = tile_centres(width, bw);
    let ys = tile_centres(height, bh);
    Background {
        back: interpolate(&backs, &xs, &ys, width, height),
        rms: interpolate(&rmss, &xs, &ys, width, height),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flat_tile_gives_its_level_and_zero_noise() {
        let mut v = vec![7.0; 100];
        let s = tile_stats(&mut v).unwrap();
        assert_eq!(s.back, 7.0);
        assert_eq!(s.rms, 0.0);
    }

    #[test]
    fn clipping_rejects_a_bright_outlier() {
        // Symmetric noise around 10 plus one very bright source pixel.
        let mut v: Vec<f64> = (0..200)
            .map(|k| 10.0 + if k % 2 == 0 { 1.0 } else { -1.0 })
            .collect();
        v.push(1000.0);
        let s = tile_stats(&mut v).unwrap();
        assert!((s.back - 10.0).abs() < 1e-9, "back {}", s.back);
        assert!((s.rms - 1.0).abs() < 1e-9, "rms {}", s.rms);
    }

    #[test]
    fn median_filter_removes_a_single_bad_tile() {
        let mut grid = vec![1.0; 9];
        grid[4] = 50.0;
        let out = median_filter(&grid, 3, 3, 3, 3);
        assert_eq!(out[4], 1.0);
    }

    #[test]
    fn constant_image_gives_constant_maps() {
        let (w, h) = (130, 70);
        let data = vec![3.5f32; w * h];
        let bg = estimate(&data, w, h, &BackgroundParams::default());
        assert!(bg.back.iter().all(|&b| (b - 3.5).abs() < 1e-5));
        assert!(bg.rms.iter().all(|&r| r.abs() < 1e-5));
    }

    #[test]
    fn gradient_is_followed() {
        let (w, h) = (256, 64);
        let data: Vec<f32> = (0..w * h).map(|i| (i % w) as f32 * 0.1).collect();
        let bg = estimate(
            &data,
            w,
            h,
            &BackgroundParams {
                filter_width: 1,
                filter_height: 1,
                ..Default::default()
            },
        );
        // Mid-image the spline through tile centres reproduces a linear ramp.
        let x = 100;
        assert!((bg.back[32 * w + x] - x as f32 * 0.1).abs() < 0.2);
    }
}
