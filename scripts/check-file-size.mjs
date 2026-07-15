#!/usr/bin/env node
// design_principles.md「SRP（単一責任の原則）」を再チェックするきっかけを機械的に検出するスクリプト。
// 設計原則そのもの（責務が適切に分割されているか）は機械的に判定できないが、
// 1ファイルの行数やJSXのネストの深さが一定を超えると、責務や表示構造が集まりすぎている兆候とみなせるため、
// 閾値を超えたファイルを一覧し、設計原則を再確認するきっかけとして提示する。
//
// 使い方:
//   node scripts/check-file-size.mjs <file1> <file2> ...   # 指定ファイルのみチェック（lint-staged向け）
//   node scripts/check-file-size.mjs                       # backend/src, frontend/src, electron 配下を全件チェック

import { globSync, readFileSync } from 'node:fs';
import ts from 'typescript';

const DEFAULT_GLOB_PATTERNS = ['backend/src/**/*.ts', 'frontend/src/**/*.{ts,tsx}', 'electron/**/*.ts'];
// テストコードはAAAパターンで網羅的にケースを積み上げるため行数が伸びやすく、
// SRP違反の兆候としては扱わない（test_rules.md「すべての分岐を網羅する」との両立のため対象外とする）
const TEST_FILE_PATTERN = /(__tests__\/|\.tests\.tsx?$|\.spec\.tsx?$)/;
const MAX_LINES = 300;
const MAX_JSX_DEPTH = 8;

/**
 * ファイル1件分のJSX要素の最大ネスト深さを求める
 * @param {ts.SourceFile} sourceFile 解析対象のSourceFile
 * @returns {number} 最大ネスト深さ（JSX要素を含まない場合は0）
 */
const findMaxJsxDepth = (sourceFile) => {
  let maxDepth = 0;

  /**
   * @param {ts.Node} node
   * @param {number} depth 現在のJSX要素ネスト深さ
   */
  const visit = (node, depth) => {
    const isJsxElement = ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node);
    const nextDepth = isJsxElement ? depth + 1 : depth;
    maxDepth = Math.max(maxDepth, nextDepth);
    ts.forEachChild(node, (child) => visit(child, nextDepth));
  };

  visit(sourceFile, 0);
  return maxDepth;
};

/**
 * 1ファイル分の行数・JSXネスト深さをチェックし、閾値超過のメッセージ一覧を返す
 * @param {string} filePath チェック対象のファイルパス
 * @returns {string[]} 閾値超過を表すメッセージの配列
 */
const checkFile = (filePath) => {
  const sourceText = readFileSync(filePath, 'utf-8');
  const lineCount = sourceText.split('\n').length;
  const violations = [];

  if (lineCount > MAX_LINES) {
    violations.push(`${filePath}: ${lineCount}行（${MAX_LINES}行を超過）`);
  }

  if (filePath.endsWith('.tsx')) {
    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const jsxDepth = findMaxJsxDepth(sourceFile);
    if (jsxDepth > MAX_JSX_DEPTH) {
      violations.push(`${filePath}: JSXネスト深さ${jsxDepth}（${MAX_JSX_DEPTH}を超過）`);
    }
  }

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
    `\n${allViolations.length}件のファイルが行数・JSXネスト深さの閾値を超えています。責務が集まりすぎていないか、design_principles.mdのSRP・OCP等の設計原則に照らして再確認してください（超過自体が即座に禁止というわけではなく、再確認のきっかけです）。`
  );
  process.exit(1);
}
