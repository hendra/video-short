/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// "angle" uses your GPU. On a server/CI without a GPU, render with `--gl=swangle` (software WebGL).
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
