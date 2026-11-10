//! 8-connected component labelling over pixel subsets.

/// Reusable scratch for labelling connected pixels. Stamps let repeated
/// labelling passes share one full-size buffer without clearing it.
#[derive(Debug)]
pub struct Labeler {
    width: usize,
    height: usize,
    stamp: Vec<u32>,
    generation: u32,
}

impl Labeler {
    pub fn new(width: usize, height: usize) -> Self {
        Self {
            width,
            height,
            stamp: vec![0; width * height],
            generation: 0,
        }
    }

    fn next_generation(&mut self) -> u32 {
        // Two stamps per pass: `g` marks candidates, `g + 1` marks visited.
        if self.generation >= u32::MAX - 2 {
            self.stamp.fill(0);
            self.generation = 0;
        }
        self.generation += 2;
        self.generation
    }

    /// Split the pixels of `pixels` for which `keep` holds into 8-connected
    /// components. Components come out in the order of their first pixel in
    /// `pixels`, and each lists its pixels in breadth-first order.
    pub fn components(
        &mut self,
        pixels: &[u32],
        mut keep: impl FnMut(u32) -> bool,
    ) -> Vec<Vec<u32>> {
        let g = self.next_generation();
        let visited = g + 1;
        for &p in pixels {
            if keep(p) {
                self.stamp[p as usize] = g;
            }
        }
        let (w, h) = (self.width as isize, self.height as isize);
        let mut out = Vec::new();
        for &start in pixels {
            if self.stamp[start as usize] != g {
                continue;
            }
            self.stamp[start as usize] = visited;
            let mut comp = vec![start];
            let mut head = 0;
            while head < comp.len() {
                let p = comp[head] as isize;
                head += 1;
                let (x, y) = (p % w, p / w);
                for dy in -1..=1 {
                    let yy = y + dy;
                    if yy < 0 || yy >= h {
                        continue;
                    }
                    for dx in -1..=1 {
                        let xx = x + dx;
                        if xx < 0 || xx >= w {
                            continue;
                        }
                        let q = (yy * w + xx) as usize;
                        if self.stamp[q] == g {
                            self.stamp[q] = visited;
                            comp.push(q as u32);
                        }
                    }
                }
            }
            out.push(comp);
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mask(rows: &[&str]) -> (usize, usize, Vec<u32>) {
        let w = rows[0].len();
        let pixels = rows
            .iter()
            .enumerate()
            .flat_map(|(y, r)| {
                r.bytes()
                    .enumerate()
                    .filter(|&(_, c)| c == b'#')
                    .map(move |(x, _)| (y * w + x) as u32)
            })
            .collect();
        (w, rows.len(), pixels)
    }

    #[test]
    fn diagonal_neighbours_join() {
        let (w, h, px) = mask(&["#..", ".#.", "..#"]);
        let comps = Labeler::new(w, h).components(&px, |_| true);
        assert_eq!(comps.len(), 1);
        assert_eq!(comps[0].len(), 3);
    }

    #[test]
    fn separate_blobs_stay_apart() {
        let (w, h, px) = mask(&["##..#", "##..#", ".....", "#...."]);
        let mut comps = Labeler::new(w, h).components(&px, |_| true);
        comps.sort_by_key(|c| c.len());
        let sizes: Vec<usize> = comps.iter().map(Vec::len).collect();
        assert_eq!(sizes, vec![1, 2, 4]);
    }

    #[test]
    fn keep_filters_pixels_and_labeler_is_reusable() {
        let (w, h, px) = mask(&["###"]);
        let mut lab = Labeler::new(w, h);
        assert_eq!(lab.components(&px, |p| p != 1).len(), 2);
        assert_eq!(lab.components(&px, |_| true).len(), 1);
    }
}
