"""SEP oracle for the Deep Field detector core.

Reads a PNG, forms the luminance the page analyses (mean of R, G, B as
float32, downscaled so the longest side is at most 1600 px), runs SEP's
background and extraction with its defaults, and prints JSON:

    {width, height, luminance_b64, objects: [{cx, cy, area, flux, peak,
     x0, y0, x1, y1}]}

`luminance_b64` is the little-endian float32 luminance, row-major, so the
Rust core can run on exactly the same array. SEP is used only as a black box.

Run with:
    uv run --with sep --with numpy --with pillow python sep_oracle.py IMAGE.png
"""

import base64
import json
import sys

import numpy as np
import sep
from PIL import Image

MAX_SIDE = 1600


def luminance(path: str) -> np.ndarray:
    image = Image.open(path).convert("RGB")
    scale = min(1.0, MAX_SIDE / max(image.size))
    if scale < 1.0:
        size = (round(image.width * scale), round(image.height * scale))
        image = image.resize(size, Image.Resampling.BILINEAR)
    rgb = np.asarray(image, dtype=np.float32)
    return np.ascontiguousarray(rgb.mean(axis=2, dtype=np.float32))


def main() -> None:
    if len(sys.argv) == 3 and sys.argv[1] == "--faint-source":
        # Independent of the bundled photograph: one faint Gaussian source
        # on deterministic uniform noise. Its filtered SNR clears 5 even when
        # its individual pixels do not.
        peak = float(sys.argv[2])
        state = 7
        values = []
        for i in range(128 * 128):
            state = (state * 6364136223846793005 + 1442695040888963407) % (2**64)
            noise = ((state >> 40) / 2**24) * 2 - 1
            r2 = (i % 128 - 64) ** 2 + (i // 128 - 64) ** 2
            values.append(20 + noise + peak * np.exp(-r2 / 16))
        data = np.array(values, dtype=np.float32).reshape(128, 128)
    elif len(sys.argv) == 2:
        data = luminance(sys.argv[1])
    else:
        sys.exit("usage: sep_oracle.py IMAGE.png | --faint-source AMPLITUDE")
    height, width = data.shape
    bkg = sep.Background(data, bw=64, bh=64, fw=3, fh=3)
    found = sep.extract(data - bkg.back(), 5.0, err=bkg.rms(), minarea=5)
    objects = [
        {
            "cx": float(o["x"]),
            "cy": float(o["y"]),
            "area": int(o["npix"]),
            "flux": float(o["flux"]),
            "peak": float(o["peak"]),
            "x0": int(o["xmin"]),
            "y0": int(o["ymin"]),
            "x1": int(o["xmax"]),
            "y1": int(o["ymax"]),
        }
        for o in found
    ]
    lum = base64.b64encode(data.astype("<f4").tobytes()).decode("ascii")
    json.dump(
        {
            "width": width,
            "height": height,
            "luminance_b64": lum,
            "objects": objects,
        },
        sys.stdout,
    )


if __name__ == "__main__":
    main()
