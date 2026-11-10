//! Near, mid and far classification and near-galaxy fragment grouping.
//!
//! Near galaxies are large and clearly bluer than the field: in a deep-field
//! colour composite, redshift pushes light into the redder filters, so
//! foreground star-forming galaxies stand out blue. Far galaxies are barely
//! resolved; mid galaxies are the rest. Deblending can cut a big spiral's
//! outer arm into pieces, so a piece that touches a near galaxy, lies inside
//! a multiple of its moment ellipse and is bluer than the field joins its
//! group.

use super::measure::{Blob, Class};
use super::Options;

/// Median colour of resolved non-star sources, the field reference.
pub fn field_color(blobs: &[Blob], opt: &Options) -> f64 {
    let mut gal: Vec<f64> = blobs
        .iter()
        .filter(|s| !s.is_star && s.area as f64 >= opt.far_area)
        .map(|s| s.color)
        .collect();
    gal.sort_by(f64::total_cmp);
    gal.get(gal.len() / 2).copied().unwrap_or(0.0)
}

/// Assign each blob its class.
pub fn classify(blobs: &mut [Blob], field_color: f64, pixel_count: usize, opt: &Options) {
    let near_area = opt.near_frac * pixel_count as f64;
    for s in blobs {
        let area = s.area as f64;
        s.cls = if s.is_star {
            Class::Star
        } else if area >= near_area && s.color < field_color - opt.near_bluer {
            Class::Near
        } else if area >= opt.far_area {
            Class::Mid
        } else {
            Class::Far
        };
    }
}

/// Ids of the blobs 4-adjacent to `s`, in first-seen order.
fn neighbours(s: &Blob, labels: &[i32], width: usize, height: usize) -> Vec<u32> {
    let mut out: Vec<u32> = Vec::new();
    for &p in &s.pixels {
        let (x, y) = (p as usize % width, p as usize / width);
        let steps = [
            (x + 1 < width).then(|| p as usize + 1),
            (x > 0).then(|| p as usize - 1),
            (y + 1 < height).then(|| p as usize + width),
            (y > 0).then(|| p as usize - width),
        ];
        for q in steps.into_iter().flatten() {
            let l = labels[q];
            if l > 0 && l as u32 != s.id && !out.contains(&(l as u32)) {
                out.push(l as u32);
            }
        }
    }
    out
}

/// Group near-galaxy fragments. `blobs[k].id` must be `k + 1`, and `labels`
/// holds each pixel's blob id or 0.
pub fn group_fragments(
    blobs: &mut [Blob],
    labels: &[i32],
    width: usize,
    height: usize,
    field_color: f64,
    opt: &Options,
) {
    let mut near: Vec<usize> = (0..blobs.len())
        .filter(|&k| blobs[k].cls == Class::Near)
        .collect();
    near.sort_by(|&a, &b| blobs[b].area.cmp(&blobs[a].area));
    for k in near {
        if blobs[k].group.is_some() {
            continue;
        }
        let p = &blobs[k];
        let (id, pcx, pcy) = (p.id, p.cx, p.cy);
        let (ct, st) = (p.theta.cos(), p.theta.sin());
        let a = opt.group_scale * 2.0 * p.major;
        let b = opt.group_scale * 2.0 * p.minor;
        blobs[k].group = Some(id);
        let mut queue = std::collections::VecDeque::from([k]);
        while let Some(cur) = queue.pop_front() {
            for l in neighbours(&blobs[cur], labels, width, height) {
                let qi = l as usize - 1;
                let q = &mut blobs[qi];
                if q.is_star || q.group.is_some() {
                    continue;
                }
                let (dx, dy) = (q.cx - pcx, q.cy - pcy);
                let u = dx * ct + dy * st;
                let v = -dx * st + dy * ct;
                if u * u / (a * a) + v * v / (b * b) <= 1.0 && q.color < field_color {
                    q.group = Some(id);
                    q.cls = Class::Near;
                    q.fragment = true;
                    queue.push_back(qi);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn blob(id: u32, pixels: Vec<u32>, cx: f64, cy: f64, color: f64) -> Blob {
        Blob {
            id,
            area: pixels.len(),
            pixels,
            flux: 1.0,
            x0: 0,
            y0: 0,
            x1: 0,
            y1: 0,
            peak: 1.0,
            px: 0,
            py: 0,
            cx,
            cy,
            major: 3.0,
            minor: 2.0,
            theta: 0.0,
            color,
            spike: 0.0,
            is_star: false,
            cls: Class::Far,
            group: None,
            fragment: false,
        }
    }

    #[test]
    fn classes_follow_area_and_colour() {
        let opt = Options {
            far_area: 3.0,
            near_frac: 0.05,
            ..Options::default()
        };
        let mut blobs = vec![
            blob(1, (0..10).collect(), 0.0, 0.0, -1.0), // large and blue: near
            blob(2, (0..10).collect(), 0.0, 0.0, 0.0),  // large, field colour: mid
            blob(3, (0..2).collect(), 0.0, 0.0, -1.0),  // small: far
        ];
        blobs[1].color = 0.0;
        let fc = field_color(&blobs, &opt);
        classify(&mut blobs, fc, 100, &opt);
        let cls: Vec<Class> = blobs.iter().map(|b| b.cls).collect();
        assert_eq!(cls, vec![Class::Near, Class::Mid, Class::Far]);
    }

    #[test]
    fn stars_keep_their_class() {
        let mut blobs = vec![blob(1, vec![0], 0.0, 0.0, -5.0)];
        blobs[0].is_star = true;
        classify(&mut blobs, 0.0, 1, &Options::default());
        assert_eq!(blobs[0].cls, Class::Star);
    }

    #[test]
    fn touching_blue_fragment_joins_near_group() {
        // Row of 10 px: near galaxy on 0..5, a blue fragment on 5..7, a red one on 7..10.
        let (w, h) = (10, 1);
        let mut blobs = vec![
            blob(1, (0..5).collect(), 2.0, 0.0, -1.0),
            blob(2, (5..7).collect(), 5.5, 0.0, -0.5),
            blob(3, (7..10).collect(), 8.0, 0.0, 0.5),
        ];
        blobs[0].cls = Class::Near;
        let mut labels = vec![0i32; w * h];
        for b in &blobs {
            for &p in &b.pixels {
                labels[p as usize] = b.id as i32;
            }
        }
        group_fragments(&mut blobs, &labels, w, h, 0.0, &Options::default());
        assert_eq!(blobs[1].group, Some(1));
        assert!(blobs[1].fragment);
        assert_eq!(blobs[1].cls, Class::Near);
        assert_eq!(blobs[2].group, None, "redder than the field");
    }
}
