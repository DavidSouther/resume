//! Cleaning of spurious detections (SExtractor's CLEAN and CLEAN_PARAM).
//!
//! The SExtractor documentation describes cleaning as subtracting from each
//! object the light its brighter neighbours spread over it, modelled by a
//! profile with index CLEAN_PARAM, and dropping the object if it would not have
//! been detected without that light. Here each neighbour is a Moffat profile
//! `peak * (1 + r^2 / ALPHA2)^-beta`, with `r` measured in its moment ellipse.
//! Objects are visited brightest first, and an object is kept when its
//! detection signal-to-noise peak, less the summed wings of the objects already
//! kept, still reaches the detection threshold at that pixel. As in SEP, a cleaned object
//! is dropped, not merged into its neighbour.
//!
//! The scale `ALPHA2` is not given in the published method. It was calibrated
//! by running SEP as a black box on the bundled sample.

use super::moments::measure;

/// Square of the Moffat scale, in units of the moment ellipse.
const ALPHA2: f64 = 0.65;

struct Profile {
    cx: f64,
    cy: f64,
    ixx: f64,
    iyy: f64,
    ixy: f64,
    flux: f64,
    peak: f64,
    /// Highest detection signal-to-noise and the response to a unit signal there.
    detection_peak: f64,
    response: f64,
    detection_x: f64,
    detection_y: f64,
}

impl Profile {
    fn of(pixels: &[u32], data: &[f32], detection: &[f32], response: &[f32], width: usize) -> Self {
        let m = measure(pixels, data, width);
        let (xx, yy, xy) = (m.x2 + 1.0 / 12.0, m.y2 + 1.0 / 12.0, m.xy);
        let d = (xx * yy - xy * xy).max(1e-9);
        let top = pixels
            .iter()
            .copied()
            .max_by(|&a, &b| detection[a as usize].total_cmp(&detection[b as usize]))
            .map_or(0, |p| p as usize);
        Self {
            cx: m.cx,
            cy: m.cy,
            ixx: yy / d,
            iyy: xx / d,
            ixy: -xy / d,
            flux: m.flux,
            peak: m.peak,
            detection_peak: f64::from(detection[top]),
            response: f64::from(response[top]),
            detection_x: (top % width) as f64,
            detection_y: (top / width) as f64,
        }
    }

    /// This profile's wing at `(x, y)`.
    fn wing(&self, x: f64, y: f64, beta: f64) -> f64 {
        let (dx, dy) = (x - self.cx, y - self.cy);
        let r2 = self.ixx * dx * dx + self.iyy * dy * dy + 2.0 * self.ixy * dx * dy;
        self.peak.max(0.0) * (1.0 + r2 / ALPHA2).powf(-beta)
    }
}

/// Drop objects that would not clear the threshold without their brighter
/// neighbours' wings. `detection` and `thresh` are in signal-to-noise units;
/// `response` converts a locally constant signal in data units to detection units.
pub fn clean(
    pixels: Vec<Vec<u32>>,
    data: &[f32],
    detection: &[f32],
    response: &[f32],
    width: usize,
    thresh: f32,
    beta: f64,
) -> Vec<Vec<u32>> {
    let profiles: Vec<Profile> = pixels
        .iter()
        .map(|p| Profile::of(p, data, detection, response, width))
        .collect();
    // Brightest first, so only objects already kept spread wings.
    let mut order: Vec<usize> = (0..profiles.len()).collect();
    order.sort_by(|&a, &b| profiles[b].flux.total_cmp(&profiles[a].flux));
    let mut keep = vec![false; profiles.len()];
    let mut kept: Vec<usize> = Vec::new();
    for j in order {
        let pj = &profiles[j];
        let wings: f64 = kept
            .iter()
            .map(|&i| profiles[i].wing(pj.detection_x, pj.detection_y, beta))
            .sum();
        if pj.detection_peak - wings * pj.response >= f64::from(thresh) {
            keep[j] = true;
            kept.push(j);
        }
    }
    pixels
        .into_iter()
        .zip(keep)
        .filter_map(|(p, k)| k.then_some(p))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn faint_object_beside_a_bright_one_is_dropped() {
        // A bright object at x = 2..5 and a faint one at x = 8..11 on a row.
        let w = 16;
        let data: Vec<f32> = (0..w)
            .map(|x| {
                if (2..5).contains(&x) {
                    1000.0
                } else if (8..11).contains(&x) {
                    10.0
                } else {
                    0.0
                }
            })
            .collect();
        let rms = vec![1.0f32; w];
        let out = clean(
            vec![(2..5).collect(), (8..11).collect()],
            &data,
            &data,
            &rms,
            w,
            5.0,
            1.0,
        );
        assert_eq!(out, vec![(2..5).collect::<Vec<u32>>()]);
    }

    #[test]
    fn isolated_bright_objects_survive() {
        let w = 400;
        let mut data = vec![0.0f32; w];
        data[10..15].fill(50.0);
        data[380..385].fill(40.0);
        let rms = vec![1.0f32; w];
        let out = clean(
            vec![(10..15).collect(), (380..385).collect()],
            &data,
            &data,
            &rms,
            w,
            5.0,
            1.0,
        );
        assert_eq!(out.len(), 2);
    }

    #[test]
    fn neighbour_wings_are_checked_at_the_detection_peak_not_the_centroid() {
        let w = 20;
        let mut data = vec![0.0; w];
        data[0..5].fill(1000.0);
        data[8] = 5.0;
        data[14..16].fill(50.0);
        let mut detection = data.clone();
        // A noisy peak on the bright neighbour's wing is displaced from the
        // candidate's flux centroid. Only that peak clears the threshold.
        detection[8] = 20.0;
        detection[14..16].fill(4.0);
        let response = vec![1.0; w];
        let out = clean(
            vec![(0..5).collect(), vec![8, 14, 15]],
            &data,
            &detection,
            &response,
            w,
            5.0,
            1.0,
        );
        assert_eq!(out, vec![(0..5).collect::<Vec<u32>>()]);
    }

    #[test]
    fn brightest_object_is_never_cleaned() {
        // Alone and only just above the threshold.
        let w = 10;
        let mut data = vec![0.0f32; w];
        data[3..6].fill(5.5);
        let rms = vec![1.0f32; w];
        let out = clean(vec![(3..6).collect()], &data, &data, &rms, w, 5.0, 1.0);
        assert_eq!(out.len(), 1);
    }
}
