#!/usr/bin/env node
// comment_rules.md「ドキュメント・設定ファイルに特定PCのフルパス（絶対パス）を書かない」を機械的にチェックするスクリプト。
// - `/Users/<name>/...`・`/home/<name>/...`・Windowsの`C:\Users\<name>\...`形式のパスをMarkdownファイルから検出する
// - コードブロック（```で囲まれた範囲）内のNG例は意図的な例示のため対象外とする
//
// 使い方:
//   node scripts/check-absolute-paths.mjs <file1> <file2> ...   # 指定ファイルのみチェック（lint-staged向け）
//   node scripts/check-absolute-paths.mjs                       # リポジトリ内の全Markdownファイルをチェック

import { globSync, readFileSync } from 'node:fs';

const DEFAULT_GLOB_PATTERNS = ['**/*.md'];
const IGNORE_PATTERNS = ['**/node_modules/**', '**/dist/**', '**/dist-electron/**', '**/coverage/**'];
// <ユーザー名>のようなプレースホルダーの説明（ルール文中の一般的な言及）は誤検知しないよう、
// パスの先頭セグメントが`<`で始まらない実際のパスらしきものだけを対象にする
const ABSOLUTE_PATH_PATTERN = /(\/Users\/(?!<)[^\s)"'`]+|\/home\/(?!<)[^\s)"'`]+|[A-Za-z]:\\Users\\(?!<)[^\s)"'`]+)/;

/**
 * 1ファイル分の絶対パスをチェックし、違反一覧を返す
 * @param {string} filePath チェック対象のファイルパス
 * @returns {string[]} 違反内容を表すメッセージの配列
 */
const checkFile = (filePath) => {
  const lines = readFileSync(filePath, 'utf-8').split('\n');
  const violations = [];
  let inCodeBlock = false;

  lines.forEach((line, index) => {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      return;
    }
    // コードブロック内は意図的なNG例（rules.md自体のドキュメント例等）のため対象外とする
    if (inCodeBlock) {
      return;
    }
    const match = line.match(ABSOLUTE_PATH_PATTERN);
    if (match) {
      violations.push(`${filePath}:${index + 1}: 特定PCのフルパスが含まれています(comment_rules.md参照)。 ${match[0]}`);
    }
  });

  return violations;
};

const targetFiles =
  process.argv.length > 2
    ? process.argv.slice(2).filter((filePath) => filePath.endsWith('.md'))
    : DEFAULT_GLOB_PATTERNS.flatMap((pattern) => globSync(pattern, { exclude: IGNORE_PATTERNS }));

const allViolations = targetFiles.flatMap((filePath) => checkFile(filePath));

if (allViolations.length > 0) {
  for (const violation of allViolations) {
    console.error(violation);
  }
  console.error(
    `\n特定PCのフルパスが${allViolations.length}件見つかりました。comment_rules.mdの「ドキュメント・設定ファイルに特定PCのフルパス（絶対パス）を書かない」を確認してください。`
  );
  process.exit(1);
}
