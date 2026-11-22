/**
 * MotoriClip #44: exact original gl-transitions/gl-transitions source manifest.
 * Source revision and Git blob SHA verified directly against upstream on 22 Nov 2026.
 * Defaults are the original per-module editor defaults; each is checked against
 * the actual exported *_DEFAULTS and normalise*Options() in continuous CI.
 * Do not silently rename transitions or invent third-party shader authorship.
 */
export const ORIGINAL_GLSL_PROVENANCE = Object.freeze([
  {
    "selectedOrder": 1,
    "module": "SpiralBlockWipe",
    "sourceFile": "transitions/SpiralBlockWipe.glsl",
    "sourceCommit": "deeebdee7581cdfe924ed9cf104ea2fd10e63155",
    "blob": "e98d9e749d398d84ec927da9286af13843da722e",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "columns": 8,
      "rows": 6,
      "inward": true,
      "clockwise": true,
      "smoothness": 0.05
    }
  },
  {
    "selectedOrder": 2,
    "module": "Hologram",
    "sourceFile": "transitions/Hologram.glsl",
    "sourceCommit": "deeebdee7581cdfe924ed9cf104ea2fd10e63155",
    "blob": "284e495b81dabf03070eb1c24ad41583a7ed5ee4",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "tint": "#33bfff",
      "background": "#00050d",
      "backgroundAlpha": 1,
      "scanlines": 150,
      "jitter": 0.04,
      "flicker": 0.6
    }
  },
  {
    "selectedOrder": 3,
    "module": "CellDissolve",
    "sourceFile": "transitions/CellDissolve.glsl",
    "sourceCommit": "deeebdee7581cdfe924ed9cf104ea2fd10e63155",
    "blob": "f0f086ae5f62985c3003a340f8e547345e34572f",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "cells": 8,
      "smoothness": 0.1,
      "border": 0.006,
      "borderColor": "#fff2cc",
      "borderAlpha": 1,
      "seed": 0
    }
  },
  {
    "selectedOrder": 4,
    "module": "Vortex",
    "sourceFile": "transitions/Vortex.glsl",
    "sourceCommit": "deeebdee7581cdfe924ed9cf104ea2fd10e63155",
    "blob": "dd0b3f76a8ec3e941e9db79d4f6282a75c3282bd",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "grid": 24,
      "centerX": 0.5,
      "centerY": 0.5,
      "spin": 1,
      "randomness": 0.2
    }
  },
  {
    "selectedOrder": 5,
    "module": "Crumple",
    "sourceFile": "transitions/Crumple.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "6883cc11cb42c79e49570623d381b51b3da38317",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "creases": 16,
      "size": 0.2,
      "directionX": 1,
      "directionY": 0.4,
      "paperColor": "#f5f2e8",
      "paperAlpha": 1,
      "shadowColor": "#000000",
      "shadowAlpha": 0.45
    }
  },
  {
    "selectedOrder": 6,
    "module": "LiquidFill",
    "sourceFile": "transitions/LiquidFill.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "19dcbc41dae67269936a85a3920243242daf7030",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "directionX": 0,
      "directionY": 1,
      "amplitude": 0.06,
      "waves": 1.5,
      "highlightColor": "#ffffff",
      "highlightAlpha": 0.8,
      "refraction": 0.03,
      "bubbles": 0.5
    }
  },
  {
    "selectedOrder": 7,
    "module": "HeatHaze",
    "sourceFile": "transitions/HeatHaze.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "ad8aceb661996e2d4bf0eff2145611b5992546bf",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "strength": 0.04,
      "scale": 6,
      "speed": 2
    }
  },
  {
    "selectedOrder": 8,
    "module": "Sphere",
    "sourceFile": "transitions/Sphere.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "99e56512c557ef66ae5f9a9fbf30e5344bd40fbb",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "directionX": 1,
      "directionY": 0,
      "size": 0.3,
      "shading": 0.6,
      "shadow": 0.5
    }
  },
  {
    "selectedOrder": 9,
    "module": "RingsWipe",
    "sourceFile": "transitions/RingsWipe.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "7dd2bf87b2c932a9ae6a2fdc47ce25c02c303f55",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "count": 6,
      "centerX": 0.5,
      "centerY": 0.5,
      "stagger": 0.5,
      "radial": false,
      "borderWidth": 0.008,
      "borderColor": "#ffffff",
      "borderAlpha": 1,
      "smoothness": 0.004
    }
  },
  {
    "selectedOrder": 10,
    "module": "Snapshot",
    "sourceFile": "transitions/Snapshot.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "56827ba42ff3317274e7b76a125ee47c50bc2f35",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "tilt": 0.35,
      "border": 0.04,
      "flash": 0.85,
      "shadow": 0.45,
      "borderColor": "#f5f0e3",
      "borderAlpha": 1
    }
  },
  {
    "selectedOrder": 11,
    "module": "ColorPanelWipe",
    "sourceFile": "transitions/ColorPanelWipe.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "ce1d502ca70684e13baa3b910ce93506ee133347",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "directionX": 1,
      "directionY": 0,
      "panels": 3,
      "stagger": 0.35,
      "skew": 0.25,
      "color1": "#fac238",
      "alpha1": 1,
      "color2": "#ed545c",
      "alpha2": 1,
      "color3": "#29336b",
      "alpha3": 1
    }
  },
  {
    "selectedOrder": 12,
    "module": "Gallery",
    "sourceFile": "transitions/Gallery.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "dcdca306666c1cddc6f391b135a367be931db4ac",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "direction": 1,
      "tilt": 0.6,
      "gap": 0.15,
      "zoom": 2,
      "reflection": 0.3,
      "backgroundColor": "#121214",
      "backgroundAlpha": 1
    }
  },
  {
    "selectedOrder": 13,
    "module": "VhsTracking",
    "sourceFile": "transitions/VhsTracking.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "5093133dec4654f72ec692a8fd7905c957ad20dd",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "bands": 3,
      "noise": 0.6,
      "bleed": 0.5,
      "wobble": 0.5
    }
  },
  {
    "selectedOrder": 14,
    "module": "CardSwipe",
    "sourceFile": "transitions/CardSwipe.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "aa6edf3ecd6e0d629f2bf39655b1d984f3305c2c",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "directionX": 1,
      "directionY": 0.25,
      "rotation": 0.5,
      "depth": 0.15,
      "backColor": "#0f0f12",
      "backAlpha": 1
    }
  },
  {
    "selectedOrder": 15,
    "module": "CameraShake",
    "sourceFile": "transitions/CameraShake.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "b6fd15dc9c8af8ccd360200870a2575fc160887d",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "strength": 0.5,
      "jolts": 12,
      "blur": 0.5,
      "split": 0.5
    }
  },
  {
    "selectedOrder": 16,
    "module": "SmokeDissolve",
    "sourceFile": "transitions/SmokeDissolve.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "70e4c6f68d4404dac370d619a5ff4d6998b39c25",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "directionX": 0.5,
      "directionY": 0.1,
      "scale": 2.5,
      "spread": 0.4,
      "softness": 0.5,
      "color": "#dbdbe0",
      "colorAlpha": 1
    }
  },
  {
    "selectedOrder": 17,
    "module": "SplatterWipe",
    "sourceFile": "transitions/SplatterWipe.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "d7b7b27a72a19962814812b2b58b5f33e75fd30c",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "splats": 4,
      "spikiness": 0.6,
      "droplets": 0.6,
      "drips": 0.5,
      "rim": 0.5,
      "seed": 3
    }
  },
  {
    "selectedOrder": 18,
    "module": "BloomDissolve",
    "sourceFile": "transitions/BloomDissolve.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "7964bebdd9bcdb6a1a1106bea2f6f7d41bb3f92c",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "spread": 0.25,
      "threshold": 0.6,
      "intensity": 1.5,
      "tint": "#ffe6bf"
    }
  },
  {
    "selectedOrder": 19,
    "module": "BokehDissolve",
    "sourceFile": "transitions/BokehDissolve.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "0c1956382c6939b91ed61c223f21efa9f95a7c57",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "radius": 0.05,
      "blades": 0,
      "threshold": 0.7,
      "intensity": 1
    }
  },
  {
    "selectedOrder": 20,
    "module": "LightRays",
    "sourceFile": "transitions/LightRays.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "1df4de6da52cf8305563bee10d7df32f7124c852",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "centerX": 0.5,
      "centerY": 0.6,
      "drift": 0.15,
      "reach": 0.6,
      "threshold": 0.65,
      "intensity": 1.5,
      "tint": "#ffd18c"
    }
  },
  {
    "selectedOrder": 21,
    "module": "BlockCover",
    "sourceFile": "transitions/BlockCover.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "610d197c1846ffd7721757b7e0d12cc764e5b867",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "blocks": 16,
      "color": "#f25242",
      "colorAlpha": 1,
      "pop": 0.5,
      "smoothness": 0.03
    }
  },
  {
    "selectedOrder": 22,
    "module": "Disintegrate",
    "sourceFile": "transitions/Disintegrate.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "a669fffd951dd576a619be088d66dde9eae94e65",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "particleSize": 0.008,
      "directionX": 1,
      "directionY": -0.15,
      "spread": 0.75
    }
  },
  {
    "selectedOrder": 23,
    "module": "Ascii",
    "sourceFile": "transitions/Ascii.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "9364500f073cae85702f0963165132eb67dfb328",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "cellSize": 0.04,
      "colored": true,
      "ink": "#4dff73",
      "inkAlpha": 1,
      "background": "#000000",
      "backgroundAlpha": 1
    }
  },
  {
    "selectedOrder": 24,
    "module": "FilmStrip",
    "sourceFile": "transitions/FilmStrip.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "9e99bdb013184758a51bbfdb0d7acaf0dd87a046",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "frames": 2,
      "shrink": 0.2,
      "blur": 0.5,
      "weave": 0.5,
      "filmColor": "#0f0d0d",
      "filmAlpha": 1,
      "holeColor": "#f5edda",
      "holeAlpha": 1
    }
  },
  {
    "selectedOrder": 25,
    "module": "InkBleed",
    "sourceFile": "transitions/InkBleed.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "380831ada1f601cca55db3f5e8b23801fbae088e",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "drops": 4,
      "tendrils": 0.7,
      "rim": 0.5,
      "seed": 3
    }
  },
  {
    "selectedOrder": 26,
    "module": "Refraction",
    "sourceFile": "transitions/Refraction.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "506391a9f5568868bd405a707e6c591c1f2b48bd",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "strength": 0.15,
      "scale": 2.5,
      "dispersion": 0.5,
      "brightness": 1
    }
  },
  {
    "selectedOrder": 27,
    "module": "WhipSpin",
    "sourceFile": "transitions/WhipSpin.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "ca5e1cf7c21090fd2b034c661d298d5f028bd8b1",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "turns": 1,
      "blur": 0.5,
      "chroma": 0.6,
      "zoom": 0.25
    }
  },
  {
    "selectedOrder": 28,
    "module": "PaperTear",
    "sourceFile": "transitions/PaperTear.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "6794a18eed1e282982af9bbb86e7f869a38f2b7b",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "roughness": 0.12,
      "tilt": 0.1,
      "rim": 0.012,
      "paperColor": "#fffaf0",
      "paperAlpha": 1,
      "shadowColor": "#000000",
      "shadowAlpha": 0.35
    }
  },
  {
    "selectedOrder": 29,
    "module": "ApertureWipe",
    "sourceFile": "transitions/ApertureWipe.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "298292038e4b03c8be4344e5f84109e3bbfeb04f",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "blades": 6,
      "rotation": 60,
      "shadow": 0.5
    }
  },
  {
    "selectedOrder": 30,
    "module": "SpiralWipe",
    "sourceFile": "transitions/SpiralWipe.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "2d71f5c76ef90865a04f1e3d2c94251c1bce2733",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "turns": 3,
      "smoothness": 0.05,
      "clockwise": true
    }
  },
  {
    "selectedOrder": 31,
    "module": "Prisms",
    "sourceFile": "transitions/Prisms.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "ccb2ac8c854b172566170adb74bbb12bd0eafe64",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "slats": 8,
      "stagger": 0.45,
      "perspective": 1,
      "shading": 0.6,
      "horizontal": false,
      "backColor": "#000000",
      "backAlpha": 1
    }
  },
  {
    "selectedOrder": 32,
    "module": "TvTurnOff",
    "sourceFile": "transitions/TvTurnOff.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "4a4aeed6f039ac528aa48e9dd818c1592e2d8b07",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "color": "#000000",
      "colorAlpha": 1,
      "glow": 1
    }
  },
  {
    "selectedOrder": 33,
    "module": "ColorCoords",
    "sourceFile": "transitions/ColorCoords.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "b9e841fa1b8abd353104e0d6e6ef7a1d84e3b71f",
    "author": "haiyoucuv",
    "license": "MIT",
    "defaults": {}
  },
  {
    "selectedOrder": 34,
    "module": "CrossWarp",
    "sourceFile": "transitions/CrossWarp.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "d87bf09333e5a4e1484c886210e302198cda528a",
    "author": "Eke Péter <peterekepeter@gmail.com>",
    "license": "MIT",
    "defaults": {}
  },
  {
    "selectedOrder": 35,
    "module": "Crosshatch",
    "sourceFile": "transitions/Crosshatch.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "debf06bd2d8f0d80ab164058a68687c4a9976570",
    "author": "pthrasher",
    "license": "MIT",
    "defaults": {
      "centerX": 0.5,
      "centerY": 0.5,
      "threshold": 3,
      "fadeEdge": 0.1
    }
  },
  {
    "selectedOrder": 36,
    "module": "Cube",
    "sourceFile": "transitions/Cube.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "5e456ee806ed761d5a9d670af88daee6d91872d5",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "persp": 0.7,
      "unzoom": 0.3,
      "reflection": 0.4,
      "floating": 3,
      "shading": 0.5
    }
  },
  {
    "selectedOrder": 37,
    "module": "Fade",
    "sourceFile": "transitions/Fade.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "7855085e5cf9b1b1ba7e8607e30a600f633c3fea",
    "author": "gre",
    "license": "MIT",
    "defaults": {}
  },
  {
    "selectedOrder": 38,
    "module": "GlitchFlicker",
    "sourceFile": "transitions/GlitchFlicker.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "c0f0e1b5c4ad907c0440a9e28281a6f900353a1e",
    "author": "bread",
    "license": "MIT",
    "defaults": {
      "frameRate": 24,
      "rgbOffset": 0.014,
      "blockAmount": 0.72,
      "ghostAmount": 0.62,
      "redCyan": 0.58,
      "scanline": 0.075
    }
  },
  {
    "selectedOrder": 39,
    "module": "Pixelize",
    "sourceFile": "transitions/Pixelize.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "bda886454bbee787599dad903af0e53d40d1dc26",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "squaresX": 20,
      "squaresY": 20,
      "steps": 50
    }
  },
  {
    "selectedOrder": 40,
    "module": "RandomSquares",
    "sourceFile": "transitions/RandomSquares.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "ac73fb29d26016792756a3a8d1f5daf03af90856",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "sizeX": 10,
      "sizeY": 10,
      "smoothness": 0.5
    }
  },
  {
    "selectedOrder": 41,
    "module": "Ripple",
    "sourceFile": "transitions/Ripple.glsl",
    "sourceCommit": "7f48be1e2c09a54f74cfdd927bb0f512a652c051",
    "blob": "b218a90209ea7a3d5f5fb4ce403cabace3cadab3",
    "author": "gre",
    "license": "MIT",
    "defaults": {
      "amplitude": 100,
      "speed": 50
    }
  }
].map(item=>Object.freeze({...item,defaults:Object.freeze(item.defaults)})));
