#!/usr/bin/env node
// comment_rules.md「useEffectの直前に1行程度の説明コメントを書く」を機械的にチェックするスクリプト。
// useEffect(...)呼び出しの直前行（空行はスキップして遡る）が`//`コメントでなければエラーにする。
//
// 使い方:
//   node scripts/check-useeffect-comments.mjs <file1> <file2> ...   # 指定ファイルのみチェック（lint-staged向け）
//   node scripts/check-useeffect-comments.mjs                       # frontend/src 配下を全件チェック

import { globSync, readFileSync } from 'node:fs';
import ts from 'typescript';

const DEFAULT_GLOB_PATTERNS = ['frontend/src/**/*.{ts,tsx}'];
const TEST_FILE_PATTERN = /(__tests__\/|\.tests\.tsx?$|\.spec\.tsx?$)/;

/**
 * useEffect呼び出しの直前行（空行はスキップ）が`//`コメントかどうか確認する
 * @param {ts.CallExpression} node useEffect呼び出しのノード
 * @param {ts.SourceFile} sourceFile ノードが属するSourceFile
 * @param {string[]} lines ファイル全体を行ごとに分割した配列
 * @returns {boolean} 直前に説明コメントが見つかったかどうか
 */
const hasPrecedingComment = (node, sourceFile, lines) => {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  for (let i = line - 1; i >= 0; i--) {
    const trimmed = (lines[i] ?? '').trim();
    if (trimmed === '') {
      continue;
    }
    return trimmed.startsWith('//');
  }
  return false;
};

/**
 * 1ファイル分のuseEffect呼び出しをチェックし、違反一覧を返す
 * @param {string} filePath チェック対象のファイルパス
 * @returns {string[]} 違反内容を表すメッセージの配列
 */
const checkFile = (filePath) => {
  const sourceText = readFileSync(filePath, 'utf-8');
  const scriptKind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, scriptKind);
  const lines = sourceText.split('\n');
  const violations = [];

  /** @param {ts.Node} node */
  const visit = (node) => {
    const isUseEffectCall =
      ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'useEffect';
    if (isUseEffectCall && !hasPrecedingComment(node, sourceFile, lines)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      violations.push(`${filePath}:${line + 1}: useEffectの直前に説明コメントがありません(comment_rules.md参照)。`);
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return violations;
};

const targetFiles = (
  process.argv.length > 2
    ? process.argv.slice(2).filter((filePath) => /\.tsx?$/.test(filePath))
    : DEFAULT_GLOB_PATTERNS.flatMap((pattern) => globSync(pattern))
).filter((filePath) => !TEST_FILE_PATTERN.test(filePath));

const allViolations = targetFiles.flatMap((filePath) => checkFile(filePath));

if (allViolations.length > 0) {
  for (const violation of allViolations) {
    console.error(violation);
  }
  console.error(
    `\nuseEffectの説明コメント不足が${allViolations.length}件見つかりました。comment_rules.mdの「useEffectの直前に1行程度の説明コメントを書く」を確認してください。`
  );
  process.exit(1);
}
