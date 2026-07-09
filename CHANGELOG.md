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
