(function () {
    'use strict';

    const voidTags = new Set([
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
        'param', 'source', 'track', 'wbr', 'command', 'keygen', 'menuitem'
    ]);

    function lineForIndex(text, index) {
        return text.slice(0, index).split('\n').length;
    }

    function quoteLine(lines, lineNumber) {
        const line = lines[lineNumber - 1] || '';
        return line.trim().slice(0, 160);
    }

    function makeIssue(type, line, message, snippet, section) {
        return {
            id: `${type}-${line}-${Math.random().toString(36).slice(2, 8)}`,
            type,
            line: line || 1,
            message,
            snippet: snippet || '',
            section: section || ''
        };
    }

    function checkRequiredStructure(html, lines, issues) {
        if (!/<!doctype\s+html/i.test(html)) {
            issues.push(makeIssue('warning', 1, 'Missing <!DOCTYPE html>. Full HTML files normally start with this declaration.', quoteLine(lines, 1), 'document setup'));
        }
        if (!/<html[\s>]/i.test(html)) {
            issues.push(makeIssue('warning', 1, 'Missing <html> tag for a full document.', quoteLine(lines, 1), 'document setup'));
        }
        if (!/<head[\s>]/i.test(html)) {
            issues.push(makeIssue('warning', 1, 'Missing <head> tag for a full document.', quoteLine(lines, 1), 'document setup'));
        }
        if (!/<body[\s>]/i.test(html)) {
            issues.push(makeIssue('warning', 1, 'Missing <body> tag for a full document.', quoteLine(lines, 1), 'document setup'));
        }
        if (!/<title[\s>]/i.test(html)) {
            issues.push(makeIssue('warning', 1, 'Missing <title> tag.', quoteLine(lines, 1), 'document setup'));
        }
    }

    function checkDuplicateIds(html, lines, issues) {
        const seen = new Map();
        const regex = /\bid\s*=\s*(["'])(.*?)\1/gi;
        let match;
        while ((match = regex.exec(html)) !== null) {
            const id = match[2];
            const line = lineForIndex(html, match.index);
            if (seen.has(id)) {
                const firstLine = seen.get(id);
                issues.push(makeIssue('error', line, `Duplicate id="${id}". First seen on line ${firstLine}.`, quoteLine(lines, line), 'duplicate IDs'));
            } else {
                seen.set(id, line);
            }
        }
    }

    function checkBrokenQuotesAndBrackets(lines, issues) {
        lines.forEach((line, index) => {
            const lineNumber = index + 1;
            if (/<[^>]*$/.test(line) && line.includes('<')) {
                issues.push(makeIssue('warning', lineNumber, 'Line contains a possible unfinished tag or missing > bracket.', line.trim(), 'tag bracket'));
            }

            const tagMatches = line.match(/<[^>]+>/g) || [];
            tagMatches.forEach(tag => {
                const doubleQuotes = (tag.match(/"/g) || []).length;
                const singleQuotes = (tag.match(/'/g) || []).length;
                if (doubleQuotes % 2 !== 0 || singleQuotes % 2 !== 0) {
                    issues.push(makeIssue('warning', lineNumber, 'Possible incomplete quote mark inside an HTML tag attribute.', line.trim(), 'attribute quote'));
                }
            });

            const openCurly = (line.match(/\{/g) || []).length;
            const closeCurly = (line.match(/\}/g) || []).length;
            if (Math.abs(openCurly - closeCurly) > 1) {
                issues.push(makeIssue('warning', lineNumber, 'Suspicious curly-brace imbalance on this line.', line.trim(), 'CSS / JS braces'));
            }
        });
    }

    function checkTagStack(html, lines, issues) {
        const stack = [];
        const cleaned = html
            .replace(/<!--[\s\S]*?-->/g, match => ' '.repeat(match.length))
            .replace(/<!doctype[\s\S]*?>/gi, match => ' '.repeat(match.length));
        const regex = /<\s*(\/?)\s*([a-zA-Z][\w:-]*)([^>]*)>/g;
        let match;

        while ((match = regex.exec(cleaned)) !== null) {
            const isClosing = Boolean(match[1]);
            const tagName = String(match[2] || '').toLowerCase();
            const attributes = String(match[3] || '');
            const rawTag = match[0];
            const line = lineForIndex(cleaned, match.index);

            if (!tagName || voidTags.has(tagName) || rawTag.endsWith('/>')) continue;

            if (!isClosing) {
                stack.push({ tagName, line });
                continue;
            }

            if (stack.length === 0) {
                issues.push(makeIssue('error', line, `Closing </${tagName}> has no matching opening tag.`, quoteLine(lines, line), 'tag structure'));
                continue;
            }

            const last = stack[stack.length - 1];
            if (last.tagName === tagName) {
                stack.pop();
                continue;
            }

            const matchingIndex = stack.map(item => item.tagName).lastIndexOf(tagName);
            if (matchingIndex === -1) {
                issues.push(makeIssue('error', line, `Closing </${tagName}> does not match the currently open <${last.tagName}> from line ${last.line}.`, quoteLine(lines, line), 'tag mismatch'));
            } else {
                const unclosed = stack.slice(matchingIndex + 1).reverse();
                unclosed.forEach(item => {
                    issues.push(makeIssue('error', item.line, `<${item.tagName}> appears to be unclosed before </${tagName}> on line ${line}.`, quoteLine(lines, item.line), 'unclosed tag'));
                });
                stack.splice(matchingIndex);
            }
        }

        const ignoreOpen = new Set(['html', 'head', 'body']);
        stack.reverse().slice(0, 25).forEach(item => {
            if (ignoreOpen.has(item.tagName) && html.toLowerCase().includes(`</${item.tagName}>`)) return;
            issues.push(makeIssue('warning', item.line, `<${item.tagName}> may be missing a closing </${item.tagName}> tag.`, quoteLine(lines, item.line), 'unclosed tag'));
        });
    }

    function runCheck(html) {
        const lines = String(html || '').split('\n');
        const issues = [];
        checkRequiredStructure(html, lines, issues);
        checkDuplicateIds(html, lines, issues);
        checkBrokenQuotesAndBrackets(lines, issues);
        checkTagStack(html, lines, issues);
        issues.sort((a, b) => a.line - b.line || (a.type === 'error' ? -1 : 1));
        return issues;
    }

    function reportText(issues) {
        if (!issues || issues.length === 0) {
            return 'Code Writer Check Code Report\nNo obvious errors or warnings detected.';
        }
        const errors = issues.filter(issue => issue.type === 'error');
        const warnings = issues.filter(issue => issue.type === 'warning');
        const parts = [`Code Writer Check Code Report`, `Errors: ${errors.length}`, `Warnings: ${warnings.length}`, ''];
        if (errors.length) {
            parts.push('ERRORS');
            errors.forEach(issue => {
                parts.push(`Line ${issue.line}: ${issue.message}`);
                if (issue.snippet) parts.push(`  ${issue.snippet}`);
            });
            parts.push('');
        }
        if (warnings.length) {
            parts.push('WARNINGS');
            warnings.forEach(issue => {
                parts.push(`Line ${issue.line}: ${issue.message}`);
                if (issue.snippet) parts.push(`  ${issue.snippet}`);
            });
        }
        return parts.join('\n');
    }

    window.CodeWriterCheck = {
        runCheck,
        reportText
    };
})();
