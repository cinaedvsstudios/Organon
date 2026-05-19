# Updates / Debug Code Writer — v0.01

This zip contains the first runnable Phase 1 base for the Organon Code Writer.

Primary path:

`tools/code-writer/index.html`

Included sample file:

`tools/code-writer/samples/sample-page.html`

Default building blocks:

`tools/code-writer/data/building-blocks.json`

The tool expects shared images to live in the site root `images/` folder. From this tool folder, the path is `../../images/`.

The repository reference button points to:

`../../repository/index.html`

## Quick debug list

| Number | Area | Things to check | Debug / feedback |
|---:|---|---|---|
| 1 | Folder placement | Confirm `tools/code-writer/index.html` opens from the Organon hub. |  |
| 2 | Asset paths | Confirm sandstone texture and image paths resolve from `../../images/`. |  |
| 3 | Sample HTML | Press Load Sample and confirm it opens in a new tab. |  |
| 4 | Raw View | Check typing, scrolling, line numbers, and plain-text paste. |  |
| 5 | Preview | Check live rendering and preview hide/show. |  |
| 6 | Splitter | Drag the divider on desktop and check resizing. |  |
| 7 | Mobile toggle | On mobile/narrow width, toggle Raw / Preview. |  |
| 8 | Tabs | Create, close, switch, and nickname tabs. |  |
| 9 | Local save | Refresh and confirm local unsaved work comes back. |  |
| 10 | Export/copy | Export and copy current HTML. |  |
| 11 | Building blocks | Insert a block at the raw cursor. |  |
| 12 | Bookmarks | Add a bookmark and use bookmark navigation mode. |  |
| 13 | Visual markers | Check title/table/hr/img/style/script/comment markers. |  |
| 14 | Check Code | Run on sample file and confirm duplicate ID report appears. |  |
| 15 | Overall layout | Note what feels too cramped, missing, or wrong. |  |

## What is still left for Phase 1

- Stronger Extended Raw View.
- Search / find / replace.
- Right-click context menu.
- Advanced building-block import/merge/duplicate review.
- Bookmark repair.
- Replace Tool window.
- Project grouping and project right-click actions.
- Save All confirmation popup.
- Better WYSIWYG editing safety.
