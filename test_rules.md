# Test Rules（単体テスト規約）

本ファイルは、AIエージェントが単体テストを作成・実行する際に必ず遵守すべきルールを定義します。テストコードにも `rules.md` のコーディング規約（`type` の使用、アロー関数、命名規則等）は変わらず適用されます。本ファイルはテスト固有の追加ルールです。

参考記事:
- https://qiita.com/mokio/items/95e962c59a142978bcb2
- https://zenn.dev/toms74209200/articles/first-step-unit-testing

---

## 🚫 絶対遵守ルール (Mandatory Rules)

1. **AAAパターンで書く**
   - 各テストケースは Arrange（準備）→ Act（実行）→ Assert（確認）の3段階で構成する。
   - Act は基本的に1行（テスト対象の呼び出し1回）に留める。テストケース内にif文などの条件分岐を書いてはならない。分岐が必要になった場合は、条件ごとにテストケースを分割する。

2. **すべての分岐を網羅する**
   - `if-else` / `try-catch-finally` / `switch-case` / 三項演算子など、テスト対象コード内の分岐は全パターンをテストケースとしてカバーする。
   - 単純な表示コンポーネントであっても対象から除外しない。すべてのユニットに適用する。

3. **specs/ 以下の仕様と矛盾しない**
   - `specs/` 配下に仕様書が存在する場合、その内容を最優先する。実装が `specs/` と食い違っている場合、テストを実装に合わせて書くのではなく、まず矛盾をユーザーに報告すること。
   - 本ルールは単体テスト・E2Eテストの両方に適用する。

4. **テストは疎結合にする**
   - 各テストケースは他のテストケースの実行順序や状態に依存してはならない。
   - モック・スタブは各テストの `beforeEach` 等で初期化し、テスト間で状態を共有しない。
   - Electronの `window.api` など実際には存在しない依存（隠れた依存）は `vi.fn()` 等でスタブ化し、本物のIPC通信を発生させない。

5. **ファイル配置・命名規則**
   - テスト対象ファイルと同じディレクトリ内に `__tests__` ディレクトリを作成し、その中にテストファイルを置く。
   - ファイル名は `<対象ファイル名>.tests.ts`（Reactコンポーネントの場合は `.tests.tsx`）とする。
   - 例: `frontend/src/utils/format.ts` → `frontend/src/utils/__tests__/format.tests.ts`

6. **テスト対象ごとに1ファイル**
   - コンポーネント配下は1コンポーネントにつき1テストファイル。
   - hooks配下は1カスタムフックにつき1テストファイル。
   - utils配下は1関数につき1テストファイル。
   - Electronメインプロセス・NestJSモジュール等バックエンド側も同様に、1モジュール（1ファイル）につき1テストファイルを用意する。フロントエンド以外だからという理由でテスト対象から除外しない。
   - 新しいディレクトリを追加した場合も、本ルールの精神（1ユニット1テストファイル、`__tests__`配置）を適用し、本ファイルにディレクトリを追記すること。

7. **コンポーネントのテストはTesting Libraryでレンダリング結果を検証する**
   - `@testing-library/react` の `render` / `screen` を使用し、内部実装ではなくレンダリング結果（DOM上のテキスト・要素の有無・属性）を検証する。
   - `getByRole` / `getByText` 等ユーザー視点のクエリを優先し、`container.querySelector` のような実装詳細に依存したセレクタは避ける。

---

## 📖 テスト作成時の観点（参考記事より）

- **テストシナリオは日本語で先に書く**: 実装前にテストの意図を日本語で書き出し、何を保証したいテストかを明確にしてから実装する。
- **4種類の入出力を意識する**: 明示的な入力（引数）・明示的な出力（戻り値）に加え、隠れた入力（依存関係・内部状態・外部プロセス）・隠れた出力（副作用・状態変化）も洗い出し、必要に応じてテストダブル（モック/スタブ/フェイク）で扱う。
- **DAMP（Descriptive And Meaningful Phrases）を優先する**: テストコードはDRYよりも「読んで意図がわかること」を優先する。可読性を犠牲にしてまで共通化しない（ただし本プロジェクトの `rules.md` のDRY原則と矛盾する場合は、テスト対象コードではなくテストコード側にのみこの例外を適用する）。
- **アサーションは意図が伝わるものを選ぶ**: `toBe` / `toEqual` / `toBeInTheDocument` 等、失敗時のメッセージが分かりやすいマッチャーを選択する。
- **カバレッジ率は目的ではなく手段**: 高いカバレッジ率はテストの質を保証しない。ルール2（分岐網羅）を満たした結果として計測されるものであり、数値自体を目的化しない。

---

## 📝 開発プロジェクト固有の設定

- **テストフレームワーク**: Vitest + Testing Library（`@testing-library/react` / `@testing-library/dom` / `@testing-library/jest-dom`）
- **実行環境**: jsdom（`frontend/vite.config.ts` の `test.environment`）
- **セットアップファイル**: `frontend/src/vitest.setup.ts`
  - `@testing-library/jest-dom/vitest` を読み込み、`toBeInTheDocument` 等のマッチャーを有効化する。
  - `test.globals: true` を使用していない（`describe` / `test` / `expect` 等を各ファイルで明示的にimportする）ため、Testing Libraryの自動クリーンアップが働かない。そのため `afterEach(() => cleanup())` を明示的に実行している。
- **Chakra UIを使用するコンポーネントのテスト**: ChakraのコンポーネントはSystemコンテキスト（`ChakraProvider`）を要求するため、`@testing-library/react`の`render`をそのまま使わず、`frontend/src/test-utils/renderWithChakra.tsx`（`ChakraProvider`でラップ済みの`render`）を使うこと。また、Chakraの`Dialog`（Ark UI）はクローズ処理やbackdropの外側クリック検知を内部で非同期に処理するため、状態変化を伴うアサーションは`waitFor`で待つ必要がある場合がある。backdropクリックのように内部実装が「外側クリック検知」に依存する挙動をアサーションしたい場合は、コンポーネント側で明示的な`onClick`ハンドラを持たせておくとテストが安定する。
- **Chakraの`Switch`（Ark UI）のクリックテスト**: `Switch.HiddenInput`への`fireEvent.click`はDOM上の`checked`をネイティブ挙動として同期的に反転させるが、`onCheckedChange`コールバックの呼び出しは内部の状態管理（`@zag-js/react`の`bindable`）を経由するため次のtickにずれ込む。`fireEvent.click`直後に同期的に`expect(onCheckedChange).toHaveBeenCalledWith(...)`を書くと、実装が正しくてもテストが失敗する。`await waitFor(() => expect(...))`で待つこと。
- **地図(MapLibre GL JS)を使用するコンポーネントのテスト**: jsdomはWebGL/canvasを持たないため、`maplibre-gl`は`vi.mock('maplibre-gl', ...)`でモジュール全体をモック化してテストする（実際のタイル取得・地図描画は行わない）。`Map`コンストラクタをモックする際は、`vi.fn().mockImplementation(function MockMap() { ... })`のように`function`宣言を使うこと（アロー関数は`new`で呼び出せないため`is not a constructor`エラーになる）。例: `frontend/src/components/__tests__/MapView.tests.tsx`。
- **共有モック・フィクスチャ**: 複数のテストファイルで共有するモック（例: Electronの`window.api`のスタブ、地図データのダミーフィクスチャ）やヘルパー（`renderWithChakra`等）は `frontend/src/test-utils/` に配置する。このディレクトリのファイルはテスト対象そのものではないため `*.tests.*` という命名は使わない（Vitestの実行対象に含めないため）。
- **`vi.restoreAllMocks()` は `vi.spyOn` で作成したモックにしか効かない**: `vi.mock('module', () => ({ fn: vi.fn() }))` のようにモックファクトリ内で作成した `vi.fn()` は、`vi.restoreAllMocks()` では呼び出し履歴も実装もクリアされず、次のテストへ持ち越されてしまう。モックファクトリで作成した関数のクリーンアップには `vi.resetAllMocks()`（または `vi.clearAllMocks()`）を使うこと。`vi.spyOn(window, 'alert')` のように実オブジェクトをスパイした場合は `vi.restoreAllMocks()` で元の実装に戻せるため、そちらは引き続き使用してよい。
- **実行コマンド**: `pnpm run test:unit`（`frontend/src/**/*.tests.*`と`backend/src/**/*.tests.*`の両方を実行する）

### バックエンド（backend/, NestJS）

- **テストフレームワーク**: Vitest（`@nestjs/testing`の`Test.createTestingModule`でテスト対象のモジュール/コントローラ/サービスを組み立てる）
- **設定ファイル**: `backend/vitest.config.ts`
  - vitestの既定トランスフォーム（esbuild、およびvitest v4で既定化されたOxc）は`emitDecoratorMetadata`をサポートしないため、`unplugin-swc`（`@swc/core`）をpluginとして使い、`oxc: false`を明示的に設定してOxcトランスフォームを無効化すること。これを怠るとNestJSのコンストラクタインジェクション（DI）が正しく動作しない。
  - コンストラクタで注入するクラス（例: `constructor(private readonly appService: AppService) {}`）はBiomeの`lint/style/useImportType`から「型としてのみ使用」と誤検知され`import type`への変換を提案されることがあるが、実行時の型メタデータ解決に実体の参照が必要なため、提案を鵜呑みにせず通常の`import`のまま残すこと（詳細は`rules.md`参照）。
- **命名・配置規約**: NestJS既定の`.spec.ts`ではなく、フロントエンドと同じ`__tests__`配置・`<対象ファイル名>.tests.ts`命名を使う（例: `backend/src/app.service.ts` → `backend/src/__tests__/app.service.tests.ts`）。
- **実行コマンド**: `pnpm --filter backend test:unit`

> **TODO**: backend/にPostgreSQL/PostGIS接続・ORMを実装するタイミングで、以下を本セクションに追記すること。
> - ORM選定（TypeORM/Prisma/MikroORM等）とPostGISジオメトリ型の扱い方
> - テスト用DBの用意方法（testcontainers、専用テストスキーマ等）
> - PostGISを含む空間クエリのテスト方法
