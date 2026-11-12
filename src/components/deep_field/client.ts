// Deep Field Volume client entry: wires the stage, rail and loaders.
import { initCamera } from "./camera.ts";
import { analyse, initLoader, loadDefault } from "./loader.ts";
import { initPanel } from "./panel.ts";
import { initColors } from "./state.ts";

initColors();
initPanel(analyse);
initLoader();
initCamera();
void loadDefault();
