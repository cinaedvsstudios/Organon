# Code Writer v0.03 Debug Notes

## Purpose

This version patches the two main issues reported after v0.02:

1. Large HTML files were slow to open and could cause browser “wait / end task” warnings.
2. The Find button was still a placeholder and did not open an actual Find / Replace tool.

## Files changed

- `tools/code-writer/index.html`
- `tools/code-writer/js/state.js`
- `tools/code-writer/js/preview.js`
- `tools/code-writer/js/editor.js`
- `tools/code-writer/js/find-replace.js`
- `tools/code-writer/css/code-writer-v003.css`

## Performance changes

- Added large file detection.
- Current thresholds:
  - more than 150,000 characters, or
  - more than 1,800 lines.
- Large file mode now pauses automatic preview rendering.
- The preview can still be manually rendered with the Preview / WYSIWYG `Refresh` button.
- Detailed visual marker rendering is paused for large files.
- Local Working Save is debounced instead of writing immediately on every tiny change.
- Raw input no longer triggers the same aggressive full refresh loop on every keystroke.
- Line numbers and markers are rebuilt with lighter string rendering instead of many repeated per-line DOM operations.
- The old repeated original-content splitting inside marker checks was removed from the live marker path.

## Find / Replace changes

The Raw View `Find` button now opens a real Find / Replace panel.

Included controls:

- Find field.
- Replace field.
- Previous.
- Next.
- Replace current.
- Replace all.
- Settings button.
- Close button.

Keyboard shortcuts:

- Ctrl/Cmd + F opens Find.
- Ctrl/Cmd + H opens Find / Replace and focuses the replacement field.
- Enter moves to the next result from the Find field.
- Shift + Enter moves to the previous result from the Find field.
- Escape closes the panel.

Find settings:

- Match case.
- Whole word.
- Selection only.
- Fuzzy search.
- Fuzzy level: Light / Medium / Loose.

## Fuzzy search note

Fuzzy search is deliberately conservative in this first pass.

- Light ignores spacing.
- Medium ignores spacing and most punctuation.
- Loose focuses on alphanumeric matching.

Fuzzy Replace all asks for confirmation because fuzzy matches can catch near matches that are not safe to blindly replace.

## Things to test

| Number | Area | Things to check | Debug / feedback |
|---:|---|---|---|
| 1 | Version | Confirm the title/subtitle shows v0.03. |  |
| 2 | Large file open | Open the large file that previously froze and check whether it opens faster. |  |
| 3 | Large file mode | Confirm the preview status says large file mode / preview paused. |  |
| 4 | Manual preview | Click Refresh in the preview header and confirm the preview can still be rendered manually. |  |
| 5 | Typing lag | Type in a large file and check whether the browser stops showing wait/end task warnings. |  |
| 6 | Hide preview | Hide preview and confirm it still works immediately. |  |
| 7 | Find panel | Click Find and confirm the panel opens. |  |
| 8 | Exact search | Search a known word and use Next / Prev. |  |
| 9 | Replace current | Replace one result and confirm only that result changes. |  |
| 10 | Replace all | Replace a repeated exact word and confirm the count/result is sane. |  |
| 11 | Match case | Turn on Match case and check uppercase/lowercase behaviour. |  |
| 12 | Whole word | Confirm whole-word search does not match inside longer words. |  |
| 13 | Selection only | Highlight a range and search only inside it. |  |
| 14 | Fuzzy search | Try fuzzy light/medium/loose on spaced or punctuation-different text. |  |
| 15 | Mobile | Check that the Find panel remains usable on mobile width. |  |

## Known limitations

- Large file mode still renders full line numbers. If files are extremely huge, true virtual scrolling may be needed later.
- Fuzzy search is not typo-correction AI. It is a local safe near-match search that ignores spacing/punctuation depending on level.
- Fuzzy Replace all should be used carefully.
- Preview rendering of very large full HTML files can still take time when manually refreshed because the browser must parse the whole document in the iframe.
