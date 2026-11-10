//! Natural cubic spline through a set of knots, used to interpolate the
//! background mesh.

/// A natural cubic spline: second derivative zero at both end knots. Outside
/// the knots it extends the end segments' cubics.
#[derive(Clone, Debug)]
pub struct Spline {
    xs: Vec<f64>,
    ys: Vec<f64>,
    /// Second derivative at each knot.
    m: Vec<f64>,
}

impl Spline {
    /// Build a spline through `(xs[k], ys[k])`. `xs` must be increasing and the
    /// same length as `ys`.
    pub fn natural(xs: &[f64], ys: &[f64]) -> Self {
        assert_eq!(
            xs.len(),
            ys.len(),
            "spline knots and values differ in length"
        );
        let n = xs.len();
        let mut m = vec![0.0; n];
        if n > 2 {
            // Tridiagonal system for the interior second derivatives.
            let mut c = vec![0.0; n];
            let mut d = vec![0.0; n];
            for i in 1..n - 1 {
                let h0 = xs[i] - xs[i - 1];
                let h1 = xs[i + 1] - xs[i];
                let a = h0 / 6.0;
                let b = (h0 + h1) / 3.0;
                let cc = h1 / 6.0;
                let rhs = (ys[i + 1] - ys[i]) / h1 - (ys[i] - ys[i - 1]) / h0;
                let denom = b - a * c[i - 1];
                c[i] = cc / denom;
                d[i] = (rhs - a * d[i - 1]) / denom;
            }
            for i in (1..n - 1).rev() {
                m[i] = d[i] - c[i] * m[i + 1];
            }
        }
        Self {
            xs: xs.to_vec(),
            ys: ys.to_vec(),
            m,
        }
    }

    pub fn eval(&self, x: f64) -> f64 {
        let n = self.xs.len();
        match n {
            0 => 0.0,
            1 => self.ys[0],
            _ => {
                let k = self.xs.partition_point(|&k| k <= x).clamp(1, n - 1) - 1;
                let h = self.xs[k + 1] - self.xs[k];
                let a = (self.xs[k + 1] - x) / h;
                let b = (x - self.xs[k]) / h;
                a * self.ys[k]
                    + b * self.ys[k + 1]
                    + ((a * a * a - a) * self.m[k] + (b * b * b - b) * self.m[k + 1]) * h * h / 6.0
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn passes_through_knots() {
        let xs = [0.0, 1.0, 3.0, 4.0];
        let ys = [2.0, -1.0, 5.0, 0.5];
        let s = Spline::natural(&xs, &ys);
        for (x, y) in xs.iter().zip(ys) {
            assert!((s.eval(*x) - y).abs() < 1e-12);
        }
    }

    #[test]
    fn reproduces_a_line() {
        let xs = [0.0, 2.0, 5.0, 9.0];
        let ys: Vec<f64> = xs.iter().map(|x| 3.0 * x - 1.0).collect();
        let s = Spline::natural(&xs, &ys);
        for x in [-1.0, 0.5, 4.0, 7.5, 10.0] {
            assert!((s.eval(x) - (3.0 * x - 1.0)).abs() < 1e-9);
        }
    }

    #[test]
    fn single_knot_is_constant() {
        let s = Spline::natural(&[4.0], &[1.5]);
        assert_eq!(s.eval(-10.0), 1.5);
        assert_eq!(s.eval(10.0), 1.5);
    }
}
