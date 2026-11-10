//! WASM exports: the contract between the crate and the page.

use wasm_bindgen::prelude::*;

use crate::page::{self, Analysis, Options};

fn check_size(
    len: usize,
    width: u32,
    height: u32,
    per_pixel: usize,
) -> Result<(usize, usize), JsError> {
    let (w, h) = (width as usize, height as usize);
    if w == 0 || h == 0 || len != w * h * per_pixel {
        return Err(JsError::new(&format!(
            "expected {w} x {h} x {per_pixel} = {} values, got {len}",
            w * h * per_pixel
        )));
    }
    Ok((w, h))
}

/// The result of [`detect`].
#[wasm_bindgen]
pub struct Detection(Analysis);

#[wasm_bindgen]
impl Detection {
    /// Array of `{ id, cls, group, fragment, cx, cy, x0, y0, x1, y1, area,
    /// flux, peak, color, major, minor, theta, spike }`.
    pub fn objects(&self) -> Result<JsValue, JsError> {
        Ok(serde_wasm_bindgen::to_value(&self.0.objects)?)
    }

    /// Object id per pixel, 0 for sky.
    pub fn labels(&self) -> Vec<i32> {
        self.0.labels.clone()
    }

    /// Sky level per pixel.
    pub fn bg(&self) -> Vec<f32> {
        self.0.back.clone()
    }

    /// Median colour (log R/B) of resolved galaxies.
    #[wasm_bindgen(getter, js_name = fieldColor)]
    pub fn field_color(&self) -> f64 {
        self.0.field_color
    }

    /// Diffraction-spike angles in degrees.
    #[wasm_bindgen(js_name = spikeAngles)]
    pub fn spike_angles(&self) -> Vec<u32> {
        self.0.spike_angles.clone()
    }
}

/// Detect and classify sources in an RGBA image. `options` takes the page's
/// option names (`kSigma`, `minCont`, `nearFrac`, ...); missing ones default.
#[wasm_bindgen]
pub fn detect(
    rgba: &[u8],
    width: u32,
    height: u32,
    options: JsValue,
) -> Result<Detection, JsError> {
    let (w, h) = check_size(rgba.len(), width, height, 4)?;
    let opt: Options = if options.is_undefined() || options.is_null() {
        Options::default()
    } else {
        serde_wasm_bindgen::from_value(options)?
    };
    Ok(Detection(page::analyse(rgba, w, h, &opt)))
}

/// Run only the core, with SEP's defaults, on a luminance image. Returns an
/// array of `{ cx, cy, area, flux, peak, x0, y0, x1, y1 }`.
#[wasm_bindgen]
pub fn detect_core(luminance: &[f32], width: u32, height: u32) -> Result<JsValue, JsError> {
    let (w, h) = check_size(luminance.len(), width, height, 1)?;
    let (_, ex) = crate::core::detect_core(luminance, w, h);
    Ok(serde_wasm_bindgen::to_value(&ex.objects)?)
}
