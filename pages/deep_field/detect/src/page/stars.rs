//! Diffraction-spike star finder.
//!
//! For each bright source, the light along both opposite rays at every angle
//! is measured. Spikes are point-symmetric, so the weaker of the two rays keeps
//! a spike and drops a neighbouring galaxy. The angles shared by the brightest
//! sources are the exposure's spike pattern, and a source is a star when it
//! shows sharp peaks at those angles.

use super::measure::{Blob, Planes};
use super::Options;

const ANGLES: usize = 180;

/// `Math.max` semantics: NaN if either argument is NaN.
fn js_max(a: f64, b: f64) -> f64 {
    if a.is_nan() || b.is_nan() {
        f64::NAN
    } else {
        a.max(b)
    }
}

/// `Math.round` semantics: halves round toward positive infinity.
fn js_round(v: f64) -> f64 {
    (v + 0.5).floor()
}

/// Upper median, `sorted[len / 2]`, of the values.
fn upper_median(mut v: Vec<f64>) -> f64 {
    v.sort_by(f64::total_cmp);
    v[v.len() / 2]
}

/// Sky-subtracted significance at the nearest pixel, NaN outside the image.
fn sample(im: &Planes, x: f64, y: f64) -> f64 {
    let (xi, yi) = (js_round(x), js_round(y));
    if xi < 0.0 || yi < 0.0 || xi >= im.width as f64 || yi >= im.height as f64 {
        return f64::NAN;
    }
    let i = yi as usize * im.width + xi as usize;
    f64::from((im.lum[i] - im.back[i]).max(0.0) / im.sigma[i])
}

/// Angular profile of one source: for each degree, the lesser of the median
/// light along the two opposite rays, less the median over all angles.
#[derive(Clone, Debug)]
pub struct Profile {
    pub p: [f64; ANGLES],
    /// Core radius: where the azimuthal mean falls below a fifth of the peak.
    pub rc: usize,
    pub nan_frac: f64,
}

pub fn angular_profile(im: &Planes, s: &Blob) -> Profile {
    let (px, py) = (s.px as f64, s.py as f64);
    let pk = sample(im, px, py);
    let mut rc = 2;
    for r in 1..40 {
        let rf = r as f64;
        let m: f64 = (0..16)
            .map(|a| {
                let t = f64::from(a) * std::f64::consts::PI / 8.0;
                let v = sample(im, px + rf * t.cos(), py + rf * t.sin());
                if v.is_nan() {
                    0.0
                } else {
                    v
                }
            })
            .sum();
        rc = r;
        if m / 16.0 < 0.2 * pk {
            break;
        }
    }
    let r0 = js_round(rc as f64 * 1.5) as usize + 2;
    let r1 = r0 + 12usize.max(js_round(rc as f64 * 3.0) as usize);
    let mut p = [0.0; ANGLES];
    for (a, slot) in p.iter_mut().enumerate() {
        let t = a as f64 * std::f64::consts::PI / 180.0;
        let (c, sn) = (t.cos(), t.sin());
        let fwd: Vec<f64> = (r0..=r1)
            .map(|r| sample(im, px + r as f64 * c, py + r as f64 * sn))
            .collect();
        let back: Vec<f64> = (r0..=r1)
            .map(|r| sample(im, px - r as f64 * c, py - r as f64 * sn))
            .collect();
        *slot = if fwd.iter().chain(&back).any(|v| v.is_nan()) {
            f64::NAN
        } else {
            upper_median(fwd).min(upper_median(back))
        };
    }
    let ok: Vec<f64> = p.iter().copied().filter(|v| !v.is_nan()).collect();
    let nan = ANGLES - ok.len();
    let med = if ok.is_empty() { 0.0 } else { upper_median(ok) };
    for v in &mut p {
        *v -= med;
    }
    Profile {
        p,
        rc,
        nan_frac: nan as f64 / ANGLES as f64,
    }
}

/// Robust noise of a profile from its lower quartile; huge when too few
/// angles are usable.
pub fn robust_noise(p: &[f64; ANGLES]) -> f64 {
    let mut v: Vec<f64> = p.iter().copied().filter(|x| !x.is_nan()).collect();
    if v.len() < 20 {
        return 1e9;
    }
    v.sort_by(f64::total_cmp);
    let n = v.len();
    (1.4826 * (v[n / 2] - v[n / 4])).max(0.3)
}

fn at(p: &[f64; ANGLES], a: usize) -> f64 {
    p[a % ANGLES]
}

/// Angles that are sharp local maxima well above the profile's noise.
pub fn sharp_peaks(p: &[f64; ANGLES]) -> Vec<usize> {
    let nz = robust_noise(p);
    (0..ANGLES)
        .filter(|&a| {
            let v = p[a];
            let mut ok = !v.is_nan() && v >= 4.0 * nz;
            for d in 1..=3 {
                if !ok {
                    break;
                }
                if at(p, a + d) > v || at(p, a + ANGLES - d) > v {
                    ok = false;
                }
            }
            ok && v - js_max(at(p, a + 7), at(p, a + 173)) > 3.0 * nz
        })
        .collect()
}

/// The exposure's spike angles: the up to six best-supported local maxima of
/// the brightest sources' sharp peaks, at least 8 degrees apart.
pub fn spike_angles(profiles: &[&Profile]) -> Vec<usize> {
    let mut votes = [0.0f64; ANGLES];
    for prof in profiles {
        for a in sharp_peaks(&prof.p) {
            votes[(a + ANGLES - 1) % ANGLES] += 0.5;
            votes[a] += 1.0;
            votes[(a + 1) % ANGLES] += 0.5;
        }
    }
    let mut found: Vec<(usize, f64)> = Vec::new();
    for a in 0..ANGLES {
        let v = votes[a];
        if v < 2.5 {
            continue;
        }
        let is_max =
            (1..=4).all(|d| !(votes[(a + d) % ANGLES] > v || votes[(a + ANGLES - d) % ANGLES] > v));
        let apart = found.iter().all(|&(o, _)| {
            let d = o.abs_diff(a);
            d.min(ANGLES - d) >= 8
        });
        if is_max && apart {
            found.push((a, v));
        }
    }
    found.sort_by(|p, q| q.1.total_cmp(&p.1));
    found.truncate(6);
    found.into_iter().map(|(a, _)| a).collect()
}

/// Find stars among `blobs`, setting `is_star` and `spike`. Returns the spike
/// angles in degrees.
pub fn find_stars(blobs: &mut [Blob], im: &Planes, opt: &Options) -> Vec<usize> {
    let cand: Vec<usize> = (0..blobs.len())
        .filter(|&k| blobs[k].area >= 12 && blobs[k].peak >= 20.0)
        .collect();
    let profiles: Vec<Profile> = cand
        .iter()
        .map(|&k| angular_profile(im, &blobs[k]))
        .collect();
    let mut bright: Vec<usize> = (0..cand.len())
        .filter(|&c| profiles[c].nan_frac < 0.2)
        .collect();
    bright.sort_by(|&p, &q| blobs[cand[q]].peak.total_cmp(&blobs[cand[p]].peak));
    bright.truncate(40);
    let voters: Vec<&Profile> = bright.iter().map(|&c| &profiles[c]).collect();
    let angles = spike_angles(&voters);
    if angles.len() < 2 {
        return angles;
    }
    let max_peak = cand.iter().map(|&k| blobs[k].peak).fold(0.0, f64::max);
    let short_side = im.width.min(im.height) as f64;
    for (c, &k) in cand.iter().enumerate() {
        let prof = &profiles[c];
        let p = &prof.p;
        let nz = robust_noise(p);
        let (mut hits, mut sum, mut best, mut best_v, mut n) = (0, 0.0, 0.0, 0.0, 0);
        for &a in &angles {
            let v = js_max(js_max(p[a], at(p, a + 179)), at(p, a + 1));
            let sh = [at(p, a + 7), at(p, a + 173), at(p, a + 10), at(p, a + 170)];
            if v.is_nan() || sh.iter().any(|x| x.is_nan()) {
                continue;
            }
            let c = (v - sh.iter().copied().fold(f64::NEG_INFINITY, f64::max)) / nz;
            n += 1;
            sum += c.max(0.0);
            if c > best {
                best = c;
                best_v = v;
            }
            if c > opt.spike_contrast && v > 0.5 {
                hits += 1;
            }
        }
        let s = &mut blobs[k];
        s.spike = if n > 0 { sum / f64::from(n) } else { 0.0 };
        let two_spikes = hits >= 2 && s.spike > opt.spike_score;
        let one_spike_bright_core = best > 3.0
            && best_v > 1.0
            && s.peak >= opt.star_peak_frac * max_peak
            && s.color < opt.star_max_color;
        let rc = prof.rc as f64;
        s.is_star = (two_spikes || one_spike_bright_core) && rc >= 2.0 && rc <= 0.025 * short_side;
    }
    angles
}

#[cfg(test)]
mod tests {
    use super::super::measure::{measure, tests::Owned};
    use super::*;

    /// A star at the centre of a 161 px square: a bright core plus four
    /// spikes along 0, 45, 90 and 135 degrees.
    fn star_field(spikes: bool) -> Owned {
        let c = 80.0f64;
        Owned::new(161, 161, |x, y| {
            let (dx, dy) = (x as f64 - c, y as f64 - c);
            let r = dx.hypot(dy);
            let core = 200.0 * (-(r * r) / 4.0).exp();
            let on_spike =
                spikes && (dx.abs() < 0.6 || dy.abs() < 0.6 || (dx.abs() - dy.abs()).abs() < 0.8);
            let spike = if on_spike && r > 1.0 { 30.0 } else { 0.0 };
            let v = (10.0 + core + spike).min(255.0) as u8;
            [v, v, v]
        })
    }

    fn core_blob(o: &Owned) -> Blob {
        let w = o.width;
        let pixels: Vec<u32> = (0..(w * o.height) as u32)
            .filter(|&p| {
                let (x, y) = (
                    (p as usize % w) as f64 - 80.0,
                    (p as usize / w) as f64 - 80.0,
                );
                x.hypot(y) <= 3.0
            })
            .collect();
        measure(1, pixels, &o.planes())
    }

    #[test]
    fn profile_shows_spike_angles() {
        let o = star_field(true);
        let b = core_blob(&o);
        let prof = angular_profile(&o.planes(), &b);
        let peaks = sharp_peaks(&prof.p);
        for a in [0, 45, 90, 135] {
            assert!(
                peaks.iter().any(|&p| p.abs_diff(a) <= 1),
                "missing {a} in {peaks:?}"
            );
        }
    }

    #[test]
    fn plain_core_has_no_sharp_peaks() {
        let o = star_field(false);
        let b = core_blob(&o);
        let prof = angular_profile(&o.planes(), &b);
        assert!(sharp_peaks(&prof.p).is_empty());
    }

    #[test]
    fn votes_from_three_sources_fix_the_angles() {
        let mut p = [0.0; ANGLES];
        p[30] = 10.0;
        p[120] = 10.0;
        let prof = Profile {
            p,
            rc: 2,
            nan_frac: 0.0,
        };
        let angles = spike_angles(&[&prof, &prof, &prof]);
        assert_eq!(angles.len(), 2);
        assert!(angles.contains(&30) && angles.contains(&120));
    }

    #[test]
    fn spiked_source_is_a_star() {
        let o = star_field(true);
        let mut blobs = vec![core_blob(&o), core_blob(&o), core_blob(&o)];
        let angles = find_stars(&mut blobs, &o.planes(), &Options::default());
        assert!(angles.len() >= 2, "{angles:?}");
        assert!(blobs[0].is_star);
        assert!(blobs[0].spike > 0.0);
    }

    #[test]
    fn js_round_matches_math_round() {
        assert_eq!(js_round(-0.5), 0.0);
        assert_eq!(js_round(2.5), 3.0);
        assert_eq!(js_round(-1.2), -1.0);
    }
}
