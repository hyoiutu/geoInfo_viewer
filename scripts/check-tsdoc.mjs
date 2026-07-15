#!/usr/bin/env node
// comment_rules.md「テスト以外の全ての関数にTSDocを書く」のうち、TSDocコメントが1件も無い関数を機械的にチェックするスクリプト。
// - モジュールトップレベルの関数宣言・関数を代入する変数宣言・クラスメソッドを対象とする
// - チェックするのはTSDoc（/** ... */）の有無のみで、オブジェクト型の引数・戻り値を名前付きtypeへ
//   抽出しているか等の詳細な書き方までは検証しない（そこは引き続き人間・AIエージェントによるレビューが必要）
// - ネストした関数（他の関数内で定義されるローカルなヘルパー・コールバック）は対象外とする
//
// 使い方:
//   node scripts/check-tsdoc.mjs <file1> <file2> ...   # 指定ファイルのみチェック（lint-staged向け）
//   node scripts/check-tsdoc.mjs                       # backend/src, frontend/src, electron 配下を全件チェック

import { globSync, readFileSync } from 'node:fs';
import ts from 'typescript';

const DEFAULT_GLOB_PATTERNS = ['backend/src/**/*.ts', 'frontend/src/**/*.{ts,tsx}', 'electron/**/*.ts'];
const TEST_FILE_PATTERN = /(__tests__\/|\.tests\.tsx?$|\.spec\.tsx?$|test-utils\/|global-setup\.ts$)/;

/**
 * ノードの直前にTSDoc（/** ... *\/形式）コメントが付いているか確認する
 * @param {ts.Node} node チェック対象のノード
 * @param {ts.SourceFile} sourceFile ノードが属するSourceFile
 * @returns {boolean} TSDocコメントが見つかったかどうか
 */
const hasLeadingTsDoc = (node, sourceFile) => {
  const sourceText = sourceFile.getFullText();
  const commentRanges = ts.getLeadingCommentRanges(sourceText, node.getFullStart()) ?? [];
  return commentRanges.some(
    (range) =>
      range.kind === ts.SyntaxKind.MultiLineCommentTrivia && sourceText.slice(range.pos, range.pos + 3) === '/**'
  );
};

/**
 * 1ファイル分のトップレベル関数・クラスメソッドをチェックし、違反一覧を返す
 * @param {string} filePath チェック対象のファイルパス
 * @returns {string[]} 違反内容を表すメッセージの配列
 */
const checkFile = (filePath) => {
  const sourceText = readFileSync(filePath, 'utf-8');
  const scriptKind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, scriptKind);
  const violations = [];

  /** @param {ts.Node} statement @param {string} name */
  const checkStatement = (statement, name) => {
    if (!hasLeadingTsDoc(statement, sourceFile)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile));
      violations.push(`${filePath}:${line + 1}: 「${name}」にTSDocコメントがありません(comment_rules.md参照)。`);
    }
  };

  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      checkStatement(statement, statement.name.text);
      continue;
    }
    if (ts.isVariableStatement(statement) && statement.declarationList.declarations.length === 1) {
      const [declaration] = statement.declarationList.declarations;
      const isFunctionLike =
        declaration.initializer &&
        (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer));
      if (isFunctionLike && ts.isIdentifier(declaration.name)) {
        checkStatement(statement, declaration.name.text);
      }
      continue;
    }
    if (ts.isClassDeclaration(statement)) {
      for (const member of statement.members) {
        if (ts.isMethodDeclaration(member) && ts.isIdentifier(member.name)) {
          checkStatement(member, `${statement.name?.text ?? '(anonymous)'}.${member.name.text}`);
        }
      }
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
    `\nTSDocコメント不足が${allViolations.length}件見つかりました。comment_rules.mdの「テスト以外の全ての関数にTSDocを書く」を確認してください。`
  );
  process.exit(1);
}
