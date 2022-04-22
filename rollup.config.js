import { nodeResolve } from "@rollup/plugin-node-resolve";

export default {
  input: "build/app.js",
  output: {
    dir: "dist",
    format: "es",
  },
  plugins: [nodeResolve()],
};
