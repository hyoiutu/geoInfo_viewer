#!/usr/bin/env node
// rules.md「anyやas（型キャスト）は原則使用しない」を機械的にチェックするスクリプト。
// - `as unknown as T` は理由コメントの有無に関わらず常にエラーにする
// - それ以外の型アサーション（`as T` / 旧構文の `<T>expr`）は、直前行または同一行末尾に
//   `//` コメントが無ければエラーにする（`as const` は対象外）
// - `import { x as y }` の別名importはTypeScriptのAST上は別のノード種別（ImportSpecifier）であり、
//   AsExpressionとして解析されないため誤検出しない
//
// 使い方:
//   node scripts/check-type-assertions.mjs <file1> <file2> ...   # 指定ファイルのみチェック（lint-staged向け）
//   node scripts/check-type-assertions.mjs                       # backend/src, frontend/src, electron 配下を全件チェック

import { globSync, readFileSync } from 'node:fs';
import ts from 'typescript';

const DEFAULT_GLOB_PATTERNS = ['backend/src/**/*.ts', 'frontend/src/**/*.{ts,tsx}', 'electron/**/*.ts'];

/** @param {ts.Node} node @returns {boolean} `as const` 型アサーションかどうか */
const isConstAssertion = (node) =>
  ts.isTypeReferenceNode(node.type) && ts.isIdentifier(node.type.typeName) && node.type.typeName.text === 'const';

/** @param {ts.Node} node @returns {boolean} 型部分が `unknown` キーワードかどうか */
const isUnknownKeyword = (node) => node.type.kind === ts.SyntaxKind.UnknownKeyword;

/** @param {ts.Node} node 剥がす対象のノード @returns {ts.Node} 括弧を全て取り除いた式 */
const unwrapParentheses = (node) => {
  let current = node;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
};

/**
 * 型アサーションのノードに、直前行または同一行末尾の`//`コメントが付いているか確認する
 * @param {ts.Node} node チェック対象のノード
 * @param {ts.SourceFile} sourceFile ノードが属するSourceFile
 * @param {string[]} lines ファイル全体を行ごとに分割した配列
 * @returns {boolean} 説明コメントが見つかったかどうか
 */
const hasNearbyExplanationComment = (node, sourceFile, lines) => {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const currentLine = lines[line] ?? '';
  if (currentLine.includes('//')) {
    return true;
  }
  for (let i = line - 1; i >= 0; i--) {
    const trimmed = (lines[i] ?? '').trim();
    if (trimmed === '') {
      continue;
    }
    return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
  }
  return false;
};

/**
 * 1ファイル分の型アサーションをチェックし、違反一覧を返す
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
    const isAssertion = ts.isAsExpression(node) || ts.isTypeAssertionExpression(node);
    if (isAssertion && !isConstAssertion(node)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      const snippet = node.getText(sourceFile).replaceAll('\n', ' ').slice(0, 80);

      const innerExpression = ts.isAsExpression(node) ? unwrapParentheses(node.expression) : undefined;
      if (innerExpression && ts.isAsExpression(innerExpression) && isUnknownKeyword(innerExpression)) {
        violations.push(`${filePath}:${line + 1}: 'as unknown as T' による強制キャストは禁止されています。 ${snippet}`);
      } else if (!hasNearbyExplanationComment(node, sourceFile, lines)) {
        violations.push(
          `${filePath}:${line + 1}: 型キャスト(as)には回避できない理由を説明する//コメントが必要です(rules.md参照)。 ${snippet}`
        );
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return violations;
};

const targetFiles =
  process.argv.length > 2
    ? process.argv.slice(2).filter((filePath) => /\.tsx?$/.test(filePath))
    : DEFAULT_GLOB_PATTERNS.flatMap((pattern) => globSync(pattern));

const allViolations = targetFiles.flatMap((filePath) => checkFile(filePath));

if (allViolations.length > 0) {
  for (const violation of allViolations) {
    console.error(violation);
  }
  console.error(
    `\n型キャストのルール違反が${allViolations.length}件見つかりました。rules.mdの「anyやas（型キャスト）は原則使用しない」を確認してください。`
  );
  process.exit(1);
}
