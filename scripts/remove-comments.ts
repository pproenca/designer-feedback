#!/usr/bin/env npx tsx

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const DRY_RUN = process.argv.includes('--dry-run');

function removeComments(sourceCode: string, fileName: string): string {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceCode,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  const PRESERVE_PATTERNS = [
    /eslint-disable/,
    /eslint-enable/,
    /@ts-ignore/,
    /@ts-expect-error/,
    /@ts-nocheck/,
  ];

  function shouldPreserve(commentText: string): boolean {
    return PRESERVE_PATTERNS.some((pattern) => pattern.test(commentText));
  }

  const commentRanges: Array<{ pos: number; end: number }> = [];

  function collectComments(ranges: ts.CommentRange[] | undefined) {
    if (!ranges) return;
    for (const range of ranges) {
      const text = sourceCode.slice(range.pos, range.end);
      if (!shouldPreserve(text)) {
        commentRanges.push(range);
      }
    }
  }

  function visit(node: ts.Node) {
    collectComments(ts.getLeadingCommentRanges(sourceCode, node.getFullStart()));
    collectComments(ts.getTrailingCommentRanges(sourceCode, node.getEnd()));
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  collectComments(ts.getLeadingCommentRanges(sourceCode, 0));

  // Sort by position descending to remove from end first (preserves positions)
  commentRanges.sort((a, b) => b.pos - a.pos);

  // Remove duplicates
  const seen = new Set<string>();
  const uniqueRanges = commentRanges.filter((range) => {
    const key = `${range.pos}-${range.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Remove comments from source
  let result = sourceCode;
  for (const range of uniqueRanges) {
    const before = result.slice(0, range.pos);
    const after = result.slice(range.end);
    result = before + after;
  }

  // Clean up: remove multiple consecutive blank lines
  result = result.replace(/\n{3,}/g, '\n\n');

  // Remove trailing whitespace on lines
  result = result
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');

  // Ensure single newline at end
  result = result.trimEnd() + '\n';

  return result;
}

function findFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];

  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        results.push(...findFiles(fullPath, extensions));
      } else if (
        extensions.some((ext) => entry.endsWith(ext)) &&
        !entry.includes('.spec.') &&
        !entry.includes('.test.')
      ) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist, skip
  }

  return results;
}

async function main() {
  const dirs = ['entrypoints', 'components', 'stores', 'utils', 'hooks', 'types', 'shared'];
  const extensions = ['.ts', '.tsx'];

  const files = dirs.flatMap((dir) => findFiles(dir, extensions));

  console.log(`Found ${files.length} files to process${DRY_RUN ? ' (dry run)' : ''}\n`);

  let totalRemoved = 0;

  for (const file of files.sort()) {
    const content = readFileSync(file, 'utf-8');
    const cleaned = removeComments(content, file);

    if (content !== cleaned) {
      const linesBefore = content.split('\n').length;
      const linesAfter = cleaned.split('\n').length;
      const removed = linesBefore - linesAfter;
      totalRemoved += removed;

      console.log(`${relative(process.cwd(), file)}: removed ${removed} lines`);

      if (!DRY_RUN) {
        writeFileSync(file, cleaned);
      }
    }
  }

  console.log(`\nTotal: ${totalRemoved} lines removed${DRY_RUN ? ' (dry run - no files modified)' : ''}`);
}

main().catch(console.error);
