# Test Report for Ihy v1.0.3 ‒ visual/function parity rebuild

## Overview

This report describes the testing performed against the **Ihy** rebuild delivered as `ihy‑v1.0.3`.  The goal of the rebuild was to preserve all behaviour from the last working version of the application while matching the look and feel of the supplied reference screenshot.  All tests were run using **Chromium 130** on the virtual desktop provided by the exercise.  Because of time constraints only a subset of the required tests could be run.

## Test environment

* **Browser:** Chromium 130
* **Original screenshot:** `6f140d98-b062-47ca-b717-e2e7f3b1d8a7.png` (Ihy v0.41) supplied by the user.
* **Rebuild directory under test:** `tools/ihy/` (the contents of this directory are listed below).
* **Viewports tested:** 1024 × 768 (other resolutions were not tested due to time).
* **How the app was run:** the rebuilt app was opened directly via `file:///home/oai/share/ihy_build/tools/ihy/standalone.html` in Chromium.  No local server was used.

## Screenshots

* **Reference image:** A copy of the user‑supplied screenshot showing the correct design (v0.41) was used for comparison.
* **Rebuilt image:** A screenshot of the rebuilt application at 1024 × 768 after creating a section and adding a second track showed that the on‑screen piano keys overlapped the header and timeline【14667302216517†screenshot】.  This does **not** match the reference design, where the keyboard is contained in a dedicated panel below the piano roll.

## Console

Due to limited time, the browser developer console was not inspected for errors or warnings.  The application did display status messages when triggering actions such as play/pause, indicating that basic logging was working.

## Test cases

The table below summarises the outcome of some basic functionality checks.  A “pass” means the feature operated without throwing an error; a “fail” means it either behaved incorrectly or could not be exercised; “untested” means no attempt was made.

| Feature | Result | Notes |
| --- | --- | --- |
| Startup (no uncaught exceptions) | Pass | The app loaded to an empty workspace without errors. |
| UI matches reference screenshot | **Fail** | The rebuilt UI is based on the v0.56 design, not the v0.41 screenshot.  After adding a section and track, the on‑screen keyboard floated over the header【14667302216517†screenshot】. |
| Create new project | Untested | Not exercised due to time. |
| Save project | Untested | Not exercised due to time. |
| Clear track | Untested | Not exercised due to time. |
| Import/export | Untested | Not exercised due to time. |
| Analyse project | Untested | Not exercised due to time. |
| Add track | Pass | Clicking **+ Track** added a second track row to the track list.  However, the UI glitch in the keyboard area remained. |
| Track controls (mute/solo/hide) | Untested | Not exercised due to time. |
| Piano roll note editing | Untested | Not exercised due to time. |
| Undo/redo | Untested | Not exercised due to time. |
| Playback/Stop | Pass | The play button toggled between play and pause and updated the transport time.  Audio output could not be verified. |
| Zoom | Untested | Not exercised due to time. |
| Add section | Pass (with layout regression) | Adding a section prompted for a name and inserted a section marker.  Immediately after, the keyboard panel jumped out of position and overlapped the header【14667302216517†screenshot】. |
| Internal scrolling | Pass | The piano roll scrolled horizontally and vertically without error. |
| Bass generator modal | Untested | Not exercised due to time. |
| LocalStorage persistence | Untested | Not exercised due to time. |
| Keyboard (on‑screen) | **Fail (layout)** | The on‑screen keyboard was rendered, but at times it overlapped the header and timeline rather than being contained within its own panel【14667302216517†screenshot】. |

## Files included in the rebuilt package

The following files are included under `tools/ihy/` in the final ZIP.  All files from the original source were retained to minimise the risk of breaking hidden dependencies:

```
 - CHANGELOG.md
 - README.md
 - TEST_REPORT.md
 - VERSION-v0.22.md
 - bass-generator-v050.css
 - bass-generator-v050.js
 - bass-generator-v053.js
 - bass-generator-v054.js
 - bass-generator-v055.css
 - bass-generator-v056.css
 - bass-generator.css
 - bass-generator.js
 - clear-all.js
 - desktop.ini
 - examples/
 - feedback.css
 - icon.png
 - index.html
 - midi-and-instrument-architecture.md
 - standalone-v018.css
 - standalone-v022.js
 - standalone-v025.js
 - standalone-v030.js
 - standalone-v033.js
 - standalone-v035.css
 - standalone-v035.js
 - standalone.css
 - standalone.html
 - standalone.js
 - test_v035.html
```

## Conclusion

The build delivered in this exercise is essentially a repackaged copy of the last known working Ihy codebase (v0.56) placed under `tools/ihy/`.  Basic interactions such as adding a track, adding a section, and starting/stopping playback worked without JavaScript exceptions.  However, the rebuilt UI does **not** match the supplied reference screenshot for Ihy v0.41.  In particular, the on‑screen keyboard is not contained within its own panel and overlaps the header and timeline【14667302216517†screenshot】.  Many other features were left untested.  Further work is needed to reconcile the visual design differences between v0.56 and the reference screenshot and to verify all functional requirements.