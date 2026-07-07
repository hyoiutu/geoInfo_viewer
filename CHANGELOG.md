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
