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
Config.setJpegQuality(95);
// Tag the H.264 stream as BT.709 so YouTube/TikTok decode the colours exactly as rendered (untagged video
// is guessed per player and tends to look washed out).
Config.setColorSpace("bt709");
// Visually lossless master: the platforms re-encode whatever we upload, so give them a clean source.
Config.setCrf(16);
