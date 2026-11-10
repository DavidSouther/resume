// Deep Field Volume client entry: wires the stage, rail and loaders.
import { initCamera } from "./camera.ts";
import { analyse, initLoader, loadImage } from "./loader.ts";
import { initPanel } from "./panel.ts";
import { initColors, SAMPLE_NAME, SAMPLE_SRC } from "./state.ts";

initColors();
initPanel(analyse);
initLoader();
initCamera();
void loadImage(SAMPLE_SRC, SAMPLE_NAME, true);
