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

8. **バックエンドが返すデータは「保存・返却されること」だけでなく「フロントエンドで消費・表示されること」も別にテストする**
   - バックエンドのAPIレスポンスに新しいフィールドを追加した場合、そのフィールドが正しい値で返る（保存・返却される）ことを検証するテストはバックエンド側に書くが、それだけでは「フロントエンドが実際にそのフィールドを使ってUIに反映する」ことは保証されない。
   - フロントエンド側（該当するフック・コンポーネント）に、「そのフィールドの値に応じて期待通りの振る舞いをする（例: エラー用フィールドが非nullならエラー通知コールバックを呼ぶ）」ことを検証するテストを別途書くこと。
   - 実例: `BackfillStatus.lastError`フィールドをバックエンドに追加し保存・返却されることはテスト済みだったが、フロントエンドの`useBackfillStatus`がそれを読んでエラーダイアログに表示する処理自体を書き忘れ、かつそれを検証するテストも無かったため、実装レビューで初めて発覚した（PR #10）。このテストを実装時点で書いていれば、抜けはその場でRed（失敗）になり気づけていた。

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
- **DB（PostgreSQL/PostGIS, TypeORM）を伴うサービスのテスト**: 実DBには接続せず、`@nestjs/typeorm`の`getRepositoryToken(Entity)`を使い`Repository<Entity>`を`vi.fn()`でモック化する（`find`/`save`/`findOneBy`等）。実際のSQL・PostGIS空間クエリの振る舞い自体はこの方法では検証できないため、マイグレーション適用やPostGISジオメトリの保存・取得結果は、ルートの`docker-compose.yml`（PostGIS同梱のPostgreSQLコンテナ、ポート`5433`）を`docker-compose up -d`で起動した上で手動確認すること（詳細はREADME.md参照）。
  - コンストラクタ引数に複数の`@InjectRepository(...)`のようなパラメータデコレータを使う場合、Biomeの既定設定ではパース時に`Decorators are not valid here`エラーになる。`biome.json`の`javascript.parser.unsafeParameterDecoratorsEnabled: true`を設定すること。
- **TypeORM Entity固有の注意点**:
  - Entityクラスのプロパティは`strictPropertyInitialization`により初期化必須と判定されるため、`id!: string`のように definite assignment assertion (`!`) を付与する（TypeORMはデコレータ・リフレクションでプロパティを設定するため、コンストラクタでの初期化は行わない）。
  - `TypeOrmModuleOptions`/`DataSourceOptions`はDBドライバごとの判別可能共用体になっているため、設定を組み立てるヘルパー関数の戻り値に`DataSourceOptions`等の広い型を明示的に注釈すると、`type: 'postgres'`のようなリテラルが`string`に幅拡張され、共用体のどのメンバーにも一致しなくなり型エラーになることがある。戻り値の型注釈を省略しTypeScriptに具体的な型を推論させるか、`as const`でリテラル型を保持すること。
- **fire-and-forgetな非同期処理（バックグラウンドジョブ等）のテスト**: `start()`のようなメソッドが内部で`await`せず非同期処理を裏で走らせる（例: `this.runJob().finally(...)`を呼び出し元では待たない）設計の場合、以下の2パターンで書き分けること。
  - 「実行中であること」自体を検証したいテスト（例: 二重起動防止、`isRunning()`がtrueになる）は、依存するモックの一つ（例: 外部API呼び出し）を`new Promise(() => {})`（意図的に解決しないPromise）にして、ジョブを確実に「実行中のまま」で止める。`await service.start()`直後に非同期チェーンがどこまで進んでいるかはPromiseのマイクロタスク解決順に依存し予測できないため、タイミング競合を避けるにはこの方法が確実。
  - 「ジョブが完了した後の結果」を検証したいテスト（例: DBへの保存内容、完了後に`isRunning()`がfalseに戻ること）は、`await service.start()`の後に`await new Promise((resolve) => setTimeout(resolve, 0))`（マクロタスクへの切り替え）を挟んでから検証する。これにより、内部の`await`連鎖（マイクロタスク）が全て解決されたことを保証できる。
- **モックの戻り値を呼び出しごとに変える場合**: 同じモック関数（`Repository.count()`/`find()`やHTTPクライアント等）が複数の異なる意味の呼び出しをする場合、`mockResolvedValueOnce().mockResolvedValueOnce()...`のように**呼ばれた順番**で戻り値を変えると、「何回目の呼び出しが何を意味するか」を説明するコメントが必要になり可読性が下がる上、実装の呼び出し順序が変わるだけで容易に壊れる。呼び出し**引数の中身**で意味を区別できる場合は、`mockImplementation`で引数の形に応じた値を返すこと（例: TypeORMの`IsNull()`/`Not(IsNull())`は`FindOperator`インスタンスで`.type`から種別判定できるため、`where`句の中身に応じて`count()`の戻り値を出し分ける）。一方、呼び出し引数が毎回同一で「時間の経過」等それ自体が区別材料にならない場合（例: トークン失効の前後で同じリフレッシュリクエストを2回投げるテスト）は、順序依存のモックが唯一の手段であり無理に引数ベース化する必要は無い。
- **モジュールレベルの環境変数を`vi.resetModules()`＋動的importで再読込してテストする場合**: `backend/tsconfig.json`は`moduleResolution: "NodeNext"`のため、`await import('../foo')`のような**動的import**は相対パスに拡張子（`.js`。`.ts`ファイルを指す場合でも`.js`と書く）を付けないと`tsc --noEmit`が`Cannot find module`エラーを出す。同じファイルへの**静的import**（`import { X } from '../foo'`）は拡張子無しでも通るため紛らわしいが、動的importのみこの制約を受ける。vitest実行時（esbuild/vite変換）は拡張子の有無に関わらず動作するため、typecheckで初めて気づきやすい。

### E2Eテスト（electron/tests/, Playwright）

- **テストフレームワーク**: `@playwright/test`（`playwright.config.ts`の`testDir: './electron/tests'`）。Electronアプリ自体を`_electron`（`import { _electron as electron } from 'playwright'`）で起動して操作する。ヘルパーは`electron/tests/support/electron-app.ts`。
- **実行コマンド**: `pnpm run test:e2e`（`pnpm run build`でフロントエンド/Electronをビルドしてから実行するため、`ELECTRON_RENDERER_URL`は未設定で常に`frontend/dist`のビルド成果物を読み込む経路になる）。
- **テスト用DB**: 開発用DB（`docker-compose.yml`、ポート`5433`）とは別に、E2E専用の`docker-compose.e2e.yml`（ポート`5434`、DB名`geo_info_viewer_e2e`）を使う。**必ず`docker-compose -p geo_info_viewer_e2e -f docker-compose.e2e.yml ...`のようにプロジェクト名を明示すること**。省略するとdocker-composeがカレントディレクトリ名から開発用と同じプロジェクト名を導出し、開発用DBコンテナを上書きしてしまう（実際に発生した事故。ボリュームは別名のためデータ消失はしなかったが、コンテナが一時的に別物に置き換わった）。起動・マイグレーション・TRUNCATEは`electron/tests/global-setup.ts`（`playwright.config.ts`の`globalSetup`）が自動で行う。
- **E2E用バックエンドは開発用と別ポート（3100番）で起動する**: DBだけでなくバックエンドのHTTPポートも開発用（3000番、`nest start --watch`等でローカルに常駐しがち）と衝突しうる。Playwrightの`webServer`は`reuseExistingServer: !process.env.CI`のため、同じポートに何か別プロセスが既にlistenしていると、E2E用の設定（`STRAVA_API_BASE_URL`のモック向け上書き等）を一切適用せずそのプロセスをそのまま「起動済みサーバー」として使ってしまい、無関係な既存プロセス（実Strava接続の開発用バックエンド等）に対してテストが実行される（実際に発生した事故：この状態でも「初期取り込みボタンがdisabledにならない」という形でテストが失敗したため気づけたが、気づかず誤ったサーバーに対して通ってしまうケースもありうる）。これを避けるため、`backend/src/main.ts`は`process.env.PORT`があればそれを使い、`playwright.config.ts`の`webServer`はE2E専用ポート（`BACKEND_PORT = 3100`）を`PORT`環境変数として渡す。フロントエンド（`frontend/src/api/activitiesApi.ts`）の接続先も`import.meta.env.VITE_BACKEND_BASE_URL`で上書き可能にしてあり、ルートの`package.json`の`test:e2e`スクリプトが`VITE_BACKEND_BASE_URL=http://localhost:3100`を設定した上で`pnpm run build`（Vite）を実行することで、ビルド成果物に3100番ポートへの接続先が焼き込まれる。
- **Strava APIのモック**: 実Stravaアカウントを使わず、`electron/tests/support/mock-strava-server.js`（Node標準`http`のみ、新規依存なし）をローカルで起動し、`playwright.config.ts`の`webServer`でバックエンドの`STRAVA_API_BASE_URL`/`STRAVA_OAUTH_TOKEN_URL`をこのモックへ向ける。モックはStrava本来のAPIに加え、テスト側から状態を操作するための`POST /__test__/reset`・`POST /__test__/activities`を持つ（別プロセスなのでテストファイルから直接オブジェクトを共有できないため、HTTP経由で操作する）。フィクスチャ生成は`electron/tests/fixtures/activities.js`。
- **レート制限のE2E向け短縮**: `STRAVA_RATE_LIMIT_INTERVAL_MS`環境変数（`playwright.config.ts`の`webServer`で設定）でStravaレート制限の間隔を極小値に上書きし、初期取り込み(バックフィル)の待機時間を実用的な長さに抑える。
- **地図タイル（OSM/航空写真）は実サーバーへ接続する**: モックせず本物のタイルサーバーを使う。タイルデータの経年変化による微小な差分を許容するため、`playwright.config.ts`の`expect.toHaveScreenshot.maxDiffPixelRatio`で閾値を設定している。ベースライン画像と大きく異なる場合のみ実装のバグを疑い、微差の場合は目視確認の上でベースラインを再生成する。
- **Chakra UI `Switch`（レイヤートグル等）のクリック**: `getByRole('checkbox', { name: ... }).click({ force: true })`は**動かない**（隠しinputへのforceクリックではReactの制御状態`checked`が切り替わらないことがあり、後続の状態変化に依存するアサーションが永久にタイムアウトする）。これはPlaywrightの自動操作特有の問題であり、実際のユーザー操作では発生しない（アプリ側のバグではない）。実ユーザーは`<label>`内の可視部分（スイッチの見た目やラベルテキスト）をクリックし、ブラウザ標準のlabel→input転送で隠しinputまで正しくトグルされる。`force`は「他要素に覆われクリックできない」というPlaywrightの警告を無視して隠しinputへ直接クリックを強制するが、この経路ではlabel転送のような自然なクリック連鎖が再現されず状態が更新されない。`Switch.Root`は隠しinputと`for`で紐づいた`<label>`としてレンダリングされるため、代わりに`getByText('<ラベル文字列>', { exact: true }).click()`でラベルのテキスト（実ユーザーがクリックするのと同じ可視部分）をクリックすること。
- **`page.waitForLoadState('networkidle')`でAPI応答完了を待つのは避ける**: クリック等の操作の直後に呼ぶと、「操作のハンドラがまだ非同期処理を開始していない一瞬」を「既にidle」と誤判定して即座に解決してしまう競合が起きる（実際にこれが原因でスクリーンショットのベースラインがデータ読み込み前の状態で保存される事故が発生した）。特定のAPI呼び出し完了を待ちたい場合は、操作の**前**に`const responsePromise = page.waitForResponse(...)`を仕込んでから操作し、操作後に`await responsePromise`する（`waitForResponse`は登録した時点から先のイベントを待つため、操作前に登録することで確実に捕捉できる）。
- **スクリーンショットのベースライン生成**: 初回は`npx playwright test --update-snapshots`（または対象ファイルを指定）で生成し、生成された画像を必ず目視確認してからコミットすること（データが正しく反映されているかはスクリーンショットの「撮影に成功したか」だけでは分からない）。
- **テストファイル間の並列実行は、参照するテーブル・状態が重複しないファイルに限って許可する**（Issue #8）: `playwright.config.ts`のデフォルト（`fullyParallel: false`）では、ファイル間は`workers`数に応じて並列実行される一方、1ファイル内のテストは順番に直列実行される。この性質を利用し、
  - `cycling_activities`・`sync_state`テーブルやモックStravaサーバーの状態（`__test__/reset`・`__test__/activities`）を操作するテストは、互いのデータを壊し合わないよう**1つのテストファイルにまとめ**、`test.describe.serial(...)`で「前のテストが失敗したら後続をスキップする」順序保証をかける（`electron/tests/bicycle-log.spec.ts`）。`describe.serial`を使わない素の直列実行でも順番は保たれるが、前段が失敗した状態で後段を実行すると原因の分からない二次的な失敗が起きるため、依存関係のあるテストには`describe.serial`を使うこと。
  - それらのテーブル・モック状態に一切触れないテスト（例: 地図の表示確認・航空写真レイヤーの表示確認）は**別ファイルに分ける**ことで、`workers`を2以上に設定してファイル間の並列実行を活かせる。
  - 新しいE2Eシナリオを追加する際は、既存のテーブル・モック状態を参照するかどうかを必ず確認し、参照する場合は該当ファイルへテストケースとして追加する（新規ファイルに分けない）こと。
- **新規アクティビティ検出（`sync()`）のフィクスチャの`start_date`**: `ActivitiesService.sync()`の新規判定は「前回同期時刻(`sync_state.last_synced_at`、テスト実行時のウォールクロック時刻)より後の`start_date`」で行う。フィクスチャの`start_date`を固定の過去日時にすると、テスト実行時点（現在時刻）を基準にした前回同期時刻より確実に前になり、新規と判定されない。`new Date().toISOString()`のような単純な現在時刻も、`after`パラメータがepoch秒に丸められるため前回同期時刻と同じ秒に丸まり判定漏れすることがある。`new Date(Date.now() + 60_000).toISOString()`のように十分な未来マージンを持たせること。
