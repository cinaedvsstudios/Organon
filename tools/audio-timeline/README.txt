ORGANON — ADVANCED AUDIO TIMELINE v0.07

Rollback baseline:
- v0.06 remains unchanged in its original folder/ZIP.

Files changed in this pass:
- advanced.html
- js/advanced-main.js
- README.txt

What changed:
- Project Files is now the clear left-side media bin.
- Project-wide controls are at the top of that panel: Import, Browse, and Clear.
- Dropping supported media anywhere in the Advanced Mode window now adds it to Project Files.
- The global drop overlay makes it clear that dropped files go to Project Files instead of directly replacing a timeline layer.
- The right column is now a contextual Inspector rather than four always-visible control cards.
- No selected timeline row: it shows a simple selection instruction.
- Video selected: visual blend/visibility controls plus a link to the matching Video Audio row.
- Video Audio or External Audio selected: only that selected track’s mute/audition and volume controls.
- Sticker selected: visual blend/visibility and sticker cutout controls.
- Advanced Mode now loads the advanced controller as an ES module and includes the canvas, media-bin, dynamic timeline, Inspector and context-menu elements expected by the independent advanced JS modules.
- Basic Mode index.html and its original JS modules remain untouched.

Known boundary:
- Timeline clip dragging/nudging and encoded video export are not included in this pass. Playback, per-track audition, visual layering, cutouts, PNG snapshot, layer creation and media-bin selection are wired for local testing.


V0.08 CHANGE NOTE
Rollback baseline: v0.07.
Files changed: advanced.html; js/advanced-main.js; README.txt.
Changes: robust capture-phase document drag/drop handlers; a direct Project Files drop pad that also opens the existing file chooser by click/Enter/Space; clear drop overlay state cleanup; unsupported/empty drop feedback. Basic Mode and the original Basic Mode JavaScript files remain untouched.
