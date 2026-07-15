#!/usr/bin/env node
// react_rules.md「boolean型の属性値は省略する」を機械的にチェックするスクリプト。
// `<Component personal={true} />`のように、JSX属性値が`{true}`と明示的に書かれている箇所を検出する
// （`{false}`は省略記法が無い＝属性自体を書かないことになり意味が変わるため対象外）。
//
// 使い方:
//   node scripts/check-boolean-jsx-props.mjs <file1> <file2> ...   # 指定ファイルのみチェック（lint-staged向け）
//   node scripts/check-boolean-jsx-props.mjs                       # frontend/src 配下を全件チェック

import { globSync, readFileSync } from 'node:fs';
import ts from 'typescript';

const DEFAULT_GLOB_PATTERNS = ['frontend/src/**/*.tsx'];

/**
 * 1ファイル分のJSX属性をチェックし、違反一覧を返す
 * @param {string} filePath チェック対象のファイルパス
 * @returns {string[]} 違反内容を表すメッセージの配列
 */
const checkFile = (filePath) => {
  const sourceText = readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations = [];

  /** @param {ts.Node} node */
  const visit = (node) => {
    if (ts.isJsxAttribute(node) && node.initializer && ts.isJsxExpression(node.initializer)) {
      const expression = node.initializer.expression;
      if (expression && expression.kind === ts.SyntaxKind.TrueKeyword) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        violations.push(
          `${filePath}:${line + 1}: JSX属性「${node.name.getText(sourceFile)}={true}」は省略記法を使ってください(react_rules.md参照)。`
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
    ? process.argv.slice(2).filter((filePath) => filePath.endsWith('.tsx'))
    : DEFAULT_GLOB_PATTERNS.flatMap((pattern) => globSync(pattern));

const allViolations = targetFiles.flatMap((filePath) => checkFile(filePath));

if (allViolations.length > 0) {
  for (const violation of allViolations) {
    console.error(violation);
  }
  console.error(
    `\nboolean属性の省略記法違反が${allViolations.length}件見つかりました。react_rules.mdの「boolean型の属性値は省略する」を確認してください。`
  );
  process.exit(1);
}
