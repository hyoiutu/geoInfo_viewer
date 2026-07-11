# 変更履歴 (CHANGELOG)

本プロジェクトにおける「実装」「README.md」「仕様書」の連動修正の履歴を以下に記録します。

## テンプレート
<!--
### [YYYY-MM-DD] 修正タイトル
* **修正の動機・概要**: 〇〇
* **各ファイルへの影響と変更内容**:
  * **実装**: 〇〇
  * **README.md**: 〇〇
  * **仕様書**: 〇〇
-->

## 変更履歴

### [2026-07-11] GitHub Issue #5としてTSDocを導入した
* **修正の動機・概要**:
  - 様々な関数が定義されているが、どの関数がどんな役割でどんな引数を取りどんな返り値を返すか分からない状態だった（Issue #5）。
  - テストコード（`__tests__/`配下・`*.tests.ts(x)`・E2Eテストの`*.spec.ts(x)`）を除く、backend/src・frontend/src・electron配下の全関数（`export`の有無・アロー関数/`function`宣言/クラスメソッドを問わない）にTSDocコメントを追加した。
  - Issueの指示に従い、引数・戻り値がオブジェクト型の場合はインラインの型直書きのまま`@param`/`@returns`で列挙するのではなく、名前付きの`type`として抽出しプロパティ単位でTSDocを書く方針を採用した（`backend/src/database/database.config.ts`の`createDataSourceOptions`等、これまでインラインオブジェクトを返していた関数は本対応で戻り値を名前付き型に抽出した）。
  - 上記のTSDocの書き方をルールとして`rules.md`に追加した。追加作業中、既存のテスト除外パターン（`__tests__/`・`*.tests.ts(x)`）がPlaywrightのE2Eテスト（`*.spec.ts(x)`）や`electron/tests/global-setup.ts`等のテスト支援コードを想定していなかった不備に気づき、あわせて修正した。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `backend/src/`配下（`common/errors`・`strava`・`activities`・`app.*`・`main.ts`・`data-source.ts`・`database/`・`migrations/`）の全関数・クラスメソッドにTSDocを追加。
    - `frontend/src/`配下（`api`・`types`・`utils`・`hooks`・`components`・`App.tsx`・`test-utils/`）の全関数・コンポーネントにTSDocを追加。
    - `electron/main/main.ts`・`electron/tests/global-setup.ts`・`electron/tests/support/electron-app.ts`にTSDocを追加。
    - `backend/src/database/database.config.ts`の`createDataSourceOptions`は戻り値がインラインオブジェクトリテラルだったため、`DataSourceOptions`型として抽出（型抽出に伴い`entities`フィールドの型を`unknown[]`からタプル型へ修正し、TypeORMの型定義との不整合を解消）。
    - コメント・型抽出のみで振る舞いの変更は無い。単体テスト（バックエンド76件・フロントエンド76件）・lint・typecheck・E2Eテスト（4シナリオ）は全てGreenのまま。
  * **README.md**: 変更なし（環境構築手順のみを扱っており、コード規約は`rules.md`が担当するため）。
  * **仕様書**: 変更なし（アプリの機能仕様ではなく、コードドキュメント規約の変更のため）。
  * **その他**: `rules.md`に「テスト以外の全ての関数にTSDocを書く」規約を新設し、オブジェクト型引数・戻り値の型抽出方針とテストコードの除外パターン（E2E含む）を明記した。

### [2026-07-11] GitHub Issue #4としてエラーハンドリング機構を実装した
* **修正の動機・概要**:
  - これまでエラーはconsole.logでの記録や、`{success: false}`のようなfalthyな値の返却、または何も処理せずに例外を素通しにする実装が混在しており、ユーザーはエラー発生時に何が起きたか・どう対応すべきかを知る手段が無かった（Issue #4）。
  - バックエンドは全エンドポイントのエラーレスポンス形式を`{errorCode, message, hint}`（`AppErrorInfo`）に統一し、NestJSのグローバル例外フィルタで一元的に整形するようにした。Strava API呼び出しはHTTPステータスに応じて種別（認証失敗/レート制限/その他の通信エラー）を判別した例外に変換して投げるようにした。
  - フロントエンドはAPIのエラーレスポンスを`ApiError`としてthrowし、新設したエラーダイアログ（`ErrorDialog`）でユーザーにメッセージと対処法（hint）を表示するようにした。
  - `sync()`（自転車ログ更新用API）は、バックフィル実行中ガードによる`{success: false}`（正常系・エラーではない）と、Strava APIエラー等の実際の失敗を区別し、後者のみを例外として伝播するよう設計した。初期取り込み(バックフィル)はfire-and-forgetの非同期処理であるため、発生したエラーを`lastError`としてサービス内に保持し、ステータス取得API（ポーリング）経由でフロントエンドが参照できるようにした。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `backend/src/common/errors/`（新規）: `AppException`・`StravaApiException`・`AllExceptionsFilter`・`AppErrorInfo`型・`AppErrorCode`定数など、エラーハンドリングの共通基盤一式。
    - `backend/src/main.ts`: `AllExceptionsFilter`をグローバル例外フィルタとして登録。
    - `backend/src/strava/strava-auth.service.ts`・`strava-activities.service.ts`: Strava API呼び出しをtry/catchで囲み、`StravaApiException`へ変換して投げるようにした。
    - `backend/src/activities/activities.service.ts`: `sync()`のtry/catchによるエラー握りつぶし（`{success: false}`返却）を廃止し、バックフィル実行中ガード以外はエラーを伝播するようにした。
    - `backend/src/activities/activities-backfill.service.ts`: `BackfillStatus`に`lastError`フィールドを追加し、fire-and-forget処理内のエラーを記録・参照可能にした。
    - `frontend/src/types/apiError.ts`（新規）・`frontend/src/utils/apiError.ts`（新規）: `AppErrorInfo`型・`ApiError`クラス・エラー変換ユーティリティ。
    - `frontend/src/components/ErrorDialog.tsx`（新規）: Chakra UI v3の`Dialog`を使ったエラー表示ダイアログ。
    - `frontend/src/api/activitiesApi.ts`: レスポンス異常時のfalsy値返却・console.errorを`ApiError`のthrowへ置き換えた。
    - `frontend/src/hooks/useBackfillStatus.ts`・`frontend/src/components/MapView.tsx`・`MapWorkspace.tsx`: `onError`コールバックを配線し、エラーダイアログの表示状態を`MapWorkspace`で一元管理するようにした。
    - 単体テスト（バックエンド・フロントエンド双方に新規テストケース追加）・lint・typecheckは全てGreen。
  * **README.md**: 変更なし（環境構築手順のみを扱っており、個別機能の仕様は記載していないため）。
  * **仕様書**: `specs/system_specification.md`に「エラーハンドリング機構」節を新設し、エラーレスポンス形式・エラーコード一覧・`sync()`/バックフィルにおけるエラーと正常系(ガード)の区別・フロントエンドのエラーダイアログ方針を正式な仕様として記載。

### [2026-07-11] GitHub Issue #3としてE2Eテストを実装した
* **修正の動機・概要**:
  - E2Eテストが1件も存在しなかった（`playwright.config.ts`・`test:e2e`スクリプトは以前から用意されていたが未使用）ため、Issue #3で実装を依頼された。Issueは合わせて「テスト用DB・テスト用Strava アカウントの用意方法について、他に良い方法がないか調査してほしい」と依頼していた。
  - 調査の結果、`StravaActivitiesService`/`StravaAuthService`は`HttpService`を直接注入するだけの薄い層で抽象化が無く、URLがコード中に直接ハードコードされていたため、実Stravaアカウントを用意する代わりに、Strava APIを再現するローカルのモックサーバーを新規実装し、環境変数でバックエンドの向き先をそちらに切り替える方式を採用した（ユーザーと合意）。テスト用DBは開発用DBとは完全に分離した専用のDocker Composeサービスを新規に用意した（ユーザーと合意）。地図タイル（OSM/航空写真）は実サーバーへ接続し、スクリーンショット比較は微小な差分を許容する閾値を設定した（ユーザーと合意）。
  - 実装中に、Chakra UI `Switch`への`force`クリックがReactの制御状態を切り替えない、`waitForLoadState('networkidle')`がクリック直後のタイミング競合で早期に解決してしまう、`sync()`の新規判定が実行時刻ベース＋秒丸めのためフィクスチャの日時設計に注意が必要、docker-composeのプロジェクト名を省略すると開発用DBコンテナを上書きしてしまう、等の複数の非自明な問題を発見し都度対処した。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `backend/src/strava/strava.constants.ts`: `STRAVA_API_BASE_URL`/`STRAVA_OAUTH_TOKEN_URL`を環境変数で上書き可能にした（未設定時は従来通りStrava公式URL）。
    - `backend/src/strava/strava-rate-limiter.service.ts`: レート制限間隔を`STRAVA_RATE_LIMIT_INTERVAL_MS`環境変数で上書き可能にし、E2E実行時はバックフィル待機を実用的な長さに抑えられるようにした。
    - `docker-compose.e2e.yml`（新規）: E2E専用のPostGIS入りPostgreSQLサービス（ポート`5434`、DB名`geo_info_viewer_e2e`）。
    - `electron/tests/support/mock-strava-server.js`（新規）: Node標準`http`のみで実装したStrava APIモックサーバー。`oauth/token`・`athlete/activities`（ページネーション・`after`フィルタ対応）・`activities/:id`に加え、テスト側から状態操作するための`__test__/reset`・`__test__/activities`を持つ。
    - `electron/tests/fixtures/activities.js`（新規）: E2E用のダミーアクティビティ（自作のポリラインエンコーダ付き）を生成するヘルパー。
    - `electron/tests/global-setup.ts`（新規）: E2E用DBの起動・接続待ち・マイグレーション・TRUNCATEを行う`playwright.config.ts`の`globalSetup`。
    - `electron/tests/support/electron-app.ts`（新規）: Playwrightの`_electron`でElectronアプリを起動する共通ヘルパー。
    - `electron/tests/*.spec.ts`（新規、4ファイル）: 起動確認・自転車ログ初期取り込み・`sync()`による新規アクティビティ検出・航空写真レイヤーの4シナリオ。いずれもスクリーンショット比較を含み、ベースライン画像は目視確認済み。
    - `playwright.config.ts`: `webServer`（モックサーバー・バックエンド）・`globalSetup`・スクリーンショット許容閾値・`workers: 1`（テストファイル間で共有DB/モックサーバーを奪い合わないよう直列実行に固定）を追加。
    - `package.json`（ルート）: `pg`・`@types/pg`・`playwright`を新規追加（`electron/tests`はpnpmワークスペースに属さないため）。
    - 単体テスト（バックエンド59件・フロントエンド63件）・lint・typecheckは全てGreenのまま。E2Eテスト4件全て実機で成功確認済み。
  * **README.md**: 「E2Eテスト」節を新設し、`pnpm run test:e2e`の実行方法とスクリーンショットベースラインの更新・目視確認の必要性を記載。
  * **仕様書**: 変更なし（アプリの機能仕様ではなくテスト基盤の変更のため）。
  * **その他**: `test_rules.md`に「E2Eテスト」節を新設し、実装中に発見した知見（モックサーバー・専用DB構成の理由、Chakra Switchのクリック方法、`waitForResponse`の使い方、フィクスチャの日時設計、直列実行の必要性）を記録した。

### [2026-07-09] 初期取り込み(バックフィル)完了後の再実行を高速化した
* **修正の動機・概要**:
  - フェーズ6実装後の動作確認で、初期取り込みが100%完了した状態でボタンを再度押すと、ボタンが1〜2分disabledのまま戻らない現象をユーザーが発見した。
  - 原因を調査した結果、`ActivitiesBackfillService.start()`は毎回無条件に`fetchAllCyclingActivities()`（Strava一覧APIをレート制限(9秒間隔)で全ページ再取得）を実行しており、既に全件取得済み（`detailFetchedAt`がnullの行が無い）場合でも新規アクティビティの有無を確認するためだけに数十秒〜1分程度かかっていたことが判明した。
  - 通常運用における新規アクティビティの検出は`sync()`（レイヤーONのたび）が担うため、初期取り込みが一度完了した後の再実行では、この一覧再取得をスキップして即座に完了させることとした（ユーザーと合意の上で対応）。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `backend/src/activities/activities-backfill.service.ts`: `runBackfill()`を、まず`isFullyBackfilled()`（DB全体の件数が0件でなく、かつ`detailFetchedAt`がnullの行が無いかを軽量なCOUNTクエリ2回で判定）でチェックし、既に完了済みの場合は`fetchAllCyclingActivities()`をスキップするよう変更。DBが空（初回実行）の場合は従来通り全件取得する。
    - 単体テストを追加（既に完了済みの場合に一覧再取得が呼ばれないことを確認）。既存テストのモック順序を、追加された`count()`呼び出し分だけ調整。単体テスト全て（バックエンド56件・フロントエンド63件）Green、typecheck・lint成功を確認。
    - 実データ（629件、100%完了状態）で実際にバックフィルを再実行し、以前は1〜2分かかっていた完了までの時間が1秒未満に短縮されたことを確認済み。
  * **README.md**: 変更なし。
  * **仕様書**: 変更なし（「初期取り込み機能」の外部仕様（進捗表示・disabled等）は変えず、既に完了済みの場合の内部動作のみ最適化したため）。

### [2026-07-09] 自転車ログ表示機能フェーズ6: 詳細API化と初期取り込み(バックフィル)機能を実装した
* **修正の動機・概要**:
  - 自転車ログの描画が「カクカク」になる問題を調査した結果、一覧API（`GET /athlete/activities`）が返す`summary_polyline`がStrava側で間引かれた低解像度データであることが原因と判明した。高解像度の`polyline`は詳細API（`GET /activities/{id}`）を1件ずつ呼ばないと取得できない。
  - 詳細APIはStravaのレート制限（非アップロード系: 15分100リクエスト・1日1000リクエスト、[developers.strava.com/docs/rate-limits](https://developers.strava.com/docs/rate-limits/)）の対象であり、大量のログを一度に取得できないため、ユーザーと合意の上で以下の設計とした。
    - 今後追加される新規ライドも含め、通常の同期(`sync`)も詳細API化する（1回のレイヤーONあたり新規件数分のみのリクエストで済むため、レート制限にはほぼ影響しない）。
    - 過去分の一括取得（初期取り込み/バックフィル）は非同期のバックグラウンドジョブとして分離し、実行状態はインメモリ管理とする（バックエンド再起動時はリセットされ、ユーザーが再度ボタンを押せばDB上の未取得分から再開する）。
    - 詳細取得済みだがGPSルートの無い（手動記録等の）アクティビティを「未取得」と誤判定しないよう、`detail_fetched_at`列を追加し取得完了時刻で判別する。
  - `specs/system_specification.md`にユーザーが追記した「自転車ログ初期取り込み機能」の仕様（先にアクティビティ数・プレースホルダーレコードを用意し、進捗%と残り時間を表示し、実行中は更新系APIを走らせない）をそのままレビューし、矛盾・不足が無いことを確認した上で実装した。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `backend/src/strava/strava-rate-limiter.service.ts`（新規）: 15分100リクエストの間隔（9秒）を保証するレート制限サービス。
    - `backend/src/strava/strava-activities.service.ts`: `fetchAllCyclingActivities()`（`per_page=200`での全ページ取得、レート制限適用）・`fetchCyclingActivityDetail(id)`（詳細API、レート制限適用）を追加。
    - `backend/src/strava/types/strava-activity.type.ts`に`StravaActivityDetail`型（`map.polyline`を含む）を追加。
    - `backend/src/activities/cycling-activity-entity.util.ts`を`toPlaceholderCyclingActivityEntity`（プレースホルダー生成、pathは常にnull）と`toCyclingActivityEntityFromDetail`（詳細レスポンスから高解像度Entity生成、`polyline`が空の場合は`summary_polyline`にフォールバック、`detailFetchedAt`を設定）に置き換えた。
    - `backend/src/activities/entities/cycling-activity.entity.ts`に`detailFetchedAt`列を追加。マイグレーション`1720500000000-AddDetailFetchedAtToCyclingActivities`を新規作成し、ローカル(docker-compose)DBに適用済み。
    - `backend/src/activities/activities-backfill.service.ts`（新規）: `start()`（二重起動防止、一覧取得→未登録IDのプレースホルダー保存→未取得分の詳細取得を非同期に実行）・`getStatus()`（進捗%・残り時間の見積もりを返す）。
    - `backend/src/activities/activities.service.ts`の`sync()`を、新規アクティビティごとに詳細APIを呼び出しDBを高解像度で更新するよう変更。バックフィル実行中は`sync()`がStrava APIを呼ばず`success:false`を返すガードを追加。
    - `backend/src/activities/activities.controller.ts`に`POST /activities/backfill`・`GET /activities/backfill/status`を追加。
    - `frontend/src/api/activitiesApi.ts`に`startBackfill()`・`getBackfillStatus()`を追加。
    - `frontend/src/hooks/useBackfillStatus.ts`（新規）: マウント時に状態取得、実行中は5秒間隔でポーリングするフック。
    - `frontend/src/components/LayerSidebar.tsx`にレイヤー一覧の下へ「自転車ログ初期取り込み」ボタン（実行中はdisabled）と進捗率・残り時間の表示を追加。
    - `frontend/src/components/MapView.tsx`の同期処理を、バックフィル実行中は`syncCyclingActivities()`を呼ばず取得済み分のみ表示するよう変更。
    - 単体テスト全て（バックエンド55件・フロントエンド63件）Green、typecheck・lint成功を確認。
    - 実際にDocker上のPostGIS DB・実Strava認証情報でマイグレーション適用・バックフィル起動・進捗取得・`sync`のガード動作・フロントエンド表示（ボタンdisabled、進捗%・残り時間表示）を確認済み。実アカウントのアクティビティ件数は629件で、バックフィルはバックグラウンドで継続中（完了まで別途待つ必要あり、本セッションでは完了確認まで行っていない）。
  * **README.md**: 変更なし（セットアップ手順に変更は無いため）。
  * **仕様書**: ユーザーが記載した「自転車ログ初期取り込み機能」の仕様をレビューし、矛盾・不足が無いことを確認した上でそのまま実装（変更なし）。

### [2026-07-09] ローカルDB環境をdocker-compose化した（PostGISのHomebrewビルド失敗への対処）
* **修正の動機・概要**:
  - フェーズ4の時点では「ローカルのPostgreSQL/PostGIS環境は各自用意する前提とし、docker-compose等の共通環境は用意していない」としていたが、開発機のmacOSが12（Homebrewの Tier 3 = 非サポート対象）であるため、`brew install postgis`が依存関係（apache-arrow等）のソースビルドに失敗し続け、ネイティブ環境の用意ができない状態になった。
  - HomebrewでのビルドはmacOSバージョンに強く依存し根本解決が困難なため、`postgis/postgis`公式Dockerイメージを使い、ビルド不要でPostGIS入りPostgreSQLを起動する方式に変更した。ネイティブでHomebrew版PostgreSQL（ポート`5432`）を使っている環境と衝突しないよう、コンテナはホスト側`5433`番ポートで待ち受ける構成とした。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `docker-compose.yml`（新規、リポジトリルート）: `postgis/postgis:16-3.4`イメージ、ポート`5433:5432`、永続化ボリューム`geo_info_viewer_pgdata`を定義。
    - `backend/.env`・`backend/.env.example`の`DATABASE_PORT`を`5432`→`5433`、`DATABASE_USERNAME`/`DATABASE_PASSWORD`をdocker-composeのデフォルト（`postgres`/`postgres`）に合わせて変更。
    - `docker-compose up -d`→`pnpm --filter backend run migration:run`→バックエンドを起動し`POST /activities/sync`・`GET /activities`を実行、実際にStravaの走行データがPostGISの`geometry(LineString, 4326)`カラムへ保存・取得できることを確認済み。
  * **README.md**: 「バックエンド用データベース（PostgreSQL/PostGIS）」セクションを追加し、`docker-compose up -d`からマイグレーション実行までの手順を記載。
  * **仕様書**: 変更なし（DB技術選定は引き続きPostgreSQL/PostGISのまま、起動方法のみの変更のため）。
  * **その他**: `test_rules.md`・`commit_rules.md`のDB関連記述を、「ローカルDB環境は各自用意」からdocker-compose利用前提の記述に更新。

### [2026-07-08] 自転車ログ表示機能フェーズ5: 自転車ログをレイヤー化した
* **修正の動機・概要**:
  - フェーズ3の暫定実装（マウント時に一度だけ取得し常時表示）を、仕様書通りの「レイヤーとして左サイドバーから表示・非表示を切り替え、ONにしたタイミングで更新用API→参照用APIを呼び出す」挙動に置き換えた。
  - 更新用API（`sync`）が失敗した場合は参照用API（`fetchCyclingActivities`）を呼ばない設計とした（仕様書の「成功した後に参照用APIを呼び出す」という記述に従う）。エラー表示UIは今回のスコープ外とし、`console.error`のみとした。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `frontend/src/types/layer.ts`の`ToggleableLayerId`に`'bicycle-log'`を追加。`frontend/src/constants/layerDefinitions.ts`に`{ id: 'bicycle-log', name: '自転車ログ', defaultChecked: false }`を追加（サイドバーに自動反映される）。
    - `frontend/src/api/activitiesApi.ts`に`syncCyclingActivities()`（`POST /activities/sync`）を追加。
    - `frontend/src/components/MapView.tsx`を変更: スタイルロード時は空のGeoJSONソース・ラインレイヤーのみ追加し、`layerVisibility['bicycle-log']`が`false→true`に変化した時だけ`syncCyclingActivities()`→成功時のみ`fetchCyclingActivities()`→`map.getSource(...).setData(...)`を実行するように改修。フェーズ3の「マウント時に一度だけfetch」処理は削除。
    - `frontend/src/utils/mapLayerCategory.ts`・`frontend/src/hooks/useLayerVisibility.ts`関連のテストを`bicycle-log`追加に合わせて更新。
    - ブラウザ（Playwright経由、フロントエンド単体・バックエンド未起動）で実際にサイドバーの「自転車ログ」トグルをON/OFFし、ON時に`syncCyclingActivities`が呼ばれ、失敗時（バックエンド未起動によるconnection refused）に`fetchCyclingActivities`が呼ばれずconsole.errorのみ出ることを確認。地図描画・他レイヤーへの影響が無いことも確認済み。
    - なお本フェーズの完全なE2E確認（実際にStravaデータが地図上の自転車ログとして表示されること）には、ユーザー自身のPostgreSQL/PostGIS環境（マイグレーション適用済み）とStrava認証情報が必要（フェーズ4のTypeORM導入以降、バックエンドはDB接続無しでは起動できないため）。
  * **README.md**: 変更なし。
  * **仕様書**: 変更なし。

### [2026-07-08] 自転車ログ表示機能フェーズ4: 参照用API・更新用APIへの分割（DB化）を実装した
* **修正の動機・概要**:
  - フェーズ2〜3で実装した「Strava APIへの毎回パススルー」を、ユーザーと合意した設計（参照用API=DB参照、更新用API=Strava取得→DB更新→成功/失敗のみ返す）に置き換えた。
  - ORMはTypeORMを採用（ユーザーと合意済み）。実装時に依存解決された`typeorm`のバージョンが`1.0.0`という見慣れない値だったため、パッケージのリポジトリURL・メンテナ情報を確認し、正規のTypeORMプロジェクトのメジャーバージョンアップであることを確認した上で採用した。
  - DBを伴うサービスの単体テストは実DBを使わず`Repository`をモック化する方針とした（ユーザーと合意済み）。ローカルのPostgreSQL/PostGIS環境自体は各自用意する前提とし、docker-compose等の共通環境は用意していない。
  - 単一ユーザー前提のため、同期状態（前回同期時刻）は`sync_state`テーブルに1行のみ保持する設計とした。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - 依存追加: `@nestjs/typeorm`, `typeorm`, `pg`（本番）、`@types/pg`, `@types/geojson`, `dotenv`（開発）。
    - `backend/src/activities/entities/`を新規作成: `cycling-activity.entity.ts`（PostGISの`geometry(LineString, 4326)`カラムを含む）, `sync-state.entity.ts`（単一行管理）。
    - `backend/src/database/database.config.ts`（新規、テスト付き）: 環境変数からTypeORM接続設定を組み立てる。
    - `backend/src/data-source.ts`（新規）: マイグレーションCLI用のDataSource。
    - `backend/src/migrations/`（新規）: `postgis`拡張の有効化とテーブル作成。
    - `backend/src/activities/cycling-activity.util.ts`を`cycling-activity-entity.util.ts`（Strava→Entity変換）と`cycling-activity-dto.util.ts`（Entity→DTO変換）に分割。
    - `ActivitiesService`を`findAll()`（DB参照）と`sync()`（Strava取得→DB更新、失敗時は`{ success: false }`を返し例外を投げない）に分割。`ActivitiesController`に`POST /activities/sync`を追加。
    - `backend/.env.example`にDB接続用の環境変数を追記。`backend/package.json`に`migration:generate`/`migration:run`/`migration:revert`スクリプトを追加。
    - `biome.json`に`javascript.parser.unsafeParameterDecoratorsEnabled: true`を追加（複数の`@InjectRepository(...)`等パラメータデコレータをBiomeがパースできるようにするため）。
    - 単体テスト25件（backend）全てGreen、typecheck・`nest build`成功を確認。実DB無しのため、実際のマイグレーション適用・PostGIS空間クエリの動作確認はユーザー環境で別途行う必要がある。
  * **README.md**: 変更なし。
  * **仕様書**: 変更なし。
  * **その他**: `test_rules.md`・`commit_rules.md`のバックエンドDB関連TODOを、今回決定した内容（TypeORM・Repositoryモック・ローカルDB各自用意）で更新。

### [2026-07-08] 自転車ログ表示機能フェーズ3: フロントエンドからラップAPIを呼び出し地図上に表示した
* **修正の動機・概要**:
  - フェーズ2で実装したバックエンドの`GET /activities`をフロントエンドから呼び出し、実際に地図上へ自転車ログ（GeoJSON LineString）を表示できることを確認した。
  - サイドバーのレイヤー連携（ON/OFF切り替え、更新API呼び出し）はフェーズ5で実装するため、本フェーズでは暫定的に「地図のスタイルロード時に一度だけ取得し常時表示する」実装とした（コード上に`TODO`コメントで明記）。
  - バックエンドAPIが失敗した場合（Strava認証情報未設定時など）でもアプリ全体がクラッシュしないよう、`console.error`によるログ出力のみで握りつぶす方針とした（ユーザー向けエラー表示は今回のスコープ外）。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `frontend/src/api/activitiesApi.ts`（新規）: バックエンドの`GET /activities`を呼び出す`fetchCyclingActivities`。
    - `frontend/src/utils/cyclingActivityToGeoJson.ts`（新規）: アクティビティ配列をGeoJSON `FeatureCollection<LineString>`に変換する純粋関数（`path`が`null`のアクティビティは除外）。
    - `frontend/src/constants/bicycleLog.ts`（新規）: 自転車ログレイヤーのソース/レイヤーID・線の色・太さを定数化。
    - `frontend/src/components/MapView.tsx`を変更し、スタイルロード時に自転車ログのGeoJSONソース・ラインレイヤーを追加するようにした（暫定実装）。
    - `frontend/package.json`に`@types/geojson`を追加。
    - `pnpm run dev:backend`・`pnpm run dev:renderer`を実際に起動し、ブラウザ（Playwright経由）でアプリが正常に描画されること、バックエンドAPI失敗時もクラッシュしないことを確認済み。
  * **README.md**: 変更なし。
  * **仕様書**: 変更なし。

### [2026-07-07] 自転車ログ表示機能フェーズ2: Strava APIをラップしたバックエンドAPIを実装した
* **修正の動機・概要**:
  - フェーズ1で構築したStrava疎通機能を使い、フロントエンドが呼び出せるラッパーAPI（`GET /activities`）を実装した。この時点ではDBを介さずStrava APIへ毎回パススルーする。
  - Stravaの`summary_polyline`（エンコード済み文字列）は地図描画にそのまま使えないため、`@mapbox/polyline`でデコードし`[lng, lat]`順（GeoJSON座標順）に変換して返すこととした。
  - Electronレンダラーや将来の環境差異に備え、開発時点ではCORSを全オリジン許可とした（本番向けの絞り込みは将来の課題）。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `backend/src/activities/`を新規作成: `activities.constants.ts`, `types/cycling-activity.dto.ts`, `cycling-activity.util.ts`（polylineデコード・DTO変換）, `activities.service.ts`, `activities.controller.ts`（`GET /activities`）, `activities.module.ts`。
    - `backend/src/app.module.ts`を`ActivitiesModule`をimportするよう変更（`StravaModule`は`ActivitiesModule`経由での間接importに整理）。
    - `backend/src/main.ts`に`app.enableCors()`を追加。
    - `backend/package.json`に`@mapbox/polyline`（依存）・`@types/mapbox__polyline`（開発依存）を追加。
    - 実際に`nest build`でビルドし起動、`curl http://localhost:3000/activities`でルーティング・DI疎通を確認済み（実Strava認証情報が無い開発環境のため、レスポンス自体は500エラーになることを確認。認証情報未設定時の想定通りの挙動）。
  * **README.md**: 変更なし。
  * **仕様書**: 変更なし。

### [2026-07-07] 自転車ログ表示機能フェーズ1: バックエンド側からStrava APIを呼び出せるようにした
* **修正の動機・概要**:
  - `specs/system_specification.md`に追記された「自転車ログ表示機能」の実装を、ユーザー指定の順序（バックエンドのStrava疎通→ラッパーAPI→フロントエンド表示→DB化→レイヤー化）に従って開始した。本コミットはその第1段階。
  - Strava初回認可（OAuth同意フロー）は対象外とし、`backend/.env`に`STRAVA_CLIENT_ID`/`STRAVA_CLIENT_SECRET`/`STRAVA_REFRESH_TOKEN`を手動設定する前提とした（ユーザーと合意済み）。`refresh_token`は失効しないため、これを使い都度`access_token`をリフレッシュする方式にした。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `backend/src/strava/`を新規作成: `strava.constants.ts`（API URL・トークン失効バッファ等）、`types/strava-activity.type.ts`（Stravaレスポンス型）、`strava-auth.service.ts`（リフレッシュトークンによるアクセストークン取得・メモリキャッシュ）、`strava-activity.util.ts`（`Ride`/`VirtualRide`判定）、`strava-activities.service.ts`（`GET /athlete/activities`呼び出し）、`strava.module.ts`。
    - `backend/src/app.module.ts`に`ConfigModule.forRoot({ isGlobal: true })`と`StravaModule`を追加。
    - `backend/package.json`に`@nestjs/config`, `@nestjs/axios`, `axios`を追加。
    - `backend/.env.example`を新規作成（実際の`.env`はGit管理対象外）。
  * **README.md**: 開発環境セットアップ（`.env.example`のコピーとStrava認証情報の設定手順）を追記。
  * **仕様書**: 変更なし（ユーザーが先行して記載した仕様に実装を追従させたため）。

### [2026-07-07] バックエンド（NestJS）の雛形を構築した
* **修正の動機・概要**:
  - Strava連携（自転車ログ表示機能）などバックエンドを要する機能を今後実装するにあたり、`specs/system_specification.md`で定義済みのNestJSバックエンドが未着手（`backend/`ディレクトリ自体が存在しない）だったため、まず雛形を構築した。
  - スコープはユーザーとの確認の結果、最小構成（NestJS起動＋ヘルスチェックのみ）とした。PostgreSQL/PostGIS接続・ORM選定・Electronメインプロセスからの起動連携は、実際にDBを使う機能を実装するタイミングで決定することとし、今回は対象外とした。
  - 本プロジェクトはNestJS既定のJestではなくvitestを全体で採用しているが、vitestの既定トランスフォーム（esbuild、およびvitest v4で既定化されたOxc）は`emitDecoratorMetadata`をサポートせずNestJSのDIが壊れるため、`unplugin-swc`（`@swc/core`）を使い`oxc: false`で明示的にOxcを無効化する構成を採用した。
  - NestJSのコンストラクタインジェクションで使うクラスをBiomeの`lint/style/useImportType`が「型としてのみ使用」と誤検知し`import type`への変換を提案する（適用するとDIが壊れる）ことが分かったため、`rules.md`に注意書きを追加した。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `backend/`を新規作成（`package.json`, `nest-cli.json`, `tsconfig.json`, `vitest.config.ts`, `src/main.ts`, `src/app.module.ts`, `src/app.controller.ts`, `src/app.service.ts`, `src/__tests__/`）。`GET /health`が`{"status":"ok"}`を返すことを実機起動・`curl`で確認済み。
    - `pnpm-workspace.yaml`に`backend`を追加（あわせて`@swc/core`のpostinstallビルドスクリプトを許可）。
    - ルートの`package.json`に`dev:backend`/`build:backend`スクリプトを追加し、`test:unit`・`typecheck`・`lint-staged`にbackend分を追記。
    - `biome.json`の`files.includes`に`backend/src/**`を追加。
  * **README.md**: 該当なし（現時点で機能一覧の記載自体が存在しないため）。
  * **仕様書**: 変更なし（既存の技術スタック定義に沿った実装のため）。
  * **その他**: `commit_rules.md`・`test_rules.md`のバックエンドTODOを実際のコマンド・テスト方針に置き換え、DB/ORM選定は「実装時に決定する」項目として明示的に先送りした。`rules.md`にBiomeの`useImportType`誤検知に関する注意書きを追加。

### [2026-07-07] レイヤ一覧表示・レイヤ切り替え機能を実装し、仕様書との乖離を解消した
* **修正の動機・概要**:
  - ユーザーが`specs/system_specification.md`に「レイヤ一覧表示機能」「レイヤ切り替え機能」（左サイドバーでのレイヤON/OFF、OSMのPOI/道路/建物/地名の個別切り替え、航空写真レイヤー）を先行して追記したため、実装をこれに追従させた。
  - 航空写真タイルソースはユーザーとの確認の結果、国土地理院（GSI）のシームレス航空写真タイル（APIキー不要・無償）を採用した。「その他ユーザーが追加したレイヤ」は追加UI・データ形式が仕様上未定義のため、YAGNIの観点から今回のスコープ外とし、将来Issue化することとした。
  - OSMベクタタイル（OpenFreeMap `liberty`スタイル、OpenMapTilesスキーマ）のレイヤーをPOI/道路/建物/地名にハードコードIDで分類すると100個近いレイヤーIDを列挙する必要があるため、`type`/`source-layer`から動的に分類する方式（`frontend/src/utils/mapLayerCategory.ts`）を採用し、上流スタイルの微修正にも耐性を持たせた。
  - 実装中に、Chakra UIの`Switch`（Ark UI/zag-js）は`onCheckedChange`の発火が非同期であること、`biome.json`の`useConsistentTypeDefinitions`ルールが`rules.md`の「型定義にはtypeを使用する」規約と矛盾しデフォルトで`interface`を強制していたことが判明したため、それぞれ`test_rules.md`・`biome.json`を修正した。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `frontend/src/types/layer.ts`, `constants/layerDefinitions.ts`, `constants/aerialPhoto.ts`, `utils/mapLayerCategory.ts`, `hooks/useLayerVisibility.ts`, `components/LayerSidebar.tsx`, `components/MapWorkspace.tsx`, `theme.ts` を新規追加。
    - `components/MapView.tsx`を変更し、`layerVisibility` propに応じてOSMベクタレイヤーの表示・非表示および国土地理院航空写真レイヤーの追加・切り替えを行うようにした。
    - `App.tsx`を`MapView`直描画から`MapWorkspace`描画に変更。
    - `biome.json`の`useConsistentTypeDefinitions`に`{"style": "type"}`オプションを追加し、`rules.md`の規約と一致させた。
  * **README.md**: 該当なし（現時点で機能一覧の記載自体が存在しないため）。
  * **仕様書**: 変更なし（本対応はユーザーが先行して追記した仕様書に実装を追従させたもの）。
  * **その他**: `test_rules.md`にChakraの`Switch`のクリックテストでは`await waitFor(...)`が必要である旨の知見を追記。

### [2026-07-07] 地図描画ライブラリをMapBox(mapbox-gl-js)からMapLibre GL JSに変更し、Electronディレクトリを仕様書に追加した
* **修正の動機・概要**:
  - 地図表示機能の雛形構築にあたり、mapbox-gl-jsはv2以降BSLライセンスとなりMapBoxのAPIキー・アカウントが必要になる点をユーザーに確認した。OSMベクタタイルの描画自体にMapBoxアカウントは不要だが、ライセンス制約を避けるため、mapbox-gl-jsからフォークされたオープンソース実装であるMapLibre GL JSを採用することで合意した。
  - あわせて、Electronのメインプロセス・プリロードスクリプトの配置先が仕様書のディレクトリ構造（backend/frontendのみ）に存在しないことに気づいた。Electronは「共通基盤」（frontend/backendいずれにも属さない）と位置付けたため、ディレクトリ構造にも`electron/`を追加した。
* **各ファイルへの影響と変更内容**:
  * **実装**: 未着手（本コミット時点ではディレクトリ・雛形構築前のため、仕様書のみの修正）。
  * **README.md**: 該当なし。
  * **仕様書**: `specs/system_specification.md`のフロントエンド技術スタックの地図描画欄を「MapBox（mapbox-gl-js）」から「MapLibre GL JS（mapbox-gl-jsからフォークされたオープンソース実装。APIキー不要でベクタタイルを描画できる）」に修正。ディレクトリ構造に`root/electron`を追加。
