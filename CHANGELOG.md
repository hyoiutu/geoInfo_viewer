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

### [2026-07-14] PR #22のレビュー対応として選択・フォーカス中のアクティビティがフィルタで除外された際に選択・フォーカスを解除するようにした
* **修正の動機・概要**:
  - PR #22のレビューで、フィルタにより選択中・フォーカス中のアクティビティが地図上から除外された場合でも選択・フォーカス状態自体は保持される、という当初の設計判断について「選択やフォーカスを解除するようにしてください」との指摘を受けた。
  - `useActivitySelection`に`pruneToVisible(visibleIds)`を追加し、フィルタ適用後に地図へ表示されているアクティビティID集合を渡すことで、その集合に含まれなくなった選択中IDを取り除き、フォーカス中のIDが取り除かれた場合はフォーカスも解除するようにした。フォーカスは`selectedIds`内のインデックスで管理しているため、除外後も残ったIDに対して正しいインデックスへ再計算している。
  - `MapWorkspace`側で`filterActivities`を使いフィルタ適用後の表示対象ID集合を求め、それが変化するたびに`pruneToVisible`を呼ぶ`useEffect`を追加した。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `frontend/src/hooks/useActivitySelection.ts`: `pruneToVisible`を追加。
    - `frontend/src/components/MapWorkspace.tsx`: フィルタ適用後の表示対象ID集合を`useMemo`で求め、変化のたびに`pruneToVisible`を呼ぶ`useEffect`を追加。
    - 単体テスト（フロントエンド169件）・lint・typecheck・E2Eテスト4件は全てGreen。
  * **README.md**: 変更なし。
  * **仕様書**: `specs/system_specification.md`の「自転車ログフィルタリング機能」節で、フィルタが選択・フォーカスの状態に影響しないと記載していた箇所を、除外時に選択・フォーカスを解除する旨に修正(実装の当初設計と仕様書の記載が一致していなかったための訂正)。

### [2026-07-14] PR #22のレビュー対応として平均時速の算出ロジックを共通化した
* **修正の動機・概要**:
  - PR #22のレビューで、`filterActivities.ts`と`activityDetailView.ts`にそれぞれ独立して実装していた平均時速(km/h)の算出ロジック(走行距離÷走行時間、ゼロ除算時は0)について「共通化してください」との指摘を受けた。算出方法(numberを返すところまで)が完全に同一のため、表示用フォーマットとフィルタ用の数値計算で責務が異なるという当初の判断を見直した。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `frontend/src/utils/averageSpeed.ts`(新規): `calculateAverageSpeedKmh`を切り出し。
    - `frontend/src/utils/filterActivities.ts`・`frontend/src/utils/activityDetailView.ts`: 独自実装をやめ、共通の`calculateAverageSpeedKmh`を使うよう変更。
    - 単体テスト(フロントエンド169件)・lint・typecheckは全てGreen。
  * **README.md**: 変更なし。
  * **仕様書**: 変更なし(内部実装のリファクタリングであり機能仕様に影響しないため)。

### [2026-07-14] PR #21のレビュー対応として通過自治体一覧の並び順を通過順に修正した
* **修正の動機・概要**:
  - PR #21のレビューで、右サイドバーに表示する通過自治体一覧の順番が仕様書に記入漏れであり、実際には「通過した順（同じ市町村を複数回通過した場合は最初に通過した順）」にすべきという指摘を受けた。
  - 実装（`MunicipalitiesService.findPassedMunicipalities`）は元々`ORDER BY 都道府県名, 市区町村名`（五十音順）でソートしており、仕様として意図されていた通過順にはなっていなかった。
  - PostGISの`ST_DumpPoints`が返す`path`（サンプリング点のジオメトリ内での並び順）を用いて、自治体ごとに最初に通過した時点の`path`値で`DISTINCT ON`し、その値で最終的に並べ替えることで通過順を実現した。実際の開発DB（実データ）に対してクエリを実行し、五十音順ではなく実際のルート順（隣接する自治体が地理的に連続する順）で返ることを確認した。
* **各ファイルへの影響と変更内容**:
  * **実装**: `backend/src/municipalities/municipalities.service.ts`の`findPassedMunicipalities`のSQLを、`DISTINCT`+`ORDER BY`都道府県名・市区町村名から、`DISTINCT ON`+サンプリング点の`path`順への並び替えに変更。
  * **README.md**: 変更なし。
  * **仕様書**: `specs/system_specification.md`の「通過自治体表示機能」節に、一覧の並び順（通過順、重複時は最初の通過順）を明記。

### [2026-07-13] GitHub Issue #19として自転車ログフィルタリング機能を実装した
* **修正の動機・概要**:
  - 地図上に表示する自転車ログを、走行開始年月の範囲・獲得標高・平均時速・走行距離で絞り込みたいという依頼（Issue #19）。自律モードで対応した。
  - Issueの要求仕様（年のみ入力時の月補完、片側のみ入力時のもう片側の扱い、月のみ入力のバリデーション拒否等）を1つの純粋関数`filterActivities`とその前段のバリデーション関数`isActivityFilterValid`に落とし込み、TDDで細部の境界値（月末日を含むか、走行時間0のゼロ除算等）を検証した。
  - ダイアログの入力状態（未確定のdraft）と実際に地図へ適用される状態（applied）を分離管理するフック`useActivityFilter`を新設し、「実行を押したときのみ確定し、閉じるボタンでは破棄され、再度開いたときは直近の適用内容を復元する」というIssueの要求を満たした。
  - `MapView`の自転車ログ描画を、これまで「取得したアクティビティをそのままGeoJSONへ変換して表示」していたところから、「取得したアクティビティにフィルタを適用してから表示」するよう変更した。選択用・フォーカス用レイヤーも同じフィルタ済みアクティビティ一覧を参照するようにし、フィルタで除外されたアクティビティは選択・フォーカス状態であっても地図上には描画されないようにした。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `frontend/src/types/activityFilter.ts`（新規）: `ActivityFilter`型と`DEFAULT_ACTIVITY_FILTER`。
    - `frontend/src/utils/filterActivities.ts`（新規）: `filterActivities`・`isActivityFilterValid`。
    - `frontend/src/hooks/useActivityFilter.ts`（新規）: ダイアログの開閉・入力中(draft)/適用中(applied)のフィルタ状態を管理するフック。
    - `frontend/src/components/FilterDialog.tsx`（新規）: 年月プルダウン・数値入力・リセット/実行/閉じるボタンを持つフィルタダイアログ。
    - `frontend/src/components/LayerSidebar.tsx`: フィルタダイアログを開くボタンを追加。
    - `frontend/src/components/MapView.tsx`: `filter`propsを追加し、自転車ログの通常・選択・フォーカス各レイヤーの描画にフィルタ適用後のアクティビティ一覧を使うよう変更。
    - `frontend/src/components/MapWorkspace.tsx`: `useActivityFilter`・`FilterDialog`を配線。
    - 単体テスト（フロントエンド153件）・lint・typecheck・E2Eテスト4件は全てGreen。
  * **README.md**: 変更なし。
  * **仕様書**: `specs/system_specification.md`に「自転車ログフィルタリング機能」節を新設。

### [2026-07-13] GitHub Issue #18として通過自治体表示機能を実装した
* **修正の動機・概要**:
  - アクティビティ詳細画面に、そのアクティビティが通過した市区町村（都道府県+市区町村）を表示してほしいという依頼（Issue #18）。自律モードで対応した。
  - 全国の市区町村境界データを国土数値情報(N03)ベースのオープンデータ（GeoShapeリポジトリ、TopoJSON形式）からダウンロードし、PostGISの`municipalities`テーブルへ投入する仕組み（`seed-municipalities.ts`）を新設した。全47都道府県で最新の基準日が2023-01-01で統一されていることを実際にHTTPリクエストで確認した上でハードコードした。
  - 逆ジオコーディングは、アクティビティの軌跡をPostGISの`ST_Segmentize`で約100m間隔にサンプリングし、`ST_DumpPoints`で座標点を取り出した上で`ST_Contains`により自治体ポリゴンとの空間結合を行う方式で実装した。実際に開発DB（実データ・実境界データ）に対してクエリを実行し、東京駅が「東京都千代田区」、横浜駅付近が「神奈川県横浜市神奈川区」と正しく判定されること、実際のアクティビティの軌跡から神奈川県内の複数市町村が正しく得られることを確認した。
  - 海外を通過した区間の除外は、市区町村データが日本国内のみのため「一致する自治体が無い＝除外される」という形で自然に実現され、追加の判定ロジックは不要だった。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `backend/src/municipalities/`（新規）: `entities/municipality.entity.ts`（Entity）・`municipalities.service.ts`（逆ジオコーディングサービス）・`municipalities.module.ts`・`seed-municipalities.ts`（データ投入スクリプト）。
    - `backend/src/migrations/1720700000000-CreateMunicipalities.ts`（新規）: `municipalities`テーブルとGiSTインデックスを作成するマイグレーション。実DBに適用し、47都道府県分（1917件）のデータ投入・空間検索の動作を確認済み。
    - `backend/src/database/database.config.ts`: `MunicipalityEntity`をTypeORMへ登録。
    - `backend/src/activities/activities.controller.ts`・`activities.module.ts`・`activities.constants.ts`: `GET /activities/:id/municipalities`エンドポイントを追加。
    - `backend/package.json`: `topojson-client`・`@types/topojson-client`・`@types/topojson-specification`を追加、`seed:municipalities`スクリプトを追加。
    - `frontend/src/api/activitiesApi.ts`: `fetchPassedMunicipalities`を追加。
    - `frontend/src/hooks/usePassedMunicipalities.ts`（新規）: アクティビティIDが変わるたびに通過自治体を取得するフック。
    - `frontend/src/components/ActivityDetailSidebar.tsx`: フォーカス中のアクティビティ詳細に通過自治体一覧（取得中/0件/一覧の3状態）を表示する`PassedMunicipalitiesList`を追加。
    - 単体テスト（バックエンド91件・フロントエンド123件）・lint・typecheck・E2Eテスト4件は全てGreen。
  * **README.md**: 「通過自治体データの投入（初回のみ）」節を新設し、`pnpm --filter backend run seed:municipalities`の実行方法とデータ出典を記載。
  * **仕様書**: `specs/system_specification.md`に「通過自治体表示機能」節を新設し、逆ジオコーディングの方式（データ出典・サンプリング間隔・空間検索方法・海外除外の扱い）を記載。「アクティビティ詳細閲覧機能」の詳細画面の表示項目にも通過自治体一覧を追記。

### [2026-07-13] GitHub Issue #17としてfinish-reviewスキルを新設した
* **修正の動機・概要**:
  - スタック構成（あるPRが別の未マージPRから分岐している状態）で複数PRを順にレビューしていると、祖先PRがマージされるたびに、それより下流の子孫ブランチ全てでCHANGELOG.mdの競合が発生し、レビューのたびに手動で解消する必要があった（Issue #17）。世代が深いほど繰り返し作業が増えるため、この手順を自動化するスキルの新設が依頼された。
  - Issueに記載されたアイデア（push→PRマージ（要確認）→次にレビューするPRの選定→祖先ブランチの取り込みによる競合解消、という一連の流れ）に基づき`finish-review`スキルを新設した。祖先ブランチの探索は、PRの`base`を`main`に到達するまで遡るが、途中のPRが既にマージ済みであればそのブランチは実質`main`に吸収されているとみなし遡りを打ち切ることで、既にマージされたブランチを無駄に辿らないようにしている。
  - コンフリクト解決の方針（CHANGELOG.mdは時系列順に並べ替えて解決、それ以外の軽微な競合はエージェントが判断、それ以外はユーザーに判断を求める）は、これまでこのプロジェクトで実際に行ってきた手動解決の実績に基づいて明文化した。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `.agents/skills/finish-review/SKILL.md`（新規）: push・PRマージ（要Y/N確認）・次のレビュー対象PRの選定・祖先ブランチの取り込みによる競合解消までを行うスキル定義。
    - `AGENTS.md`: finish-reviewスキルへの参照と、AIによるpush・PRマージが許可される場面としての言及を追加。
    - `branch_rules.md`: 「プッシュの制限」節に、finish-reviewスキルでのpush・PRマージ（要確認）についての言及を追加。
    - スキル定義（ドキュメント）のみの追加であり、アプリケーションコードの変更・単体テスト・E2Eテストの追加は無い（本スキル自体は次回以降の実際のレビュー完了時に使用し検証する）。
  * **README.md**: 変更なし（AIエージェントの内部運用スキルであり、アプリケーションのセットアップ・利用手順には影響しないため）。
  * **仕様書**: 変更なし（アプリの機能仕様ではなく開発プロセスの改善のため）。

### [2026-07-13] PR #16のレビュー対応としてActivityDetailSidebarの子コンポーネントにTSDocを補った
* **修正の動機・概要**:
  - PR #16のレビューで、`ActivityDetailSidebar.tsx`内の子コンポーネント`ActivityList`・`ActivityDetail`のTSDoc情報が不足している（`ActivityDetail`はpropsをリテラルのオブジェクト型のまま、`ActivityList`は親のProps型から`Pick<...>`で直接切り出して使っており、どちらも独立した名前付き`type`として抽出されていなかった）との指摘を受けた。加えて、他に同様の状態のファイルが無いか確認するよう依頼された。
  - `rules.md`の「テスト以外の全ての関数にTSDocを書く」ルールは元々「オブジェクト型の引数は名前付きtypeとして抽出」を求めていたが、1ファイルに複数コンポーネントがある場合の子コンポーネントへの適用が曖昧だったため、明確化した。
  - 他のファイルも確認したが、複数コンポーネントを1ファイルに定義しているのは`ActivityDetailSidebar.tsx`のみで、他に同様の問題は無かった。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `frontend/src/components/ActivityDetailSidebar.tsx`: `ActivityList`・`ActivityDetail`それぞれに`ActivityListProps`・`ActivityDetailProps`という独立した名前付き型を追加し、各プロパティにTSDocを付与。
    - `rules.md`: 「1つのファイルに複数のコンポーネントを定義する場合、exportしない子コンポーネントも本ルールの対象とする」旨を明記。
    - 単体テスト（フロントエンド114件）・lint・typecheckは全てGreen。
  * **README.md**: 変更なし。
  * **仕様書**: 変更なし（コードのドキュメンテーション整備でありアプリの機能仕様には影響しないため）。

### [2026-07-13] PR #16のレビュー対応としてアクティビティ選択・フォーカスの仕様を修正した
* **修正の動機・概要**:
  - PR #16の動作確認で、Issue #15の仕様に記載していなかった5点の修正依頼を受けた。(1) 選択中・フォーカス中のアクティビティが他より手前に描画されるようにする。選択中同士は通し番号の降順（＝最後にクリックしたものが最前面）で描画する。(2) 選択済みの状態で別の箇所をクリックすると、既存の選択を解除して新たな選択に置き換える（累積しない）。(3) フォーカス中は地図クリックによる選択操作を無効化する。(4) 選択数が多くウィンドウ高さを超える場合、右サイドバー内のみスクロールする。
  - (1)について、「通し番号の降順」の具体的な向き（最大番号が最前面か最背面か）が曖昧だったためユーザーに確認し、「最後にクリックした（最大の通し番号）ものが最前面」で合意した。MapLibreの単一line層には描画順を制御する仕組みが無いため、通常・選択・フォーカスの3つを独立したGeoJSONソース・レイヤーに分離し、レイヤーを追加した順（＝描画順）で手前関係を実現する方式に変更した。これに伴い、前回導入したfeature-state（`case`式によるline-color切り替え）は不要になったため削除し、`@maplibre/maplibre-gl-style-spec`への依存も撤去した。
  - (2)は`useActivitySelection.selectActivities`を「既存配列への追加」から「置き換え」に変更するだけで対応できた。(3)によりフォーカス中は選択変更ができなくなるため、(2)の置き換えロジックにフォーカス中の考慮は不要（フォーカス中はそもそもクリックが無視される）。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `frontend/src/constants/bicycleLog.ts`: 選択用・フォーカス用のソースID・レイヤーIDを追加。
    - `frontend/src/components/MapView.tsx`: `addBicycleLogLayer`が3つのソース・レイヤー（通常・選択・フォーカス）を追加するよう変更。feature-state関連のコード（`applyActivitySelectionState`・`promoteId`・`ExpressionSpecification`）を削除し、`applySelectionLayers`（選択用・フォーカス用レイヤーのGeoJSONデータを再構築する関数）に置き換え。クリックハンドラはフォーカス中（`focusedIdRef.current !== null`）の場合は`queryRenderedFeatures`自体を呼ばず早期リターンするよう変更。
    - `frontend/src/hooks/useActivitySelection.ts`: `selectActivities`を`setSelectedIds((current) => [...current, ...ids])`から`setSelectedIds(ids)`（置き換え）に変更。
    - `frontend/src/components/ActivityDetailSidebar.tsx`: ルートの`Box`に`minHeight={0}`・`overflowY="auto"`を追加し、内容がウィンドウ高さを超える場合にサイドバー内でスクロールするよう変更。
    - `frontend/package.json`・`pnpm-lock.yaml`: 不要になった`@maplibre/maplibre-gl-style-spec`を削除。
    - 単体テスト（フロントエンド114件）・lint・typecheck・E2Eテスト4件は全てGreen。
  * **README.md**: 変更なし。
  * **仕様書**: `specs/system_specification.md`の「アクティビティ詳細閲覧機能」に、選択の置き換え仕様・フォーカス中のクリック無効化・描画の手前関係（3レイヤー構成・通し番号降順）・サイドバーの内部スクロールを追記。

### [2026-07-12] PR #16のレビュー対応としてE2Eテストのバックエンドポート衝突を解消した
* **修正の動機・概要**:
  - PR #16のレビューで「E2Eテストをスキップしないでほしい。ポートが占有されないようE2Eテストのポートをずらせないか」との指摘を受けた。PR作成時点では開発用バックエンド（`nest start --watch`、3000番ポート、実Strava接続・実DB）がローカルで常駐していたため、Playwrightの`webServer`（`reuseExistingServer: !process.env.CI`）がこれを「起動済みのE2E用サーバー」として誤って再利用してしまい、E2E向けのモックStrava・E2E専用DBへの向き先設定が一切適用されないままテストが実行され、バックフィルボタンの状態確認に失敗する事故が発生していた。
  - 開発用バックエンドとE2E用バックエンドが同じポート（3000番）を取り合う構造そのものが根本原因のため、E2E用バックエンドを別ポート（3100番）で起動するようにした。バックエンドのポート・フロントエンドの接続先URLをどちらも環境変数で上書き可能にし、`playwright.config.ts`・ルートの`test:e2e`スクリプトからそれぞれ3100番を指定する。
  - 修正後、開発用バックエンド（3000番、実データ629件）を起動したままの状態で`pnpm run test:e2e`を実行し、4件のE2Eシナリオ全てがGreenになること、および開発用バックエンドのデータ・状態に一切影響が無いことを確認した。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `backend/src/main.ts`: `PORT`環境変数があればそれを使うよう変更（未設定時は従来通り3000番）。
    - `frontend/src/api/activitiesApi.ts`・`vite-env.d.ts`: バックエンド接続先を`import.meta.env.VITE_BACKEND_BASE_URL`で上書き可能にした（未設定時は従来通り`http://localhost:3000`）。
    - `playwright.config.ts`: `BACKEND_PORT`を3000→3100に変更し、`webServer`の`env`に`PORT: '3100'`を追加。
    - `package.json`: `test:e2e`スクリプトで`VITE_BACKEND_BASE_URL=http://localhost:3100`を設定した上でビルドするよう変更（Viteの環境変数はビルド時に静的に埋め込まれるため、ビルドより前に設定する必要がある）。
    - E2Eテスト4件・単体テスト（バックエンド87件・フロントエンド112件）・lint・typecheckは全てGreen。
  * **README.md**: 変更なし（`pnpm run test:e2e`の使い方自体は変わらないため）。
  * **仕様書**: 変更なし（テスト基盤の変更でありアプリの機能仕様には影響しないため）。
  * **その他**: `test_rules.md`の「E2Eテスト」節に、ポート衝突の事故の経緯とポート分離の仕組みを追記。

### [2026-07-12] PR #16のレビュー対応としてMapViewのas unknown asキャストを正しい型定義へ置き換えた
* **修正の動機・概要**:
  - PR #16のレビューで、`MapView.tsx`のline-color式に使っていた`as unknown as string`キャストについて「型システムを迂回する強制キャストは絶対禁止。JSON.stringifyなど使えないか」との指摘を受けた。
  - 調査の結果、MapLibreの式(expression)の型`ExpressionSpecification`は`maplibre-gl`自体からは再エクスポートされていないが、その依存先である`@maplibre/maplibre-gl-style-spec`が公開していることが分かった。同パッケージをdevDependenciesに明示的に追加し、`BICYCLE_LOG_LINE_COLOR_EXPRESSION`の型注釈として使うことで、キャストなしで`case`式の配列リテラルが正しく型チェックされることを確認した。
  - 今後同様の「ライブラリの型が期待と合わない」状況で安易にキャストへ逃げないよう、rules.mdに「transitive dependencyが公開する型を探す」「型注釈でコンテキスト型を与える」という具体的な回避手順を追記した。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `frontend/package.json`・`pnpm-lock.yaml`: `@maplibre/maplibre-gl-style-spec`をdevDependenciesに追加。
    - `frontend/src/components/MapView.tsx`: `BICYCLE_LOG_LINE_COLOR_EXPRESSION`に`ExpressionSpecification`型注釈を付け、`as unknown as string`キャストを削除。
    - `rules.md`: 「anyやas（型キャスト）は原則使用しない」節に、`as unknown as T`の強制キャストを例外なく禁止する旨と、キャストに逃げる前に試すべき2つの回避手順を追記。
    - 単体テスト（フロントエンド112件）・lint・typecheckは全てGreen。
  * **README.md**: 変更なし。
  * **仕様書**: 変更なし（型定義の修正であり機能仕様に影響しないため）。

### [2026-07-12] PR #16のレビュー対応として自転車ログ強制再取得ボタンを追加した
* **修正の動機・概要**:
  - PR #16（Issue #15対応）のレビューで、獲得標高・経過時間フィールド追加時に既存629件がデフォルト値0になった問題を解消できるよう、「detail_fetched_atの状態にかかわらず既存全アクティビティを強制的に再取得するボタン」の追加依頼を受けた。
  - `ActivitiesBackfillService`に`startForceRefetch()`を追加。既存全行の`detailFetchedAt`をnullにリセットしてから、初期取り込みと共通の詳細取得ループ（`fetchPendingDetails`）を再実行する。新規アクティビティの検出（Strava一覧の再取得）は目的に含まないため行わない。初期取り込み(`start()`)とはisRunningガード（二重起動防止）を共有し、内部実装も`runExclusively(job)`として共通化した。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `backend/src/activities/activities-backfill.service.ts`: `startForceRefetch()`を追加。`start()`と共通のisRunningガード処理を`runExclusively()`に、詳細取得ループを`fetchPendingDetails()`にそれぞれ抽出。
    - `backend/src/activities/activities.controller.ts`・`activities.constants.ts`: `POST /activities/backfill/force-refetch`エンドポイントを追加。
    - `frontend/src/api/activitiesApi.ts`: `startForceRefetch()`を追加。
    - `frontend/src/hooks/useBackfillStatus.ts`: `startForceRefetch`を追加。開始→進捗再取得の処理を`start`と共通化（`runStartAction`）。
    - `frontend/src/components/LayerSidebar.tsx`・`MapWorkspace.tsx`: 初期取り込みボタンの下に「自転車ログ強制再取得」ボタンを追加。配置・進捗表示・disabled化は既存の初期取り込みボタンと共通の仕組みを使う。
    - 単体テスト（バックエンド87件・フロントエンド112件）・lint・typecheckは全てGreen。
  * **README.md**: 変更なし。
  * **仕様書**: `specs/system_specification.md`の「自転車ログ初期取り込み機能」に、強制再取得ボタンの仕様（全件のdetailFetchedAtリセット、isRunningガード共有）を追記。

### [2026-07-12] GitHub Issue #15としてアクティビティ詳細閲覧機能を実装した
* **修正の動機・概要**:
  - 地図上の自転車ログをクリックして選択し、詳細（走行距離・獲得標高・開始/終了日時・平均時速）を閲覧できるようにしてほしいという依頼（Issue #15）。自律モードで対応し、判断が必要な箇所はコード中に`// 設計判断（要確認）`コメントを残した。
  - 平均時速・走行終了日時の算出、獲得標高の表示には、これまでDBに保存していなかったStravaの`elapsed_time`（経過時間）・`total_elevation_gain`（獲得標高）が必要だったため、データモデル全体（Strava型・Entity・DTO・マッピング処理）に追加した（先行コミット、2026-07-12 `6147e99`）。既存629件は暫定的にデフォルト値0になるため、マイグレーションファイルに設計判断コメントを記載した。
  - フロントエンドは、選択状態・フォーカス状態を管理する`useActivitySelection`フック、表示用に整形する`activityDetailView`ユーティリティ、一覧⇔詳細を切り替える`ActivityDetailSidebar`コンポーネントを新設し、`MapView`にクリックによるヒットテスト・MapLibreのfeature-stateによる線の色分けを実装した。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `backend/src/strava/types/strava-activity.type.ts`・`activities/entities/cycling-activity.entity.ts`・`activities/cycling-activity-entity.util.ts`・`activities/cycling-activity-dto.util.ts`・`activities/types/cycling-activity.dto.ts`: `elapsed_time`/`total_elevation_gain`（Strava側）・`elapsedTimeSeconds`/`elevationGainMeters`（Entity/DTO側）を追加。
    - `backend/src/migrations/1720600000000-AddElevationGainAndElapsedTimeToCyclingActivities.ts`（新規）: 上記2列を`NOT NULL DEFAULT 0`で追加するマイグレーション。実DB（dev docker-compose）に適用し動作確認済み。
    - `frontend/src/hooks/useActivitySelection.ts`（新規）: 選択中ID一覧（クリック順、重複可）とフォーカス中インデックスを管理するフック。
    - `frontend/src/utils/activityDetailView.ts`（新規）: `CyclingActivity`を詳細表示用の整形済み文字列に変換するユーティリティ。
    - `frontend/src/components/ActivityDetailSidebar.tsx`（新規）: 選択中アクティビティの一覧画面・詳細画面を切り替えて表示する右サイドバー。
    - `frontend/src/components/MapView.tsx`: 自転車ログレイヤーのクリックを検出し、クリック地点±5pxのバウンディングボックスでヒットテストして`onSelectActivities`を呼ぶ処理を追加。GeoJSONソースに`promoteId: 'id'`を設定し、`setFeatureState`で選択・フォーカス状態を反映、`line-color`をfeature-state参照の`case`式に変更（通常/選択/フォーカスの3色）。
    - `frontend/src/components/MapWorkspace.tsx`: `useActivitySelection`と`ActivityDetailSidebar`を配線。
    - `frontend/src/constants/bicycleLog.ts`: 単一の`BICYCLE_LOG_LINE_COLOR`（Strava橙 `#fc4c02`）を、状態別の3定数（通常:赤`#e53e3e`・選択:青`#3182ce`・フォーカス:紫`#805ad5`）に置き換え。
    - `electron/tests/fixtures/activities.js`・`electron/tests/support/mock-strava-server.js`: E2E用フィクスチャ・モックサーバーに新規必須フィールド（`elapsed_time`/`total_elevation_gain`）を追加。
    - 単体テスト（バックエンド80件・フロントエンド105件）・lint・typecheckは全てGreen。E2Eテストはローカル環境でポート3000が開発用（実Strava接続の）バックエンドプロセスに占有されておりE2E用バックエンドを起動できず未検証（`app.spec.ts`・`aerial-photo.spec.ts`の2件は影響を受けず実行しGreenを確認）。マージ前にポートが空いた状態での再実行が必要。
    - 地図クリックによる選択・フォーカス・詳細表示フローを検証するE2Eシナリオの追加は今回スコープ外とした（設計判断・要確認、CHANGELOG記載により明示）。
  * **README.md**: 変更なし（アプリの操作手順の詳細は記載しておらず、セットアップ手順に影響が無いため）。
  * **仕様書**: `specs/system_specification.md`に「アクティビティ詳細閲覧機能」節を新設し、クリック選択・ヒットテストの範囲・一覧/詳細画面の切り替え・feature-stateによる色分けの仕様を記載。

### [2026-07-11] PR #13のレビュー対応としてSwaggerレスポンス型のルールを正式化した
* **修正の動機・概要**:
  - PR #13（Issue #7対応）のレビューで3点の指摘・依頼を受けた。(1) `type`→`class`変換について、一時的な例外ではなく「レスポンスに使う型はclassにする」という正式なルールにし、各ファイルの説明コメントは削除してよい。(2) 先祖ブランチ（Issue #4〜#6のレビュー対応等）の変更を取り込んだ後、Swaggerの適用漏れが無いかチェックすること。(3) Swagger UI（APIの一覧）の見方がREADME.mdに書かれていない。
  - (1)は`rules.md`に正式なルールとして追記し、5ファイルにあった説明コメントを削除した。(2)は現在マージ済みの全レスポンス型を再点検した結果、`AppErrorInfo.errorCode`が取りうる値（`STRAVA_AUTH_FAILED`等）にも関わらず`@ApiProperty`に`enum`が指定されていない適用漏れを発見し修正した（`/api-json`のレスポンスで`enum`が正しく出力されることを実機確認）。(3)はREADME.mdにSwagger UI（`/api`）・OpenAPI JSON（`/api-json`）へのアクセス方法を追記した。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `rules.md`: 「型定義には原則typeを使用する」ルールに、HTTPレスポンス型は`class`+`@ApiProperty()`とする例外を正式なルールとして追記。マージ後のSwagger適用漏れ確認の指針も追記。
    - `backend/src/app.service.ts`・`activities/activities-backfill.service.ts`・`activities/activities.service.ts`・`activities/types/cycling-activity.dto.ts`・`common/errors/app-error-info.type.ts`: 「例外としてclassを使う」説明コメントを削除（正式なルールになったため不要）。
    - `backend/src/common/errors/app-error-info.type.ts`: `AppErrorInfo.errorCode`の`@ApiProperty`に`enum: Object.values(APP_ERROR_CODE)`を追加。
    - 単体テスト（バックエンド80件）・lint・typecheckは全てGreen。
  * **README.md**: 「バックエンドAPIの仕様確認（Swagger）」節を新設し、`/api`（Swagger UI）・`/api-json`（OpenAPI JSON）へのアクセス方法を追記。
  * **仕様書**: 変更なし（開発者向けドキュメントツールの調整のため）。

### [2026-07-11] GitHub Issue #8としてE2Eテストを並列実行できるようにした
* **修正の動機・概要**:
  - E2Eテストが常に直列実行（`playwright.config.ts`の`workers: 1`）で、テストケース同士が参照するテーブルが重複しないものについても並列化されておらず、実行時間が長くなっていた（Issue #8）。
  - 4つのE2Eテストファイルのうち、`bicycle-log-backfill.spec.ts`と`bicycle-log-sync.spec.ts`はどちらも`cycling_activities`・`sync_state`テーブルとモックStravaサーバーの状態（`__test__/reset`等）を共有・変更するため、並列実行すると互いのデータを壊し合う。一方`app.spec.ts`・`aerial-photo.spec.ts`はそれらのテーブル・状態に一切触れない。
  - この分析に基づき、テーブル・状態が重複する2ファイルを`bicycle-log.spec.ts`に統合し`test.describe.serial()`で順序を保証、それ以外は別ファイルのまま`workers`を2以上に引き上げることでファイル間の並列実行を有効にした。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `electron/tests/bicycle-log-backfill.spec.ts`・`electron/tests/bicycle-log-sync.spec.ts`を`electron/tests/bicycle-log.spec.ts`へ統合（`test.describe.serial()`で2シナリオを直列実行）。重複していたモックサーバーのreset/seed処理を1箇所にまとめた。スクリーンショットのベースライン画像も新しいファイル名のディレクトリへ移動。
    - `playwright.config.ts`: `workers: 1`（直列固定）を`workers: 2`に変更。
    - E2Eテスト4シナリオ（統合後3ファイル）は実機で全てGreenであることを確認。
  * **README.md**: 変更なし（具体的なテストファイル名や並列設定には言及していないため）。
  * **仕様書**: 変更なし（テスト基盤の変更でありアプリの機能仕様には影響しないため）。
  * **その他**: `test_rules.md`の「テストファイル間の並列実行を許可しない」記述を、「参照するテーブル・状態が重複しないファイルに限って並列実行を許可する」方針に更新し、新規E2Eシナリオ追加時の判断基準（既存のテーブル・モック状態を参照する場合は該当ファイルへ追加）を明記した。

### [2026-07-11] GitHub Issue #7としてSwaggerを導入した
* **修正の動機・概要**:
  - バックエンドにSwaggerを導入し、それぞれのAPIの仕様を確認しやすくしてほしいという依頼（Issue #7）。
  - `@nestjs/swagger`を導入し、`GET /api`でSwagger UIを閲覧できるようにした。各APIのレスポンス形式は、`nest-cli.json`に設定した`@nestjs/swagger`のコンパイラプラグイン（`introspectComments: true`）により、コントローラーメソッド・DTOの型定義とTSDocコメント（Issue #5で追加済み）から自動抽出される。
  - 当初はレスポンスDTO（`CyclingActivityDto`・`SyncResult`・`BackfillStartResult`・`BackfillStatus`・`HealthStatus`・`AppErrorInfo`）を`type`のまま試したが、`@nestjs/swagger`のスキーマ自動抽出は`type`エイリアスからはプロパティ単位の詳細（`{"type": "object"}`のみで中身が空）を取得できないことが実機確認で判明した。rules.mdの「型定義には原則typeを使用する」規約の例外として、これら6つのレスポンスDTOのみ`class`+`@ApiProperty()`デコレータへ変換し、Swaggerが実際に有用なスキーマ（プロパティ・型・説明文）を出力できることを`/api-json`のレスポンスで確認した。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `backend/src/swagger.config.ts`（新規）: `DocumentBuilder`・`SwaggerModule`を使ったSwagger UIセットアップ関数。単体テストも追加。
    - `backend/nest-cli.json`: `@nestjs/swagger`のコンパイラプラグイン（`introspectComments: true`）を設定。
    - `backend/src/main.ts`: `setupSwagger(app)`の呼び出しを追加。
    - `backend/src/activities/activities.controller.ts`・`backend/src/app.controller.ts`: `@ApiTags`でSwagger UI上のグルーピングを追加。
    - `backend/src/activities/types/cycling-activity.dto.ts`・`activities.service.ts`(`SyncResult`)・`activities-backfill.service.ts`(`BackfillStartResult`/`BackfillStatus`)・`app.service.ts`(`HealthStatus`)・`common/errors/app-error-info.type.ts`(`AppErrorInfo`): `type`から`class`+`@ApiProperty()`へ変換（Swaggerのスキーマ自動抽出のための技術的例外。既存の呼び出し元は構造的部分型により無変更で動作）。
    - `backend/package.json`: `@nestjs/swagger`を追加。
    - 単体テスト（バックエンド78件）・lint・typecheckは全てGreen。`backend/src/**`のみの変更のためE2Eテストは対象外（commit_rules.md参照）。
  * **README.md**: 変更なし（Swagger UIの起動方法は`pnpm --filter backend run dev`後に`/api`へアクセスするだけであり、既存の起動手順に追加の前提条件は無いため）。
  * **仕様書**: 変更なし（バックエンドのAPI仕様を可視化する開発者向けツールの追加であり、アプリの機能仕様自体に変更は無いため）。

### [2026-07-11] PR #10のレビュー対応としてエラーダイアログの複数スタック対応・lastError表示修正を行った
* **修正の動機・概要**:
  - PR #10（Issue #4対応）のレビュー中、ユーザーから2つの指摘を受けた。(1) `BackfillStatus.lastError`がDB上には記録されるものの、フロントエンドのどこからも参照されずエラーダイアログに表示されていなかった。(2) 複数のエラーが同時に発生した場合、エラーダイアログの状態が単一の`AppErrorInfo | null`だったため後発のエラーが先発のエラーを上書きしてしまい、また初期取り込みが1回のエラーで停止し再度ボタンを押すと未処理分から再開する設計になっているかどうかが実装から読み取りにくいという指摘があった。
  - (1)は`useBackfillStatus`の`refresh()`が`result.lastError`をチェックしていなかった実装漏れであり、修正した。
  - (2)前半（複数エラーのスタック）は`ErrorDialog`のprops設計を単一エラーから配列（スタック）へ変更し、1つのダイアログ内で「前へ/次へ」により切り替えて閲覧できるようにした。(2)後半（バックフィルの停止・再開）は調査の結果、`runBackfill()`内のfor文がエラーで即座に中断し、再度`start()`を呼ぶとDB上の未取得分のみを対象に再開する設計が既に実装されていたことを確認し、この挙動を明示的に検証するテストを追加してロックした。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `frontend/src/hooks/useBackfillStatus.ts`: `refresh()`が`result.lastError`をチェックし、非nullの場合`onError`を呼び出すよう修正。
    - `frontend/src/components/ErrorDialog.tsx`: props を`error: AppErrorInfo | null`から`errors: AppErrorInfo[]`・`onDismiss: (index: number) => void`へ変更。前へ/次へボタン・件数表示を追加。
    - `frontend/src/components/MapWorkspace.tsx`: エラー状態を`AppErrorInfo[]`の配列で管理し、`onError`は末尾に追加（スタック）、`ErrorDialog`へは配列と`onDismiss`を渡すよう変更。
    - `backend/src/activities/__tests__/activities-backfill.service.tests.ts`: 「詳細API取得中にエラーが発生した場合、それ以降の未取得アクティビティの処理を中断する」「エラー発生後に再度startすると未処理分のみを取得する」の2件を追加（実装変更は無し、既存挙動の確認・ロック）。
    - 単体テスト（バックエンド78件・フロントエンド82件）・lint・typecheck・E2Eテスト4件は全てGreen。
  * **README.md**: 変更なし。
  * **仕様書**: `specs/system_specification.md`の「自転車ログ初期取り込み機能」に、エラー発生時に処理を中断し再開ボタンで未取得分から再開する仕様を追記。「エラーハンドリング機構」に、エラーが複数発生した場合は上書きせずスタックし1つのダイアログ内で切り替えて閲覧できる仕様を追記。

### [2026-07-11] GitHub Issue #6としてコメントを増やした
* **修正の動機・概要**:
  - TSDoc（Issue #5）以外にも、コンポーネントの役割やuseEffectの意図が読み取りにくい箇所があったため、「コンポーネントの1行目に1行程度のコンポーネントの説明」「useEffectの上に1行程度の説明」を追加してほしいという依頼（Issue #6）。
  - コンポーネントの説明は、Issue #5で追加したコンポーネント直上のTSDocコメントが既にこの要件を満たしていたため、重複して別コメントを追加することはせず、rules.mdにその旨（TSDocが兼ねる）を明記した。
  - `useEffect`は全4箇所（`frontend/src/components/MapView.tsx`に2箇所、`frontend/src/hooks/useBackfillStatus.ts`に2箇所）全てに、直前へ`//`による1行程度の説明コメントを追加した。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `frontend/src/components/MapView.tsx`: 地図生成用・レイヤー表示反映用の各`useEffect`にコメントを追加。
    - `frontend/src/hooks/useBackfillStatus.ts`: マウント時取得用・ポーリング用の各`useEffect`にコメントを追加。
    - コメントのみで振る舞いの変更は無い。単体テスト・lint・typecheck・E2Eテストは全てGreenのまま。
  * **README.md**: 変更なし。
  * **仕様書**: 変更なし（コードドキュメント規約の変更のため）。
  * **その他**: `rules.md`に「useEffectの直前に1行程度の説明コメントを書く」規約を新設し、コンポーネントの説明はTSDoc（Issue #5で追加した規約）が兼ねる旨を明記した。

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
