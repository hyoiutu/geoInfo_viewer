# geo_info_viewer 設計書

本ファイルは、[specs/system_specification.md](../specs/system_specification.md)に記載された仕様を実現するための、技術スタック・データモデル・アルゴリズム・処理フロー等の実装上の設計を記載する。ユーザーから見た機能・挙動そのものは仕様書を、用語の定義は[specs/glossary.md](../specs/glossary.md)を参照。

各節は仕様書の「機能」の節と対応させている。

# アーキテクチャ
### 共通基盤
- Electron
  - デスクトップアプリケーションの実行基盤。メインプロセスでNestJSバックエンドを起動し、レンダラープロセスでReactフロントエンドを表示する構成とする

### フロントエンド
- 使用言語: TypeScript
- フレームワーク: React
- UIコンポーネント: ChakraUI
- グローバルステート: Jotai（詳細は「エラーハンドリング機構」参照）
- 地図描画: MapLibre GL JS（mapbox-gl-jsからフォークされたオープンソース実装。APIキー不要でベクタタイルを描画できる）
- テスト: vite + vitest、testinglibrary、playwright、husky、biome
- パッケージマネージャー: pnpm

### バックエンド
- 使用言語: TypeScript
- フレームワーク: NestJS
- DB: PostgreSQL、PostGIS
- テスト: vite + vitest、husky、biome
- パッケージマネージャー: pnpm

## ディレクトリ構造
```
root/
├── electron/            # Electronのメインプロセス・プリロードスクリプト（共通基盤として frontend/backend のどちらにも属さない）
│   ├── main/
│   └── preload/
├── backend/
│   └── src/
├── frontend/
│   └── src/
├── specs/               # 仕様書
├── designs/             # 設計書（本ファイルを含む）
├── README.md
└── ...（その他ドキュメントなど）
```

# 自転車ログ表示機能
- レイヤONのタイミングでStrava APIを呼び出し、前回の切り替えからアクティビティが更新されていないか新規アクティビティ取得を行い、更新されていれば、バックエンドのDBを更新した上でフロントエンドの地図上に自転車ログを表示する（`ActivitiesService.sync()`）
  - Strava のAPIトークンは6時間で失効するため、失効していた場合リフレッシュトークンを使ってAPIトークンを更新する（`StravaAuthService`）
  - フロントエンド側のトリガー検知（自転車ログレイヤーのOFF→ON遷移を監視し、Strava新規アクティビティ取得→DBからの参照取得を行う）は`useCyclingActivities`フック（`frontend/src/hooks/useCyclingActivities.ts`）が担う。`MapWorkspace`がこのフックを1回だけ呼び出し、取得した`activities`をフィルタ計算・`MapView`への表示反映へつなげる。以前は`MapView`内のuseEffectに「表示反映」と「データ取得トリガー」という異なる関心事が同居していたが、Issue #58でデータ取得側を切り出した
- アクティビティの取得には詳細API（`GET /activities/{id}`、1ログにつき1リクエスト）を使い、常に高解像度の軌跡（`path`）を取得する。一覧APIが返す簡略化された軌跡（低解像度）は、通常表示には使用しない
- 取得した軌跡（`path`）は、隣接する2点間の距離が10km以上離れている箇所（トンネル内・フェリー乗船中等の測定不能区間）で複数の区間に分割して保持する
  - 距離の算出はHaversine公式（大圏距離）を用いる（`splitPathAtJumps`、`backend/src/activities/split-path-at-jumps.util.ts`）
  - 分割した結果2点未満（線を描画できない孤立した1点）になった区間は除外する
  - DBの`path`列は単一の線（PostGIS `geometry(LineString,4326)`）ではなく、複数の線をまとめて持てる`geometry(MultiLineString,4326)`として保持する（マイグレーション`1720800000000-ChangeCyclingActivitiesPathToMultiLineString`）
  - この分割は詳細API呼び出し時（`toCyclingActivityEntityFromDetail`）に行われるため、バックフィル・フォースリフェッチ・新規アクティビティ取得のいずれも、対象アクティビティの詳細取得を行うタイミングで共通して適用される
  - フロントエンドの`path`型は区間ごとの座標配列の配列（`[number, number][][]`）であり、地図描画は`MultiLineString`ジオメトリとして行う（`cyclingActivityToGeoJson`）

## 低ズームレベルでの軽量表示（Issue #61）
- ズームレベル10以下では、データ量の多い高解像度の軌跡（`path`）ではなく、Strava詳細APIレスポンスの`summary_polyline`をデコードした簡略化された軌跡（`summaryPath`列、マイグレーション`1785347504217-AddSummaryPathToCyclingActivities`）を表示する。`summaryPath`も`path`と同じ区間分割ロジック（位置飛び10km以上）を適用してから保持する（`toCyclingActivityEntityFromDetail`）
  - `path`が`polyline`優先・`summary_polyline`はGPSルートの無い手動記録等での代替という位置づけなのに対し、`summaryPath`は常に`summary_polyline`から独立してデコードする（`polyline`の有無に関わらず`summary_polyline`が存在すれば設定する）
- 地図描画は`path`用（`BICYCLE_LOG_SOURCE_ID`等3ソース）とは別に、summary専用の1ソース・1レイヤー（`BICYCLE_LOG_SUMMARY_SOURCE_ID`/`BICYCLE_LOG_SUMMARY_LAYER_ID`、`addBicycleLogLayer`）を持つ。低ズームでは選択・フォーカス状態の概念自体を提供しないため、通常・選択・フォーカス用のような複数状態は不要で1種類のみで足りる
  - 表示切り替えはMapLibreの宣言的な`minzoom`/`maxzoom`（既存の行政区画レイヤー等と同じ方式）で行う。`BICYCLE_LOG_SUMMARY_MAX_ZOOM`(10)を境に、summaryレイヤーは`maxzoom`、`path`用の3レイヤーは`minzoom`として同じ値を使う。MapLibreの仕様上「maxzoom以上で非表示」となるため、ズームレベルちょうど10の瞬間のみ高解像度側が優先されるが、連続的に変化するズーム操作の中では実用上体感できる差ではない
- ズームレベルが`BICYCLE_LOG_SUMMARY_MAX_ZOOM`以下の場合、`registerBicycleLogClickHandler`はヒットテスト自体を行わずクリックによる選択・フォーカスを無効にする（フォーカス中の早期returnと同じ箇所に`map.getZoom() <= BICYCLE_LOG_SUMMARY_MAX_ZOOM`の判定を追加）

# 自転車ログフィルタリング機能
- 仕様書記載のフィルタ条件（年月・獲得標高・平均時速・走行距離）はフロントエンドの純粋関数`filterActivities`・バリデーション関数`isActivityFilterValid`（`frontend/src/utils/filterActivities.ts`）で実現する
- ダイアログの入力中（draft）状態は`FilterDialog`コンポーネント自身が内部stateとして保持し、実際に地図へ適用される状態（`MapWorkspace`が保持する`filter`）とは分離する。ダイアログを開くたびに入力中の内容を現在適用中の内容へリセットし（`isOpen`の変化を検知する`useEffect`）、「実行」を押したときのみ`onApply(draftFilter)`で確定値を通知する（Issue #53。以前は`useActivityFilter`フックが`MapWorkspace`側でこのdraft管理を担っていたが、ダイアログ自身の内部関心事として`FilterDialog`へ移した）
- フィルタで除外され地図上に表示されなくなったアクティビティの選択・フォーカス解除は、`useActivitySelection(activities, filter)`が内部で完結させる。フックが`filter`を直接受け取り表示対象ID集合を`useMemo`で求め、変化のたびに内部の`useEffect`で選択・フォーカスから取り除く（`MapWorkspace`側からの明示的な呼び出しは不要。PR #69レビュー対応）
- `filterActivities`の呼び出し（フィルタ計算そのもの）は`MapWorkspace`側で1回だけ行い、結果（`filteredActivities`）を`MapView`へpropsで渡す。以前は`MapView`（`filteredActivities`算出用）と`MapWorkspace`（`visibleIds`算出用）の双方が独立して`filterActivities`を呼んでいたが、Issue #58で一本化し、`MapView`は受け取った`filteredActivities`をそのまま地図描画・選択レイヤー反映・スタートゴールマーカーの算出に使うだけになった

# 自転車ログバックフィル機能
- Stravaのレート制限は「非アップロード系エンドポイント: 15分あたり100リクエスト」を採用し、リクエスト間隔を9秒（15分 ÷ 100 = 9秒、`StravaRateLimiterService`）に固定してペーシングする
- 実行中フラグ（`ActivitiesBackfillService`の`running`）はインメモリ管理とする（DBには永続化しない）。バックエンドが再起動した場合はフラグがリセットされ、ユーザーが再度ボタンを押すことでDB上の未取得分から再開する
- 一覧取得は1ページあたりの最大件数でページングし、空のページが返るまで取得を繰り返すことで全件を取得する
- GPSルートの無い（手動記録等の）アクティビティを「未取得」と誤判定しないよう、詳細取得が完了した時刻（`detailFetchedAt`）を保持する列を設け、この列の有無で取得済みかどうかを判別する（軌跡データ自体の有無では判別しない）
- 進捗フッター（`BackfillProgressFooter`）の表示トリガーは、`backfillStatus.isRunning`の**観測**ではなく、開始操作そのもの（`useBackfillProgressFooter`が公開する`show()`を、`MapWorkspace`の開始ボタンのクリックハンドラで`startBackfill`/`startForceRefetch`呼び出しと同期的に呼ぶ）とする。対象件数が極端に少ない・レート制限間隔が極小の環境（E2E等）では、開始操作から最初の状態取得（`useBackfillStatus`の`refresh`）までの間に処理が完了してしまい、`isRunning: true`の状態を一度もフロントエンドが観測できないことがある。以前は`isRunning: true`への変化を検知して初めてフッターを表示する設計だったため、このケースでフッター自体が最後まで表示されない不具合があった（E2Eテスト`bicycle-log.spec.ts`で断続的に再現、Issue #86。既知の根本原因は判明済みで対症療法的なタイムアウト延長では解消しないことも確認済み）

# アクティビティ詳細閲覧機能
- 自転車ログの線は太さ3pxと細く正確なクリックが難しいため、クリック地点を中心とした10px四方（片側5px）のバウンディングボックス内に描画されているアクティビティをヒットテストで検出する（`registerBicycleLogClickHandler`、`frontend/src/utils/mapLayerInteraction.ts`）
- 選択中・フォーカス中のアクティビティの描画は、通常・選択用・フォーカス用の3つの独立したGeoJSONソース・レイヤーを用意し、追加した順（＝描画順）で「通常 < 選択中 < フォーカス中」の手前関係を実現する（`applySelectionLayers`）
- `registerBicycleLogClickHandler`・`applySelectionLayers`・`applyStartGoalMarkers`（スタート・ゴールマーカー算出）・`applyLayerVisibility`（レイヤー可視性反映）は、いずれも`maplibregl.Map`インスタンスを直接操作する地図操作の純粋関数（Reactの状態やJSXを持たない）であるため、`MapView.tsx`（コンポーネント本体）から`mapLayerInteraction.ts`（`addAerialPhotoLayer`等のレイヤー追加処理を持つ`mapLayerSetup.ts`と対になる、地図の状態反映を担う受け皿）へ切り出した。`MapView.tsx`にはReactのライフサイクル（`useEffect`での呼び出しタイミング制御）との接続のみを残す（PR #71レビュー対応）
- スタート・ゴールマーカーは`lucide-react`のアイコン（スタート: `Play`、ゴール: `Flag`）を`react-dom/server`の`renderToStaticMarkup`で静的にレンダリングし、`maplibregl.Marker`のDOM要素として表示する（`createStartMarkerElement`/`createGoalMarkerElement`）
  - 開始地点と終了地点が同じ座標の場合に手前へ描画されるよう、ゴールのマーカーを先に、スタートのマーカーを後に地図へ追加する（MapLibreの`Marker`はDOM要素として描画されるため、後から追加した方がDOM上で後に来ることを利用している）

# 走行距離表示機能（マウスオーバー、Issue #77）
- フォーカス中の線上のマウス位置から、始点（走行開始地点）までの軌跡に沿った距離を求める処理は、クリック検出と同じ理由（線が細く正確なホバーが難しい）でカーソル位置を中心としたバウンディングボックスでヒットテストした上で、実際の距離計算は取得済みの`focusedActivity.path`（既にフロントエンドが保持しているデータ）に対して行う（`registerFocusedActivityHoverHandler`、`frontend/src/utils/mapLayerInteraction.ts`）
- 「軌跡上でカーソルに最も近い点」は、区間（2点間の線分）ごとにベクトル射影で最近点を求め、全区間中で最小のもの（Haversine距離で比較）を採用する。経度・緯度をそのまま平面座標とみなす近似計算であり、正確な測地線上の最近点計算は行わない（ホバー表示の精度としては十分なため。`findDistanceAlongPathAtPoint`、`frontend/src/utils/findDistanceAlongPathAtPoint.ts`）
  - 2点間の距離算出（Haversine公式）は、バックエンドの`splitPathAtJumps`（`backend/src/activities/split-path-at-jumps.util.ts`）と同じ計算式だが、フロントエンド・バックエンド間でコードを共有する仕組みがこのプロジェクトに無いため個別に持つ
- 始点からの累積距離は、区間グループ（位置飛びで分割済み、[自転車ログ表示機能](#自転車ログ表示機能)参照）内の区間を順に積算して求める。区間グループ間（位置飛びの箇所）の距離は実際には走行していない区間のため累積距離に含めない
- 吹き出し表示は`maplibregl.Popup`（`closeButton: false`、`closeOnClick: false`、`anchor: 'bottom'`でカーソル上部に表示）を1つだけ使い回し、ホバー地点ごとに`setLngLat`/`setText`で内容を更新する。線から外れると`Popup.remove()`で非表示にする
- スタート・ゴールマーカーとは異なり、この吹き出しはReact管理下の状態（props）と紐付かない純粋にイベント駆動のUIのため、`MapView`内で直接（`useRef`で保持する`maplibregl.Popup`インスタンス1つを介して）管理する。地図操作としての「カーソル位置からの検出」ロジックのみを`registerFocusedActivityHoverHandler`として`mapLayerInteraction.ts`へ切り出している

# 通過自治体表示機能
- 全国の市区町村境界データ（[政府統計の総合窓口(e-Stat)地図で見る統計(統計GIS)提供の市区町村界データ、GeoShapeリポジトリ、高解像度版、政令指定都市統合版ではない方](https://geoshape.ex.nii.ac.jp/city/choropleth/)）をバックエンドのDB（`municipalities`テーブル、PostGIS）へ投入しておく（`pnpm --filter backend run seed:municipalities`、詳細はREADME.md参照）
  - `municipalities`テーブルは`era`列（年代識別子。現行データは`'current'`、過去データはGeoShapeの基準日をそのまま文字列で保持。例:`'2000-10-01'`）を持ち、複数年代分のデータを同じテーブルに格納する（Issue #34）。現行データは`'20230101'`（国土数値情報(N03)の最新基準日）、`2000-10-01`は`'20001001'`（平成の大合併前）をそれぞれGeoShapeのtopojson基準日として使う。`scripts/seed-municipalities.ts`（`backend/src/municipalities/era.constants.ts`の`MUNICIPALITY_ERAS`で定義された年代分）が、年代ごとに既存行のみを洗い替えて投入する
  - 政令指定都市の区は、国土数値情報(N03)のプロパティ`N03_003`（市名）+`N03_004`（区名）を連結し「市名+区名」（例: 横浜市中区）として保持する
- 逆ジオコーディングは、アクティビティの軌跡（GPSトラック）をPostGISの`ST_Segmentize`で約100m間隔にサンプリングし、`ST_DumpPoints`で座標点を取り出した上で`ST_Contains`により自治体ポリゴンとの空間結合を行う方式で実装する（`MunicipalitiesService.findPassedMunicipalities`）。全てのGPSポイントに対して逆ジオコーディングすると負荷が高いため間隔を空けてサンプリングする
  - 判定対象の年代は引数`era`で受け取り（`GET /activities/:id/municipalities?era=...`、省略時は`'current'`）、SQLの`JOIN`条件に`m.era = $3`を追加して絞り込む
- 一覧の並び順は、`ST_DumpPoints`が返すサンプリング点の`path`（軌跡上の並び順）を用いて、自治体ごとに最初に通過した時点の`path`値で`DISTINCT ON`し、その値順に並べ替えることで実現する
  - `path`は`integer[]`型で、`cycling_activities.path`列が`MultiLineString`（10km以上のジャンプ区間で分割済み、[自転車ログ表示機能](#自転車ログ表示機能)参照）のため`[区間インデックス, 区間内の点インデックス]`という2要素になる。ソートキーには**配列全体**（PostgreSQLの配列型は要素ごとの辞書式順序で比較される）を使う必要があり、`path[1]`（区間インデックスのみ）を使うと、大半のアクティビティのように区間が1つしか無い場合は全サンプリング点が同じ値になり実質的にソートが機能しない不具合があった（Issue #57で修正）
- 海外を通過した区間の除外は、明示的な国内/海外判定ロジックを追加せず、「`municipalities`テーブルが日本国内のデータのみを保持しているため、海外の区間のサンプリング点はどの自治体にも`ST_Contains`で一致せず、結果として自動的に除外される」という間接的な方式で実現している

# 行政区画レイヤー（年代選択）
- 現行（`era === 'current'`）の行政区画は、既存のOSMベクトルタイル（`boundary_3`＝都道府県境界＋新規追加の市町村境界レイヤー、`place`ソースレイヤーの都道府県名・市町村名ラベル）をそのまま可視性トグルの対象とする（Issue #34フェーズ1）
- 過去の行政区画（`era !== 'current'`）はベクトルタイルに存在しないため、`GET /municipalities/boundaries?era=...`（`MunicipalitiesController.getBoundaries`、新規）がDBの`municipalities`テーブルから該当年代のポリゴンをGeoJSON `FeatureCollection`として返す。フロントエンドはこれをMapLibreのGeoJSONソース（`admin-boundary-historical-source`）へ`setData`し、塗り（`fill`、視認性を優先し不透明度0.05の薄い塗り）・線（`line`、現行の市町村境界と同じ配色・破線パターン）・ラベル（`symbol`、`municipalityName`プロパティをテキストフィールドとし既存OSM地名ラベルと同じ配色）の3レイヤーとして描画する（`addAdminBoundaryHistoricalLayer`/`applyAdminBoundaryData`、`frontend/src/utils/mapLayerSetup.ts`。`applyAdminBoundaryData`は元々`applyAdminBoundaryHistoricalData`という名前だったが、Issue #76対応でcurrentも含めた全年代のhit-test用データ取得を担うようになったため改名した）
  - 塗り・線・ラベルの3レイヤーいずれにも、現行の市町村境界（`admin-boundary-municipality`）と同じ`ADMIN_BOUNDARY_MUNICIPALITY_MIN_ZOOM`（`minzoom`）を設定し、低ズームでの過密表示・不要な計算を避ける（PR #62レビュー対応。実機確認でズームアウトしても行政区画の計算が継続する点が指摘された）
- 取得したGeoJSONは年代ごとに`MapView`内の`Map<MunicipalityEra, FeatureCollection>`（`historicalBoundariesCacheRef`）へキャッシュし、同じ年代へ再度切り替えた際の再取得を避ける
- `resolveStyleLayerIds`（`frontend/src/utils/mapLayerCategory.ts`）はadmin-boundaryレイヤーがONのとき選択中の年代（現行/過去）に対応するレイヤー群のみを返す設計だが、これだけでは「選択されていない方の年代のレイヤー群」を非表示にする処理が無く、年代を切り替えると直前に表示していた方のレイヤーが残ってしまう不具合があった（Issue #67）。`resolveUnusedAdminBoundaryLayerIds`（同ファイル、選択中の年代の逆側のレイヤーID一覧を返す）を追加し、`applyLayerVisibility`（`frontend/src/utils/mapLayerInteraction.ts`）が行政区画レイヤーのON/OFFに関わらず常にこれらを非表示にすることで解消した
- レイヤーダイアログの年代選択（プルダウン）は、レイヤーの表示/非表示と同じ`LayerDialog`内部のdraft state（`draftEra`）が管理し、同じ「実行」ボタンのタイミングで確定する（年代選択のためだけの別ダイアログ・別コンポーネントを設けていない）
- 選択中の年代は`MapWorkspace`から`MapView`（描画用）・`ActivityDetailSidebar`（通過自治体の判定用、`usePassedMunicipalities`経由）の両方へ`adminBoundaryEra`として渡される
- 2026-07時点で投入済みの年代は`current`（2023-01-01）・`2000-10-01`（平成の大合併前）・`1950-10-01`（昭和の大合併前）・`1920-01-01`（大正時代）の4つで、Issue #34が要望する全年代の投入が完了している

# レイヤーダイアログの非同期実行対応（Issue #65）
- レイヤーダイアログ（`LayerDialog`）で「実行」を押した際、行政区画の年代変更（`applyAdminBoundaryData`、Promiseベースで完了を検知可能）・自転車ログレイヤーのOFF→ON（`useCyclingActivities`の同期処理）のいずれかが発生する場合、それらの完了までダイアログを閉じずマウスカーソルをローディング状態（`cursor: wait`）にする。MapLibreのタイル読み込み自体（`idle`イベント）は対象に含めない（ユーザー確認済み、issue-reviewでの事前レビュー時点の懸念）
- 対象の2つの非同期処理は元々「状態の変化に反応するuseEffect」として実装されており、実行ボタンのクリックから直接Promiseを返す形にはなっていない。完了検知は以下のコールバックを新設して実現する。
  - `MapView`に`onAdminBoundaryDataApplied?: () => void`を追加し、`applyAdminBoundaryData`が成功・失敗いずれの場合も`.finally()`で呼ぶ（エラー時に呼ばないとダイアログが閉じなくなるため）。コールバックは他のprops同様`useRef`で保持し、effectの依存配列に含めない（`onSelectActivities`等と同じ、不要な再実行を避ける対策）
  - `useCyclingActivities`に第2引数`onSyncComplete?: () => void`を追加し、OFF→ON時の同期処理（`syncAndLoadBicycleLog`）が完了した時点（成功・失敗問わず`finally`）で呼ぶ
- `MapWorkspace`が`{ waitingForAdminBoundary: boolean; waitingForCyclingLog: boolean } | null`型の`pendingLayerApply`状態を持つ。`handleApplyLayerSettings`（実行ボタン押下時にMapControls経由で呼ばれるコールバック）は、渡された次の表示状態・年代を**現在適用中の値と比較**し、実際に変化するかどうかをこの時点で同期的に判定して`pendingLayerApply`へ記録する。この判定を「非同期処理が開始されたことを検知してから」ではなく「クリックの時点で」行うのは、非同期処理が実際に開始される（`useEffect`が発火する）のは1レンダーサイクル後であり、開始前に完了判定を行ってしまう競合を避けるため
- `isApplyingLayerSettings`（`pendingLayerApply`のいずれかの待機フラグがtrueかどうか）を`MapView`・`MapControls`へpropsとして渡す。`MapControls`はこれがtrue→falseに変化した時点（`useRef`で前回値を保持し比較）でダイアログを閉じる。「実行」時点で非同期処理が不要と判定した場合（`appliedEra`/`appliedVisibility`との比較で変化なし）は、この仕組みを介さず即座に閉じる（既存の挙動を維持）
- カーソルのローディング表示は`MapWorkspace`の最外殻`Flex`に`cursor={isApplyingLayerSettings ? 'wait' : undefined}`を設定して実現する。このプロジェクトにローディングカーソルの既存パターンは無かったため、新規に導入した

# 行政区画フォーカス機能（Issue #76）
- 「地図上の行政区画クリック」「通過自治体一覧の項目クリック」いずれからも同じ行政区画をフォーカス表示できるようにするため、クリックした地点から自治体を特定する経路として、OSMベクトルタイルの`place`ラベル（現行の行政区画表示に使っている）ではなく、`municipalities`テーブル由来のGeoJSON（`GET /municipalities/boundaries?era=...`、通過自治体表示機能・過去年代表示機能が既に使っているものと同一のAPI）を採用した
  - 理由: OSMベクトルタイルの`boundary`ソースレイヤー（境界ポリゴン）自体は名前プロパティを持たず、名前は別レイヤー（`place`、地点ラベル）にしか無いため、クリック地点から直接「どの自治体か」を機械的に特定できない。また`place`ラベルの表記（例: 政令指定都市の区の扱い）が`municipalities`テーブル（`PassedMunicipality`が使うものと同一）の`prefectureName`/`municipalityName`と一致する保証が無く、通過自治体一覧の項目とのマッチングに使うには不整合が起きうる。`municipalities`テーブルのGeoJSONを両方の入口で共通の検索対象にすることで、この不整合を避けている
- 地図クリックでの自治体特定は、`municipalities`テーブルのGeoJSONを参照する不可視（`fill-opacity: 0`）のfillレイヤー（hit-testレイヤー、`admin-boundary-hittest-fill`、ソース`admin-boundary-hittest-source`）を追加し、MapLibreの`map.on('click', レイヤーID, handler)`にクリック地点のfeature検出を委ねる方式にした（`registerAdminBoundaryClickHandler`、`frontend/src/utils/mapLayerInteraction.ts`）。GeoJSONベースのfillレイヤーはMapLibreが内部でクリック地点のポイントインポリゴン判定を行うため、フロントエンド側で別途ジオメトリライブラリ（turf等）を導入する必要が無い
  - hit-test用のGeoJSONは、currentも含む全年代について`applyAdminBoundaryData`が取得・キャッシュする（`historicalBoundariesCacheRef`を流用）。ただし現行(`current`)の可視表示は従来通りベクトルタイル（`admin-boundary-municipality`等）が担うため、hit-test用ソースへの反映のみ行い、過去年代用の可視表示ソース（`admin-boundary-historical-source`）へは反映しない
- フォーカス表示は、フォーカス中の自治体1件分のfeatureのみを保持する専用のGeoJSONソース・ラインレイヤー（`admin-boundary-focused-source`/`admin-boundary-focused-line`、オレンジ`#dd6b20`・太さ4px・粗い破線）として追加した。自転車ログのフォーカス色（赤`#e53e3e`）・ゴールマーカー（赤系）と意味が異なるため、別の色相（オレンジ）を割り当てている
- フォーカス対象（都道府県名+市区町村名）から実際のfeature（ジオメトリ）を求める処理は`applyFocusedMunicipalityLayer`（`frontend/src/utils/mapLayerInteraction.ts`）が担い、hit-test用にキャッシュ済みのFeatureCollectionを`prefectureName`/`municipalityName`で線形探索する
- 状態管理は既存の選択・フォーカス機構（`useActivitySelection`）とは独立させ、`MapWorkspace`が`focusedMunicipality: PassedMunicipality | null`を単純な`useState`で保持する。フォーカス中のアクティビティが変わる・行政区画の年代が切り替わるタイミングでの解除は、`useEffect`ではなく該当する操作（`focusActivity`/`clearFocus`/`handleApplyLayerSettings`）を呼ぶハンドラ内で直接`setFocusedMunicipality(null)`する方式にした（`useEffect`だと依存配列に含めた`focusedActivity`/`era`をエフェクト本体で参照しないためBiomeの`useExhaustiveDependencies`に抵触するため）
- hit-test・フォーカス表示の2レイヤーは、`resolveStyleLayerIds`の`admin-boundary`カテゴリ（現行・過去いずれの分岐にも）に含め、行政区画レイヤーのON/OFFトグルに連動して表示/非表示が切り替わるようにした
- **パフォーマンス対策（動作確認時の指摘を受けて修正）**: 当初、「境界データ(hit-test用含む)の取得・反映」と「フォーカス対象の反映」を1つの`useEffect`（依存配列に`focusedMunicipality`を含む）にまとめていたため、フォーカス対象が変わる（＝クリックする）たびに`applyAdminBoundaryData`が呼ばれ、変化していないはずの全国分の境界データを毎回hit-test用・表示用ソースへ`setData`し直しており、クリックのたびに顕著な遅延・カクつきが発生していた。`MapView.tsx`のeffectを「境界データの取得・反映（`adminBoundaryEra`のみに依存）」と「フォーカス対象の反映（`focusedMunicipality`に依存）」の2つへ分割し、後者はキャッシュ済みデータの取得のみを行い表示・hit-test用ソースへは`setData`しない専用の経路（`getOrFetchMunicipalityBoundaries`、`frontend/src/utils/mapLayerSetup.ts`。`applyAdminBoundaryData`もこれを内部で使うよう変更）を新設することで解消した
- **地図の中心合わせ**: フォーカス対象のfeatureが見つかった場合、そのジオメトリ（Polygon/MultiPolygon）の重心へ`map.panTo`（ズームレベルは変更しない）で地図の中心を合わせる（`panToMunicipalityCentroid`、`frontend/src/utils/mapLayerInteraction.ts`）。重心の算出はシューレース公式による面積重み付き重心（`calculatePolygonCentroid`、`frontend/src/utils/polygonCentroid.ts`）で、穴（内側のリング）は無視し外側のリングのみで計算する簡略版。既存のIssue #77（線上の距離算出）と同様、緯度経度をそのまま平面座標とみなす近似計算とし、新規ジオメトリライブラリ（turf等）への依存は追加していない
- **自転車ログとのクリック競合の解消（Issue #96）**: `registerBicycleLogClickHandler`（自転車ログのクリック検出、`map.on('click', handler)`・レイヤー指定なしの汎用リスナー）と`registerAdminBoundaryClickHandler`（行政区画hit-testのクリック検出、`map.on('click', レイヤーID, handler)`・レイヤー指定リスナー）は互いに独立して同じ`click`イベントに登録されているため、自転車ログの線の真上にある行政区画をクリックすると両方のハンドラが発火し、アクティビティが選択されると同時に行政区画へも意図せずフォーカス・パンしてしまう不具合があった。MapLibre自体にはレイヤー間の描画順に基づくクリックの伝播制御（他ライブラリの`stopPropagation`相当）が無いため、`registerAdminBoundaryClickHandler`側に「このクリックで自転車ログのアクティビティが選択されるかどうか」を判定するガード（`willSelectBicycleLogActivity`、内部で`registerBicycleLogClickHandler`と同じヒットテスト・フォーカス中判定・ズームレベル判定を共有する`queryBicycleLogActivityIds`を使う）を追加し、該当する場合は行政区画側の処理を行わないようにした。フォーカス中（自転車ログの選択操作自体が無効な状態）や低ズーム時（summary表示、Issue #61）は、自転車ログ側の選択が発生しないため、この場合は行政区画のクリックが通常通り機能する

# エラーハンドリング機構
## バックエンド
- 全エンドポイントは、エラー発生時のレスポンスボディを`{ errorCode, message, hint }`形式（`AppErrorInfo`）に統一する
  - `errorCode`: `STRAVA_AUTH_FAILED`（Strava認証失敗）・`STRAVA_RATE_LIMITED`（Strava APIレート制限）・`STRAVA_API_ERROR`（その他のStrava API通信エラー）・`INTERNAL_ERROR`（DBエラー等、上記以外の予期しないエラー）の4種類
- 上記の統一形式は、NestJSのグローバル例外フィルタ`AllExceptionsFilter`によって実現する。個別のエンドポイント・サービスは意図的に投げる例外を`AppException`として扱い、フィルタがこれをそのままレスポンスボディとして返す。それ以外の予期しない例外は`INTERNAL_ERROR`として整形して返す
- Strava API呼び出し（`StravaAuthService`・`StravaActivitiesService`）は、axiosのエラーレスポンスのHTTPステータス（401→認証失敗、429→レート制限、それ以外→通信エラー）に応じて、変換関数`toStravaApiException`（`common/errors/strava-api.exception.ts`）で`AppException`へ変換して投げる。`toStravaApiException`は独立した例外クラスではなく、axiosエラーを判定して適切な`AppException`インスタンスを組み立てる純粋関数である。console.logでの記録や、エラーを握りつぶしてfalsyな値を返す実装は行わない
- `POST /activities/sync`は、バックフィル実行中のガード（既に実行中のため新規アクティビティ取得をスキップした場合）に限り`{ success: false }`をエラーではない200レスポンスとして返す。それ以外の失敗（Strava APIエラー等）は例外として投げ、上記のエラーレスポンス形式で返す
- バックフィルは非同期のfire-and-forget処理であるため、実行中に発生したエラーはHTTPレスポンスとしては返せない。代わりに直近のエラーを`lastError`としてサービス内に保持し、`GET /activities/backfill/status`のレスポンスに含めることで、ポーリングしているフロントエンドが参照できるようにする。新たに`start()`が呼ばれた時点で`lastError`はリセットされる

## フロントエンド
- APIレスポンスが異常な場合、レスポンスボディを`AppErrorInfo`としてパースし、`ApiError`（`errorCode`/`hint`を保持する`Error`のサブクラス）としてthrowする
- エラー状態はJotaiの`errorsAtom`（グローバルステート）でアプリ全体から共有される配列（スタック）として一元管理する。API呼び出し等でエラーが発生しうる箇所（`MapView`・`useBackfillStatus`・`usePassedMunicipalities`）は、`useErrorReporter`フックを直接呼び出してエラーを追加する（`onError`のようなpropsのバケツリレーを行わない。詳細はIssue #28・[class_diagram.md](./class_diagram.md)参照）
- `ErrorDialog`（Chakra UIの`Dialog`コンポーネントを使用）は`errorsAtom`を直接参照・更新し、`message`と`hint`を表示する
  - 複数のエラーが発生した場合、後から発生したエラーが先発のエラーを上書きすることはない（`errorsAtom`は配列末尾に追加するのみ）。1つのダイアログ内で「前へ/次へ」ボタンによりスタックされた各エラーを切り替えて閲覧でき、件数が2件以上の場合はタイトルに現在の位置を表示する。「OK」ボタンは現在表示中のエラーのみを`errorsAtom`から取り除く

# 統計データ表示機能
- 既存のダイアログ群（`LayerDialog`・`FilterDialog`・`SettingsDialog`）と同様、共通ラッパー`AppDialog`（`frontend/src/components/AppDialog.tsx`）に委譲する形で`StatisticsDialog`を実装する。開閉状態はJotai atomではなく、他ダイアログと同じく`MapWorkspace`のローカルstate（`isStatisticsDialogOpen`）で管理する
- 集計対象は、`MapView`がバックエンドから取得した全アクティビティ一覧（`MapWorkspace`の`activities`state。フィルタ適用前）であり、地図上の表示フィルタ（`appliedFilter`）は適用しない。仕様書の「全アクティビティ数」「全アクティビティの総走行距離数」がフィルタに関わらず不変の集計値であるため
- 集計・整形処理は純粋関数`toActivityStatisticsView`（`frontend/src/utils/activityStatistics.ts`）が担う。`toActivityDetailView`（アクティビティ詳細表示、`activityDetailView.ts`）と同じ「メートル→km変換・小数第1位フォーマット」のパターンを踏襲し、`distanceMeters`の合計を`reduce`で算出する
- `MapControls`に4つ目のアイコンボタン（`lucide-react`の`ChartColumn`、aria-label「統計データ」）を追加する。既存のレイヤー・フィルタ・設定アイコンと同じ`IconButton`（`borderRadius="full" shadow="md"`）のスタイルを踏襲する

# 位置情報付きメディア表示機能（写真データ取り込み基盤）
Issue #23「写真閲覧機能」の実現方式として、Google Photos APIの直接連携ではなくGoogle Takeout（増分エクスポート）＋Google Drive経由の取り込み方式を採用した（詳細な調査経緯・GCP設定はIssue #23のコメント参照）。以下は、Google Drive上のTakeoutエクスポート（zip）から写真のメタデータをバックエンドのDBへ取り込むパイプラインの設計である。写真閲覧機能そのもののうちサイドバーのグリッド表示・地図上の吹き出し表示はいずれも実装済み（後述）。

- 取り込みは`POST /photos/ingest`（`PhotosController`、リクエストボディ`{ fileId: string }`）で、ユーザーがブラウザ上のGoogle Picker UIで選択したTakeout zipのGoogle Drive上のfileIdをトリガーとして受け取る想定（Picker UI自体は未実装。現時点ではfileIdを直接指定して動作確認する）
- 当初は「マスターデータ（Takeout zip）はDriveに置いたまま、表示時に必要になった写真だけをローカルへ遅延キャッシュする」設計方針だったが、実データ検証により1つのTakeout zip（最大2GB）に14年分の写真が撮影時期を問わず分散して含まれることが判明し、この方式では1回の表示のために複数の巨大zipをダウンロードする必要が生じ非現実的と判断した。そのため、取り込み時にTakeout zipの写真を撮影年月ごとに再構成した別zip（月別アーカイブ）へ振り分けてGoogle Drive上に保存し直す方式へ変更した（Issue #23）。取り込みと月別再構成は1つのパイプライン（`PhotoIngestService.ingest`）内で行う
- `PhotoIngestService`が以下の順でオーケストレーションを行う（`backend/src/photos/`）
  1. `GoogleDriveAuthService`/`GoogleDriveApiClient`（`backend/src/google-drive/`、Issue #23で実装済み）でアクセストークンを取得し、指定fileIdのTakeout zip本体をダウンロードする
  2. `extractTakeoutArchive`（`takeout-archive.util.ts`）が、`adm-zip`でzipをメモリ上に展開し、拡張子`.json`のJSONサイドカーとそれ以外の写真本体エントリへ分類する
  3. `matchPhotosWithJsonSidecars`（`takeout-photo-matcher.util.ts`）が、各写真本体に対応するJSONサイドカーを紐付ける。Google Takeoutのファイル名対応の罠（サイドカーのファイル名が46文字制限で`.supplemental-metadata`部分が`.supple`等へ不規則に切り詰められる、拡張子有無の不一致等）に対応するため、単純な完全一致ではなく「写真パスとJSON側（`.json`拡張子を除いたベース名）のどちらか一方が他方の前方一致になっているか」で判定し、複数候補があれば最も長く一致するものを選ぶ緩やかなマッチングを行う。対応するJSONが見つからない場合は`json: null`を返す
  4. `extractMetadataFromJson`/`extractMetadataFromExif`（`takeout-metadata.util.ts`）が、JSONサイドカー優先・見つからない（またはJSONの中身が不正・`photoTakenTime`欠落）場合は写真本体のEXIF直読み（`exifr`ライブラリ）へフォールバックし、撮影日時（`takenAt`）・位置情報（`location`、GeoJSON Point）を抽出する。Google Takeoutの位置情報無し写真は`latitude`/`longitude`が両方`0.0`になる仕様のため、その場合は`location: null`として扱う。撮影日時が取得できない写真はこの時点でスキップし、`skippedCount`としてレスポンスに含める
  5. `groupPhotosByYearMonth`（`group-photos-by-year-month.util.ts`）が、撮影日時が取得できた写真を`takenAt`（UTC基準）の年月（`YYYY-MM`）ごとにグループ分けする
  6. `MonthlyPhotoArchiveService.reorganize`が、年月グループごとに以下を行う
     - `monthly_photo_archives`テーブルを年月で検索し、対応する月別アーカイブが既存か確認する
     - 既存の場合は`GoogleDriveApiClient.downloadFile`でその月別アーカイブzipをダウンロードし、無ければ新規（未作成）として扱う
     - `mergeMonthlyArchive`（`monthly-archive.util.ts`）が、ダウンロードした（または空の）zipへ当該年月の新規写真を追記する。zip内の配置はTakeout側のディレクトリ構造を捨てファイル名（basename）のみを使い、異なる元zip由来で同名ファイルが衝突する場合は拡張子の直前へ連番（`-2`, `-3`, ...）を付けて回避する。追加するエントリはSTORED（無圧縮）とする。`adm-zip`の既定であるDEFLATE圧縮は写真・動画（既に圧縮済みの形式でサイズ削減効果がほぼ無い）に対してもCPUバウンドな圧縮処理を行うため、GB規模になりうる月別アーカイブでは圧縮自体が実行時間を大きく圧迫することが写真ローカルバックフィルの実行時に判明したため（Issue #23）
     - 既存アーカイブが無い場合は`GoogleDriveApiClient.createFileMetadata`で新規zipファイルを作成し、`monthly_photo_archives`テーブルへ`year_month`・`drive_file_id`の対応を保存する。既存・新規いずれの場合も`GoogleDriveApiClient.updateFileContent`でzip本体をアップロードする
       - `updateFileContent`はGoogle Drive APIの「レジューマブルアップロード」方式（`uploadType=resumable`）を使う。当初は「シンプルアップロード」（`uploadType=media`）だったが、Google Drive APIはこの方式を数MB程度までしか信頼できる動作を保証しておらず、実際に月別アーカイブzip（写真・動画を含む場合は数十MB〜になりうる）のアップロードでエラーが発生した（写真ローカルバックフィルの実行時に発覚、Issue #23）。レジューマブル方式は、セッション開始リクエストでレスポンスの`Location`ヘッダーからアップロード先セッションURLを取得し、そのURLへ実際のバイナリ本体をアップロードする2段階で行う
         - セッション開始リクエストは、Google公式ドキュメントの推奨に従いボディを空のJSON（`Content-Type: application/json; charset=UTF-8`）とし、`X-Upload-Content-Type`（アップロードするバイナリのMIMEタイプ）・`X-Upload-Content-Length`（バイト数）を明示する
         - 実バイナリの送信は`UPLOAD_CHUNK_SIZE_BYTES`（16MiB）ごとに分割し、`Content-Range`ヘッダーで全体のうちどの範囲かを明示しながら順にPUTする。当初は1回の大きなPUTで送信していたが、実際に約4GB規模の月別アーカイブzipでTLSの書き込みエラー（`EPROTO`）が発生したため、チャンク分割へ変更した。中間チャンクのレスポンスはHTTPステータス308（Resume Incomplete、「このチャンクは受理したので続きを送ってほしい」というGoogle Drive API独自の意味）を返すため、axiosの`validateStatus`で308も正常応答として扱うようにし、308をリダイレクトとして追従してしまわないよう`maxRedirects: 0`も指定している。チャンク単位の失敗時再送（同じチャンクだけを再試行する）は実装しておらず、失敗した場合は月単位で最初から再試行する
         - なお、`toGoogleDriveApiException`はHTTPステータスから種別を判別できない場合、元のエラー詳細を握りつぶしていたため原因調査が困難だった。この調査を機に、種別を判別できない場合に限り元のエラー詳細を`console.error`で出力するよう変更した（`google-drive-api.exception.ts`）
         - `GoogleDriveApiClient`の全リクエスト（メタデータ取得・ダウンロード・セッション開始・チャンクアップロード・トークンリフレッシュ）に`timeout`を設定している。axiosは`timeout`を指定しない限り応答を無限に待ち続けエラーにもならないため、ネットワーク接続がスタックした場合にプロセスが無音のまま進行しなくなりうる。メタデータ等の軽量リクエストは30秒、既存アーカイブの（非チャンク）ダウンロードは5分、アップロードチャンク（16MiB）1回あたりは2分をそれぞれ上限とする（保険的な対策。実際に写真ローカルバックフィルの実行が無音のまま停止する事象の直接の原因は、後述する月別アーカイブのメモリ使用量過多によるプロセス強制終了であると判明した）
  7. 振り分け結果（各写真の月別アーカイブ上の`drive_file_id`・エントリパス）をもとに`PhotoEntity`を組み立て、`photos`テーブルへ保存する
- `photos`テーブル（`backend/src/photos/entities/photo.entity.ts`、マイグレーション`1784369772129-CreatePhotos`）は、写真の実バイナリ自体は保存せず、`file_name`・`taken_at`・`location`（`geometry(Point, 4326)`、PostGIS）・`source_file_id`・`archive_path`のみを保持する。月別再構成後は`source_file_id`は元のTakeout zipではなく振り分け先の月別アーカイブzipのGoogle Drive fileIdを指し、`archive_path`はその月別アーカイブ内でのエントリパスを指す。実際に表示時に必要になった写真は、`source_file_id`が示す月別アーカイブ（元のTakeout zipより粒度が細かく、対象期間の写真のみを含む）を再ダウンロードして`archive_path`のエントリを取り出すことで遅延取得する想定
- `monthly_photo_archives`テーブル（`backend/src/photos/entities/monthly-photo-archive.entity.ts`、マイグレーション`1784388784983-CreateMonthlyPhotoArchives`）は、撮影年月（`year_month`、`YYYY-MM`形式・一意制約あり）ごとに、対応する月別アーカイブzipのGoogle Drive fileId（`drive_file_id`）を保持する。取り込みパイプラインが、ある年月の写真を追記する際に既存アーカイブへ追記すべきか新規作成すべきかを判定するために参照する
- 「アクティビティの開始・終了日時で写真を検索する」（Issue本文）は、`GET /activities/:id/photos`（`ActivitiesController.getPhotos`、`PhotosService.findByActivity`）で実現する。指定したアクティビティIDから`cycling_activities`テーブルの`start_date`・`elapsed_time_seconds`（開始日時+経過時間＝終了日時）を求め、`photos`テーブルの`taken_at`がその範囲内（TypeORMの`Between`）にある写真を撮影日時昇順で返す。対象アクティビティが存在しない場合は空配列を返す
  - 位置情報を持たない写真（`location: null`）もそのまま含めて返す。Issue本文が要望する「位置情報が無い写真をアクティビティの軌跡と照合して位置を推定する」機能は、現状`cycling_activities.path`が各点の通過時刻を持たない（Strava詳細APIの軌跡データを使用しており、時刻付きストリームデータは未取得）ため実現できず、今回のスコープからは意図的に除外した。実現する場合はStrava「ストリーム」APIから時刻付き軌跡を別途取得する対応が必要になる（未着手）
  - `PhotosService`は`PhotosModule`が`CyclingActivityEntity`を読み取り専用で参照できるよう`TypeOrmModule.forFeature`へ追加登録し、`ActivitiesModule`が`PhotosModule`をimportして`PhotosService`を`ActivitiesController`へ注入する構成とした（`MunicipalitiesService`と同じ「参照専用サービスをコントローラーへ直接注入する」パターン）
  - 写真の実バイナリ自体は返さない（`file_name`・`taken_at`・`location`のみを含む`PhotoDto`）。プレビュー表示に必要な実バイナリは、後述の`GET /photos/:id/image`で別途遅延取得する
- 写真バイナリの遅延取得は`GET /photos/:id/image`（`PhotosController.getImage`、`PhotosService.findImageByPhotoId`）で実現する。対象写真の`source_file_id`（月別アーカイブzipのGoogle Drive fileId）をダウンロードし、`adm-zip`で`archive_path`のエントリを取り出してレスポンスする（NestJSの`StreamableFile`、Content-Typeは`file_name`の拡張子から`resolveImageContentType`で解決する`image-content-type.util.ts`）。写真・エントリのいずれかが見つからない場合は404を返す
  - 月別アーカイブzipのダウンロード結果は`PhotosService`インスタンス内のメモリ（`Map<sourceFileId, Buffer>`、挿入順を利用した簡易LRU、上限5件）へキャッシュする。1つのアクティビティに紐づく写真は撮影年月が近接することが多く、写真ごとに同じ月別アーカイブを再ダウンロードすると無駄が大きいため（Issue #80のパフォーマンス対応時の教訓を踏まえ、実装時点から対策した）

# 位置情報付きメディア表示機能（サイドバーのグリッド表示、Issue #23）
- フロントエンドの取得は`usePhotos`フック（`frontend/src/hooks/usePhotos.ts`、`fetchPhotos`＝`GET /activities/:id/photos`）が担い、`usePassedMunicipalities`と同じ「activityIdが変わるたびに再取得し、アンマウント/依存値変化時にキャンセルフラグで古い結果の上書きを防ぐ」パターンを踏襲する
- 表示は`ActivityDetailSidebar.tsx`の`PhotoGrid`コンポーネント（`ActivityDetail`内、通過自治体一覧の下に配置）が担う。ChakraUIに写真ギャラリー専用のコンポーネントは無いため、`SimpleGrid`（3列）+`Image`の組み合わせで実現する
  - 正方形プレビュー・はみ出た部分の均等カットは、`Image`に`aspectRatio="1"`・`objectFit="cover"`を指定するのみで実現している（`object-fit: cover`は中央基準で両端を均等にクロップするCSS標準の挙動のため、独自のクロップ処理は実装していない）
  - 各`Image`の`src`は`resolvePhotoImageUrl`（`frontend/src/api/photosApi.ts`）が返す`GET /photos/:id/image`のURLをそのまま指定する。画像はバイナリで返るためJSON用の`fetch`ラッパーは持たず、ブラウザの`<img>`に直接URLを渡して読み込ませる
  - `usePhotos`の`isLoading`（「写真を取得中...」表示の切り替え）は、メタデータ取得（`GET /activities/:id/photos`、撮影日時等のみを返す軽量なDBクエリ）の完了のみを表し、写真の実バイナリ取得（`GET /photos/:id/image`、月別アーカイブzipのダウンロードを伴いうる重い処理）の完了は含まない。当初この2つを区別していなかったため、メタデータ取得完了時点で「取得中...」表示が消えるにもかかわらず、実際に写真が表示されるまでには（月別アーカイブzipが未キャッシュの場合、Google Driveからのダウンロードを伴い）数十秒かかることがあり、ユーザーから「表示準備ができる前にローディング表示が消える」という指摘を受けて改善した（Issue #23フォローアップ）
  - 改善後は、メタデータ取得完了後ただちに写真の枚数分の`PhotoGridItem`（新規、`ActivityDetailSidebar.tsx`）を表示する。各`PhotoGridItem`は`isImageLoaded`（`useState`）で自身の画像の読み込み完了を個別に管理し、未完了の間は`Image`を`visibility="hidden"`にしつつファイル名＋`Spinner`（ChakraUI）を重ねて表示、`Image`の`onLoad`（`onError`時も同様に扱い、読み込み失敗時にスピナーが表示され続けることを防ぐ）で読み込み済みへ切り替える。全件の読み込み完了を待たず、写真ごとに読み込めたものから順に表示される
- 地図上の吹き出し表示（位置情報をもとにした表示、Issue本文の要望）は本対応の対象外としたが、Issue #107で実装済み（後述「地図上の写真吹き出し表示（Issue #107）」参照）

## 写真ローカルフラット化ツール
Google Takeoutで一括ダウンロードした写真をローカルへ展開すると、アルバム単位・年月単位等でディレクトリが細かくネストされた状態になる。既存写真の一括取り込み（写真ローカルバックフィル、別途対応）は入力としてサブディレクトリの無い1つのフラットなディレクトリを前提とするため、ネストされた展開データをフラット化する前処理ツール`backend/src/photos/flatten-local-photo-directory.ts`（`pnpm --filter backend run flatten:photos-local -- <展開済みディレクトリ> <出力先ディレクトリ>`）を用意した。

- `seed-municipalities.ts`と同様、DIコンテナを経由しない独立スクリプトとして実装（DB接続も不要な純粋なファイル操作のため、`DataSource`の初期化も行わない）。
- 対象ディレクトリを再帰的に走査し、見つかった全ファイル（写真・JSONサイドカーを問わない）を出力先ディレクトリへコピーする。元のディレクトリ構造・ファイルは変更しない（コピーのみ）。
- Google Takeoutは、1枚の写真が複数のアルバムに属する場合、同一内容のファイルが複数のディレクトリに重複して含まれることがある。ファイル名が衝突した際は内容のSHA-256ハッシュ（`node:crypto`、動画等の大きいファイルでもメモリを圧迫しないようストリームで計算）を比較し、内容が完全に一致する場合は重複とみなしコピーをスキップして1件に集約する。内容が異なる場合は、`mergeMonthlyArchive`（月別アーカイブ内での同名衝突回避）と共通の`resolveUniquePath`（`monthly-archive.util.ts`からexport）で拡張子の直前へ連番（`-2`, `-3`, ...）を付けて別ファイルとして保存する。

## 既存写真の一括取り込み（写真ローカルバックフィル）
`PhotoIngestService.ingest`（`POST /photos/ingest`）はTakeout zip全体を一度にメモリへ展開する方式（`adm-zip`、Buffer型）のため、Node.jsの`Buffer`最大サイズ（64bit環境で約2〜4GB）を超えるzipを扱えない。実データでは1エクスポートあたり最大50GB・複数ファイルという規模になることが判明し、既存写真をまとめて取り込むにはこの方式が使えないことがIssue #23の対応中に分かった（詳細な検討経緯はIssue #23のコメント参照）。この制約に対応するため、ユーザーが事前にTakeout zipを手元で展開し写真本体・JSONサイドカーをサブディレクトリなしの1フラットディレクトリへ集約した上で、それ以降（年月ごとの振り分け・DBへの投入）を自動化する`backend/src/photos/backfill-photos-from-local.ts`（`pnpm --filter backend run backfill:photos-local -- <ディレクトリパス> <サムネイルディレクトリパス>`）を用意した。第2引数の`<サムネイルディレクトリパス>`は、本スクリプトの実行前に`strip-videos-and-generate-thumbnails-locally.ts`（後述「写真ローカル前処理での動画除外・サムネイル生成の前倒し（Issue #104）」節参照）で生成済みのサムネイルが置かれたディレクトリを指す。

- `seed-municipalities.ts`と同じ「NestJSのDIコンテナを経由せず、`DataSource`・各サービスを手動で`new`してスクリプトから直接呼び出す」パターンで実装しており、スクリプト本体（オーケストレーション部分）に対する専用の単体テストは持たない（本プロジェクトの既存の方針を踏襲）。分割等の純粋なロジック（`splitPhotosIntoSizedParts`）は個別のutil関数として切り出し、そちらには単体テストがある
- `PhotoIngestService.ingest`とロジックを重複させないよう、以下の2つの関数を`PhotoIngestService`から切り出し・`takeout-metadata.util.ts`へ移設し、両方から共通で呼び出す形にした
  - `resolvePhotoMetadata`（`takeout-metadata.util.ts`）: JSONサイドカー優先・EXIFフォールバックでのメタデータ解決
  - `toPhotoEntity`（`photo-ingest.service.ts`からexport）: 月別アーカイブへの振り分け結果から`PhotoEntity`を組み立てる処理
- 処理は以下の3段階で行い、いずれの段階でも全写真の実バイナリを同時にメモリへ保持しないようにしている
  1. `scanLocalPhotoDirectory`（`local-photo-directory.util.ts`）がディレクトリを走査し、ファイル名のみで写真本体・JSONサイドカーへ分類する（写真本体側の`data`はプレースホルダの空Bufferとし、実バイナリは`readLocalPhotoData`で必要になった時点まで読み込まない）。`matchPhotosWithJsonSidecars`によるファイル名マッチング自体はパスのみを見るため、この時点で問題ない
  2. マッチした写真ごとに`resolvePhotoMetadata`でメタデータを解決する。写真本体は`createLazyPhotoData`（`local-photo-directory.util.ts`）でdataへのアクセスを遅延させたエントリとして渡し、JSONサイドカーで解決できた場合は写真本体に一切アクセスしない。JSONが無い・不正な場合のEXIFフォールバックで実際にdataへアクセスされた時点で初めて`readFileSync`が実行される
     - 当初は全件を`readLocalPhotoData`で無条件に読み込んでからメタデータ解決していたが、数万件規模（外付けHDD、動画含む）での実行時にJSONで解決できる大多数の写真についても不要な読み込みが発生し実行時間が大きく伸びていたことが判明したため、遅延読み込みへ変更した（Issue #23）
  3. `groupPhotosByYearMonth`で年月ごとにグループ化した後、月ごとに1グループずつ、`sortPhotosByTakenAt`（`sort-photos-by-taken-at.util.ts`）で撮影日時の昇順に並び替えた上で、さらに`splitPhotosIntoSizedParts`（`split-photos-into-sized-parts.util.ts`）で`MAX_ARCHIVE_PART_SIZE_BYTES`（1GiB）ごとの複数「part」へ分割し、partごとに（`MonthlyPhotoArchiveService.reorganize`は`[group]`という単一要素の配列で呼び出す）該当写真の実バイナリを読み込み、月別アーカイブへの振り分け・Google Driveへのアップロード・`photos`テーブルへの保存を行う
    - 並び替えを挟むのは、`scanLocalPhotoDirectory`の`readdirSync`がファイルシステムの列挙順（撮影日時とは無関係）で写真を返すため、そのままpart分割すると1つのアクティビティ（自転車ログ）の写真が複数partにまたがってしまう不具合があったため（Issue #91）。`PhotosService.findImageByPhotoId`のLRUキャッシュ（`MAX_CACHED_ARCHIVES`）は「1つのアクティビティの写真は同じ・近接する撮影年月に集中する」という前提に立っており、part分割によりこの前提が崩れると複数zipのダウンロードが発生しうる（Issue #91）。この対応は新規に取り込む写真（今後のバックフィル再実行）からのみ適用され、既にpart分割済みでアップロード済みの月を日付境界で再構成し直すことはしない。Issue #97/#99の`strip-videos-and-consolidate-archives.ts`が動画の有無に関わらず複数part月を単一zipへ統合する（「月別アーカイブからの動画削除・part統合（Issue #97 / #99）」節参照）ため、既存データは既にこの問題の実害が無い状態になっている
    - 当初は1つの年月の全写真を1回の`reorganize`呼び出し（1つのzip）にまとめて処理していたが、動画を多数含む月（実データで写真729件・約16.6GiB）では、元データ（`readLocalPhotoData`で読み込んだBuffer群）とzip化後のバッファ（`AdmZip.toBuffer()`が生成する結合済みBuffer）を同時に保持する必要があり、ピークメモリ使用量が実行環境の物理メモリ（実機は16GB）を大きく超えてプロセスがエラーも出さないまま強制終了される不具合が実際に発生した（後述の`GoogleDriveApiClient`のtimeout追加後も再発したことで、ネットワークハングではなくメモリ不足が真因と判明。Issue #23）。対応として、1つの年月を1GiBごとの複数partへ分割し、それぞれ独立したzipとして処理することでピークメモリ使用量を抑えた
    - `monthly_photo_archives`は`(year_month, part)`の組で一意（マイグレーション`AddPartToMonthlyPhotoArchives`）とし、1つの年月が複数のzipファイル（Google Drive上は`2026-01.zip`・`2026-01-part2.zip`・...のように命名）にまたがることを許容する。`photos`テーブル側は`source_file_id`が具体的にどのzipファイルを指すかを個別に保持しているため、1つの年月が複数zipに分かれていても写真の検索・取得（撮影年月とは無関係に`taken_at`で行う）には影響しない
    - 本対応より前（`part`列導入前）に作成された既存行は、分割という概念が存在しなかった時代に「その年月の全写真を含む唯一のzip」として作成されたものであるため、マイグレーションで`part = -1`（`LEGACY_WHOLE_MONTH_PART`）を設定し、サイズに関わらず常に処理済み（丸ごとスキップ対象）として扱う。これにより、既存の大容量な月（1GiB超）を新方式で誤って再分割・重複アップロードしてしまうことを防いでいる
- 対象件数が多いと全体の実行に長時間かかるため、途中で中断され再実行された場合の重複登録を避ける目的で、以下の2段階でスキップ判定を行う
  1. `monthly_photo_archives`に`part = -1`（`LEGACY_WHOLE_MONTH_PART`）のレコードがある年月（＝本対応より前に一括で処理済みの月）は丸ごとスキップする
  2. それ以外の年月は、`(year_month, part)`ごとに既にレコードがあるpartをスキップし、無いpartのみ処理する
  `reorganize`・`mergeMonthlyArchive`は同名ファイルの衝突を「別写真」として連番を付けて共存させる設計（既存アーカイブへの追記を前提とする通常の取り込みパイプラインでは正しい挙動）のため、スキップせず再実行すると同一写真が重複登録されてしまう。この対策はpart単位の粒度であり、1つのpartの処理途中（Driveへのアップロード直後〜DB保存の間等）で中断された場合はレコードが無い・不完全な状態になりうるため自動スキップされず再処理される（必要に応じて手動確認が必要）
- アクセストークンは全体で1回だけ取得するのではなく月のグループごとに取得し直す。対象件数が多く実行が長時間に及ぶとアクセストークンが途中で失効しうるため（`GoogleDriveAuthService`は有効期限内であればキャッシュを返すため、都度呼び出すコストは小さい）
- フルサイズzipの振り分け・アップロード（`monthlyPhotoArchiveService.reorganize`）が完了した直後、同じpartのループの中で、対応するサムネイル（`thumbnailDirectoryPath`配下、元ファイルと同じファイル名）を読み込み`MonthlyPhotoThumbnailArchiveService.appendThumbnails`でサムネイル専用アーカイブへ追記・アップロードする（Issue #104。詳細は後述の専用節参照）。対応するサムネイルが見つからない写真（生成失敗等）は追加をスキップし、完了時にパス一覧を出力する
- Node.jsの`fs.readFileSync`は実行環境のメモリ量に関わらず2GiB（`2 ** 31 - 1`バイト）を超えるファイルを読み込めない（`RangeError: File size is greater than 2 GiB`）。実際に約55,000件規模のGoogle Photosライブラリ（動画を含む）で2.5GB超の動画ファイルにより発生した。段階2でメタデータ解決のため写真1件分の実バイナリを読み込む直前に`statSync`でファイルサイズを確認し、上限を超える場合は読み込み自体を試みずスキップする（`skippedTooLargePaths`としてカウントし、完了時にパス一覧を出力。段階3では既にメタデータ解決の時点で除外済みのため到達しない）
- スクリプト内のログ出力は`console.log`ではなく`fs.writeSync`による同期出力（`log`ヘルパー関数）を使う。`console.log`は標準出力がパイプ（`tee`等）へ接続されている場合Node.jsによって非同期にバッファリングされることがあり、プロセスが外部要因（ネットワークハング等）で停止した場合にバッファ済みだが未フラッシュの行が失われ、どこまで進行したか実行ログから追跡できなくなる問題が実際に発生したため（Issue #23）。あわせて、月グループの処理開始時に写真件数・合計バイト数をログ出力し、Google Driveへの振り分け・アップロード完了時にも完了ログを出す（どの月のどの段階で停止したか特定できるようにするため）

## 月別アーカイブからの動画削除・part統合（Issue #97 / #99）
写真グリッド表示（静止画プレビューのみで動画再生機能は無い）に動画は使われておらず、容量のみを圧迫していた。動画を多く含む月ほど月別アーカイブzipのダウンロードに時間がかかり、写真グリッドの表示が遅い原因になっていたため、`backend/src/photos/strip-videos-and-consolidate-archives.ts`（`pnpm --filter backend run strip-videos:photos`）で既存の月別アーカイブzipから動画エントリを削除する一括処理を用意した。元のGoogle Photos側のデータには影響しない（このアプリ用にGoogle Driveへコピーした分のみが対象）。

- 動画かどうかの判定は、拡張子（`isVideoFile`、`video-file.util.ts`。`.mp4`/`.mov`/`.avi`/`.mkv`/`.3gp`/`.webm`/`.m4v`/`.mp`）と、中身の先頭バイト（`looksLikeVideoContainer`、同ファイル）の両方で行う。実データ実行の結果、iPhoneのLive Photoに付随するQuickTime動画（`.mov`）が拡張子を失った状態で紛れ込んでいる事例が見つかったため、ISOBMFFのftypボックス＋メジャーブランドを確認し、HEIC/HEIF系のメジャーブランド（`heic`/`heix`/`mif1`等）以外のftypコンテナは動画とみなす。`.mp`（Android Motion Photo）も動画として扱う（詳細はサムネイル生成節参照）。
- ダウンロード・統合・アップロードは全てディスク経由のストリーミング処理で行う（Issue #99。初回実装ではzip全体をメモリ上へ保持していたため、月合計サイズが2GiBを超える月は安全のため処理対象から除外していたが、ストリーミング化によりこの制限は撤廃した）
  - `GoogleDriveApiClient.downloadFileToPath`/`uploadFileFromPath`（`google-drive-api.client.ts`）は、既存の`downloadFile`/`updateFileContent`（Bufferを丸ごと受け渡しする、写真取り込み等の他の処理で引き続き使用）とは別に新設したメソッドで、ファイル内容をディスク上のパス経由でストリーミング転送する。アップロードのチャンク読み出しはファイルサイズに関わらずチャンク1つ分のバッファを使い回すことで、メモリ使用量を一定に保つ
  - `consolidateArchiveFilesWithoutVideosStreaming`（`consolidate-monthly-archive-streaming.util.ts`）は、ディスク上の元アーカイブzipファイル（サイズ超過によりpart分割されていた場合は複数）を`yauzl`でエントリ単位に逐次読み込む。アーカイブ全体を同時にメモリへ保持しないが、動画かどうかの判定に中身の確認が必要なため、1エントリ分（写真・動画1件、数MB程度）はいったんBufferとして読み切ってから、動画でなければ`yazl`の`addBuffer`で新規zipへ追加する（サムネイル生成、`generate-thumbnail-archive-streaming.util.ts`と同じ設計）。異なる元アーカイブ由来で同名ファイルが衝突する場合は`mergeMonthlyArchive`と共通の`resolveUniquePath`で連番を付けて回避し、新規エントリはSTORED（無圧縮）で追加する。yauzlは同一zipFileに対する並行読み込みを想定していないため、1エントリの処理が完了してから次のエントリの読み込みに進む設計とする
- オーケストレーション（`strip-videos-and-consolidate-archives.ts`）は年月ごとに以下を行う
  1. 対象年月の全アーカイブ（part分割されていた場合は複数）の合計サイズを`GoogleDriveApiClient.getFileMetadata`で事前確認し、進捗ログに出力する（ストリーミング化により処理可否の判定には使わない）
  2. 年月ごとの一時作業ディレクトリ（`os.tmpdir()`配下）へ対象アーカイブを全て`downloadFileToPath`でダウンロードし、`consolidateArchiveFilesWithoutVideosStreaming`で統合。動画も無く既に単一アーカイブの場合は何もせず処理済みとして記録するのみ
  3. 統合後のzipを新規Driveファイルとして`uploadFileFromPath`でアップロードし、`photos`テーブルの保持対象の写真は新しい`source_file_id`/`archive_path`へ更新、動画の`PhotoEntity`は削除する
  4. `monthly_photo_archives`の当該年月の行を全て削除し、新しいzipを指す1行（`part = LEGACY_WHOLE_MONTH_PART`）を挿入する。この時点でDB側は新しいzipを正しく参照した一貫性のある状態になる
  5. 古いDriveファイルの削除は上記4の後に行うベストエフォートな後始末とする（失敗してもDB側の整合性は既に保たれているため、この年月の処理自体は成功として扱う。失敗時はDrive容量が無駄になるのみで手動削除が必要）
  6. 年月ごとの一時作業ディレクトリは、処理の成否に関わらず`finally`で必ず削除する（disk容量を圧迫し続けないため）
- 中断・再実行時の重複防止は、専用の`video_stripped_year_months`テーブル（マイグレーション`CreateVideoStrippedYearMonths`、年月のみを保持する進捗管理専用テーブル）で行う。`monthly_photo_archives`本体のスキーマ・スキップ判定ロジックは変更しない（本処理による統合後のアーカイブも`part = LEGACY_WHOLE_MONTH_PART`という同じ状態になるため、既存のスキップ判定とは独立した専用の記録が必要だった）。動画判定ロジック自体を改善した後（`looksLikeVideoContainer`追加等）、既に処理済みの年月を選んで再処理したい場合は、`generate-thumbnail-archives.ts`と同じパターンの`FORCE_REPROCESS_YEAR_MONTHS`環境変数（カンマ区切りの年月）で対象を指定する。指定された年月は処理済みでも再処理され、既存の古いDriveファイル削除の仕組み（上記5）がそのまま適用される
- **レガシー単一アーカイブのZIP64非対応と復旧（Issue #99フォローアップ）**: `part`列導入以前（part分割の概念が存在しなかった時代）に作成された一部の既存アーカイブ（`part = LEGACY_WHOLE_MONTH_PART`）は、合計サイズが4GiBを超える場合に読み込めない（`yauzl`はもちろん標準の`unzip`コマンドでも「End of central directory record signature not found」となる）ことが実データ処理で判明した。標準ZIP形式は32bitオフセットで4GiBが上限のため、これらのファイルを書き込んだ当時の`adm-zip`がZIP64拡張に対応しておらず、書き込み時点で既に壊れた状態だった可能性が高い（ダウンロード自体はContent-Lengthと完全一致しており、ダウンロードや本処理起因の破損ではないことを確認済み）。オーケストレーションは1年月の処理失敗（この種のアーカイブ破損を含む）で全体を止めず、失敗した年月をログへ記録した上で次の年月へ処理を継続する設計だったため、該当9年月は未処理のまま残っていた。
  - この種の復旧は、対象年月・ファイルが完全に確定しており繰り返し実行する運用を想定しない一回限りの作業のため、`backend/src/one-off/`（通常の`photos/`配下のパイプラインとは別ディレクトリ）に専用スクリプトを置いた。実行スクリプト（および対応するテストがあればそれ）は、それを追加したブランチ名のサブディレクトリ（`one-off/<ブランチ名>/`）配下に置く（複数の一回限りの作業が積み重なっても、どの作業がどの一連のファイルを追加したのか・ブランチ単位で追跡できるようにするため）。本件は`feat/issue-100-thumbnail-zip-generation`ブランチで追加したため`one-off/feat/issue-100-thumbnail-zip-generation/`配下に置く。そのスクリプトからのみ使われるutil（他のモジュールから一切importされないもの）も同じブランチ名サブディレクトリの`utils/`（`one-off/feat/issue-100-thumbnail-zip-generation/utils/`）に置き、複数のモジュールから共有されるutil（`zip-streaming.util.ts`等）は通常通り`photos/`直下に残す。
  - 破損しているのはZIP形式末尾のセントラルディレクトリ（インデックス情報）のみで、各エントリ本体（ローカルファイルヘッダー＋データ）自体はファイル内に残っていることが判明したため、専用の復旧ツールを実装した。`one-off/feat/issue-100-thumbnail-zip-generation/utils/legacy-archive-recovery.util.ts`の`scanLocalFileHeaders`が、ローカルファイルヘッダー（4バイトのシグネチャ＋26バイトの固定フィールド）を先頭から順に辿り、各エントリの圧縮後サイズフィールドを使って次のヘッダー位置へ直接ジャンプする（データ本体を読まずに位置だけを特定するため高速。バイト単位で全体を走査する`zip -FF`等より大幅に高速）。`decompressAndVerifyEntry`が各エントリを展開し、宣言されているサイズ・CRC32と一致するか検証する。
  - `one-off/feat/issue-100-thumbnail-zip-generation/recover-legacy-archives.ts`がオーケストレーションを担う。エントリの検証（読み取り＋展開＋CRC確認）を全て完了させてから出力zipの書き込みを開始する2パス構成にしている（1パスで検証と書き込みを同時に進めると、途中のエントリで検証エラーが発生した際にyazlの出力ストリームが中途半端な状態のまま残り、後から`ENOENT`でrejectされた際にどこにもcatchされない「unhandled promise rejection」でプロセス全体がクラッシュする事故が実際に発生したため）。1件でも検証に失敗したエントリがあっても年月全体を諦めず、検証に成功したエントリのみを復旧し、`photos.source_file_id`を新しいDriveファイルIDへ更新する（`archive_path`はファイル名そのままのため変更不要）。検証に失敗したエントリは元の（読めない）Driveファイルを指したまま残り、ログに明示される。
  - 古い（読めない）Driveファイルは、復旧結果の最終確認が済むまでの安全策として自動削除しない（手動確認後に別途削除する）。
  - 実データ実行の結果、全9年月・対象6,847件中6,838件（99.9%）を復旧できた。残り9件（各年月ちょうど1件ずつ）はCRC32またはサイズが一致せず、書き込み当時から実データ自体が部分的に破損していたと考えられる。写真ローカルバックフィル時に使用した外付けHDD上の元データと照合したところ、写真5件は正常な状態を確認できたため`one-off/feat/issue-100-thumbnail-zip-generation/finalize-legacy-recovery.ts`で各年月のアーカイブへ追加し、動画4件は（元々グリッド表示に不要なため）復旧させず`photos`テーブルの行のみ削除した。これにより対象6,847件中6,843件（99.94%）の復旧・補完が完了している。
  - 復旧後は`video_stripped_year_months`に未記録の通常の未処理年月として扱われるため、`strip-videos-and-consolidate-archives.ts`・`generate-thumbnail-archives.ts`を（`FORCE_REPROCESS_YEAR_MONTHS`無しの）通常のフローでそのまま実行できる。

## グリッド・吹き出し表示用サムネイルZipの生成（Issue #100）
写真グリッド・吹き出し表示は、動画削除・part統合済みのフルサイズ月別アーカイブzip（`monthly_photo_archives`）をGoogle Driveから丸ごとダウンロードして表示しており、写真枚数が多い月ほど表示が遅い。グリッド・吹き出し表示では小さいサムネイルで十分なため、年月ごとに横300px（縦横比維持）のサムネイル画像のみを集めた専用zip（`<年月>-thumbnails.zip`）を`backend/src/photos/generate-thumbnail-archives.ts`（`pnpm --filter backend run generate-thumbnails:photos`）で生成し、既存のフルサイズzipとは別にGoogle Drive上へ保存する。

- `zip-streaming.util.ts`は、動画削除・part統合のストリーミング処理（Issue #99）で使っていたyauzl/yazlの低レベルなzip逐次読み書きヘルパー（`forEachZipEntry`・`openEntryReadStream`・`writeYazlOutput`・`addStreamEntryAndWait`）を、`consolidate-monthly-archive-streaming.util.ts`と本機能とで共有できるよう切り出したもの（DRY）。
- `generateThumbnailArchiveStreaming`（`generate-thumbnail-archive-streaming.util.ts`）は、ディスク上の元アーカイブzip（1つ、動画削除・part統合済みのため常に単一）を`zip-streaming.util.ts`のヘルパーでエントリ単位に逐次読み込む。アーカイブ全体を同時にメモリへ保持しないが、1エントリ分（写真1件、数MB程度）はいったんBufferとして読み切ってから`sharp().resize({ width: 300 }).toBuffer()`が成功した場合のみ出力zipへ追加する。これは、出力ストリームへ追加した後に読み込み側でエラーが発生すると出力zipの内部キューが後続エントリの書き込みへ進めなくなる恐れがあるため（1枚の写真のデコード失敗が年月全体を巻き込まないようにする対応）。縦横比は`sharp`の`resize`の既定動作（幅のみ指定時は高さを維持したままスケール）により自動的に維持される。
- HEIC/HEIFは、上記の`sharp().resize()`へ渡す前に変換する。
  - sharpが内蔵するlibheifデコーダには、悪意あるファイルからのDoS対策としてのセキュリティ上限（iref boxの参照数16件超等）があり、iPhoneのポートレート/Live Photoが持つ補助画像（深度マップ等）を含む正当な写真もこの上限に抵触してデコードに失敗することがある。sharp自体はこの上限を緩和するオプションを公開していないため、`heic-conversion.util.ts`がlibheif付属のCLIツール`heif-convert`を`--disable-limits`オプション付きで外部プロセスとして呼び出し、上限を無効化した上でJPEGへ変換する。拡張子が`.heic`/`.heif`でも中身が実際には別形式（編集アプリでの再保存等）であるファイルが実データに存在するため、変換前にバッファ先頭バイトが実際にISOBMFFの`ftyp`ボックスから始まっているか（`looksLikeHeicContainer`、`generate-thumbnail-archive-streaming.util.ts`）も確認し、該当しない場合はheif-convertを経由せず元のバッファをそのままsharpへ渡す。
  - **`heif-convert`が使えない環境での事故防止**: HEIC変換をheif-convertへ一本化したことで、heif-convertが利用できない環境（コマンド未検出・`--disable-limits`未対応の古いバージョン等）で実行すると、本来sharp単体で成功していたはずのHEIC写真まで含めて全滅する（フォールバックが無いため）。オーケストレーション（`generate-thumbnail-archives.ts`）は処理開始前に必ず`assertHeifConvertAvailable`（`heic-conversion.util.ts`）を呼び出し、heif-convertが実行可能かつ`--disable-limits`に対応していることを確認する。確認に失敗した場合は年月の処理を一切開始せずエラーで終了する（フォールバックではなく即座に失敗させる設計とした。実際に、heif-convertが見つからない環境で`FORCE_REPROCESS_YEAR_MONTHS`を使って手動実行した際、エラーにならず「正常終了」しつつ、既に救済済みだった年月のサムネイルがより悪い結果で静かに上書きされる事故が発生したため）。
- Android Motion Photo(`.mp`)は、動画として除外する（`video-file.util.ts`の`VIDEO_EXTENSIONS`に含める）。当初はJPEG本体の後ろにMP4動画データが連結されたハイブリッド形式と想定し先頭のJPEG部分を抽出する専用実装（`motion-photo.util.ts`）を用意していたが、実データ調査の結果、このアプリのデータセットに存在する`.mp`ファイル（全11件）はいずれも「動画本体のみで、静止画は同じアーカイブ内の別ファイル（`<ファイル名>.mp.jpg`）として独立して存在する」構成であり、`.mp`ファイル自体から静止画を抽出できた実例が1件も確認できなかった。そのため抽出専用実装は削除し、単純に動画として除外する方式に変更した（対応する`.jpg`側は通常の写真として別エントリで処理される）。
- オーケストレーション（`generate-thumbnail-archives.ts`）は年月ごとに以下を行う
  1. 生成対象は`video_stripped_year_months`に記録済みの年月のみに限定する（動画削除・part統合が完了し、常に単一アーカイブ・動画なしという前提を満たす年月のみを対象とすることで、サムネイル生成側の実装をシンプルに保てる）。未処理・失敗（レガシーアーカイブ破損等、前節参照）の年月は対象外とする
  2. 対象アーカイブをディスクへダウンロードし、`generateThumbnailArchiveStreaming`でサムネイルzipを生成する
  3. 生成したサムネイルzipを`<年月>-thumbnails.zip`という名前で新規Driveファイルとしてアップロードする
  4. `monthly_photo_thumbnail_archives`（マイグレーション`CreateMonthlyPhotoThumbnailArchives`、年月とサムネイルzipのDriveファイルIDのみを保持する専用テーブル）へ記録する。既存の`monthly_photo_archives`（フルサイズ写真用）のスキーマ・データは変更しない（サムネイルzipはフルサイズzipと完全に独立した別ファイルとして扱う）
  5. 年月ごとの一時作業ディレクトリは、処理の成否に関わらず`finally`で必ず削除する
- 中断・再実行時の重複防止・1年月の失敗で全体を止めない設計は、いずれも`strip-videos-and-consolidate-archives.ts`（Issue #99）と同じパターンを踏襲する
- 中断・再実行時の重複防止（`monthly_photo_thumbnail_archives`への年月単位の完了記録）は、その年月「全体」が成功したかどうかのみを表す。年月の中の一部の写真だけが個別に失敗した場合（`failedEntries`）はこのテーブルには記録されないため、通常の再実行では再処理されない。HEIC/Motion Photo対応のようにサムネイル生成方式自体を改善した後、既に処理済みの年月に含まれる失敗写真だけを狙って再生成したい場合は、`FORCE_REPROCESS_YEAR_MONTHS`環境変数（カンマ区切りの年月）で対象を明示的に指定する。指定された年月は処理済みでも再処理され、新しいサムネイルzipへの差し替えが成功した後、古いDriveファイルの削除をベストエフォートで行う（`strip-videos-and-consolidate-archives.ts`の古いアーカイブ削除と同じパターン。失敗してもDriveの容量を無駄にするだけでデータの整合性は壊れない）
- サムネイルzip内のエントリパスは、元アーカイブと同じファイル名（衝突時は`resolveUniquePath`で連番）とする。将来グリッド/吹き出し表示側で実際にサムネイルzipを参照する際は、`photos.archive_path`（元アーカイブ内でのファイル名）と`photos.taken_at`から求めた年月に対応する`monthly_photo_thumbnail_archives.drive_file_id`を組み合わせれば、対応するサムネイルエントリを特定できる（`photos`テーブル自体にサムネイル専用のカラムを追加する必要はない）
- グリッド/吹き出し表示側の実際の切り替え（サムネイルzipを先に読み込み、フルサイズzipは裏で先読みする方式への変更）は本Issueのスコープ外とし、別Issueで対応する

## 写真ローカル前処理での動画除外・サムネイル生成の前倒し（Issue #104）
動画削除（Issue #97/#99）・サムネイル生成（Issue #100）は、いずれも「写真ローカルバックフィルで全年月をGoogle Driveへアップロードし終えた後」に、成り行きで追加された機能だった。そのため新規に取り込む年月ごとに「動画込みでアップロード→ダウンロードして動画削除→再アップロード→改めてダウンロードしてサムネイル生成→アップロード」という無駄な通信往復が発生し、動画込みの状態で先にアップロードするため月合計サイズが4GiBを超えやすく、Issue #103のZIP64非対応による破損リスクも高まっていた。動画を削除する・サムネイルを生成するという判断自体は`flatten-local-photo-directory.ts`実行後（＝ローカルにファイルが揃った時点）で既に確定できるため、`backend/src/photos/strip-videos-and-generate-thumbnails-locally.ts`（`pnpm --filter backend run strip-videos:photos-local -- <フラットディレクトリパス> <サムネイル出力先ディレクトリパス> <削除ログ出力先パス>`）でこの時点に前倒しし、`backend/src/photos/backfill-photos-from-local.ts`実行前に完結させる。

- 新規に取り込む年月については本対応で完結し、`strip-videos-and-consolidate-archives.ts`・`generate-thumbnail-archives.ts`（Drive上のアーカイブに対して動画削除・サムネイル生成を行う既存スクリプト）を経由する必要がなくなる。既存の178年月分（Issue #97/#99/#100で処理済み）は本対応の対象外。動画検出ロジックの改善等により既にアップロード済みの年月を事後的に再処理したいケース（`FORCE_REPROCESS_YEAR_MONTHS`）は引き続き必要になるため、上記2スクリプト自体は事後修正用の経路として残す
- `flatten-local-photo-directory.ts`が集約したローカルのフラットディレクトリ（サブディレクトリなし）に対し、ファイルを1件ずつ順に処理する（DB・Google Driveへのアクセスを一切行わない純粋なローカルファイル操作のため、`seed-municipalities.ts`と同様スクリプト自体に対する単体テストは持たず、動画判定・サムネイル生成という純粋なロジックのみを個別のutilとして切り出しテストする）
  - `isLocalFileVideo`（`local-video-detection.util.ts`、新規）が、既存の`isVideoFile`・`looksLikeVideoContainer`（`video-file.util.ts`）をそのまま流用して動画かどうかを判定する。拡張子で判定できる場合は中身を読まず、拡張子で判定できない場合（拡張子が失われた動画）のみ、ISOBMFFのftypボックス＋メジャーブランド判定に必要な先頭12バイトだけをファイルから読み込む（`fs.openSync`/`readSync`で範囲指定読み込み。動画は数GB級になりうるため`looksLikeVideoContainer`のためだけに全読み込みしない）
  - 動画と判定したファイルは削除（`unlinkSync`）する前に、ファイル名とEXIF撮影日時を`formatVideoDeletionLogLine`（`video-deletion-log.util.ts`、新規）でJSON Lines形式に整形し、`deletionLogPath`へ追記する。撮影日時は既存の`extractMetadataFromExif`（`takeout-metadata.util.ts`）のみを使う（JSONサイドカーは動画に対して用意されないことが多く、動画削除自体は動画判定ロジックのみで完結させるべきと判断したため参照しない）。`MAX_READABLE_FILE_SIZE_BYTES`（2GiB、`local-photo-directory.util.ts`からexportに変更し`backfill-photos-from-local.ts`と共有）を超える動画は読み込み自体を試みずEXIF抽出をスキップし、`takenAt: null`として記録する
    - **ローカルのTakeout展開データの保持方針（検討事項の結論、2026-07-30）**: ローカルのTakeout展開データは基本的に保持しない運用とする。Google Photos側の元データは削除しないため、誤って写真を動画と判定し削除してしまった場合（動画の削除し忘れは、ロジック修正後にローカル処理を再実行すれば解消するため実害なし）のみ実害が生じる。復旧時はこの削除ログ（ファイル名・EXIF撮影日時）をもとにGoogle Photos側で該当ファイルを検索・再取得する運用とする
  - 動画でないファイルは`generateThumbnailBuffer`（`thumbnail-generation.util.ts`。`generate-thumbnail-archive-streaming.util.ts`のHEIC変換・sharpリサイズ処理を共通化のため切り出したもの）でサムネイルを生成し、`thumbnailDirectoryPath`配下へ**元ファイルと同じファイル名**で書き出す（内容はJPEG等へ再エンコードされるが、`backfill-photos-from-local.ts`側でフルサイズzip内のアーカイブパスと対応付けるためファイル名は変更しない。ローカルの1フラットディレクトリ内ではファイル名は既に一意なため、`resolveUniquePath`のような衝突回避は不要）。1件のサムネイル生成に失敗しても他のファイルの処理を止めずに次へ進む（`generate-thumbnail-archive-streaming.util.ts`と同じ設計）
  - 実行前に必ず`assertHeifConvertAvailable`でheif-convertの可用性を確認する（確認に失敗した場合の事故防止の理由は「グリッド・吹き出し表示用サムネイルZipの生成（Issue #100）」節参照。ローカル前処理でも同じ前提が必要なため踏襲する）
- `MonthlyPhotoThumbnailArchiveService`（新規、`monthly-photo-thumbnail-archive.service.ts`）は、`MonthlyPhotoArchiveService`（フルサイズ写真用）と対になるサムネイル専用アーカイブのアップロードサービス。既存の`mergeMonthlyThumbnailArchive`（`monthly-archive.util.ts`、Issue #104で追加）を使い、`MonthlyPhotoThumbnailArchiveEntity`（Issue #100で追加、常にpart列を持たない1年月=1zip設計）に対して、`backfill-photos-from-local.ts`が日付ベースの複数part（Issue #91）を1つずつ処理する中でも同じ1つのzipへ繰り返し追記していく。フルサイズ写真用の`MonthlyPhotoArchiveService.reorganize`と異なりpartという概念を持たない（サムネイルzip自体は常に1年月=1zipのため）
- 新規に取り込む年月は、この前倒し処理により最初から動画なし・サムネイル生成済みの状態でアップロードされるため、`video_stripped_year_months`（`strip-videos-and-consolidate-archives.ts`専用の進捗管理テーブル）への記録は行わない。同テーブルは`generate-thumbnail-archives.ts`が処理対象を絞り込むためのゲートとしてのみ使われており、新規フローの年月をここに含めないことで、レガシースクリプトが誤ってこれらの年月を再処理する心配もない（レガシースクリプトを経由しないことが本対応の目的そのものであるため、意図した挙動）

## アクティビティパネルの写真表示をサムネイル経由へ切り替え（Issue #105）
アクティビティパネルの写真グリッド（`PhotoGridItem`、`ActivityDetailSidebar.tsx`）は、Issue #100でサムネイル専用zip（`monthly_photo_thumbnail_archives`）を生成する仕組みが既に実装済みだったにもかかわらず、フルサイズ月別アーカイブzipから直接写真を取得しており（`GET /photos/:id/image`）、生成済みのサムネイルが一切参照されていなかった。新規`GET /photos/:id/thumbnail`エンドポイントを追加し、パネル表示をこちらへ切り替えた。

- `PhotosService.findThumbnailByPhotoId`（新規）は、対象写真の`taken_at`から`toYearMonth`（`group-photos-by-year-month.util.ts`からexportに変更）で撮影年月を求め、`monthly_photo_thumbnail_archives`から対応するサムネイルzipの`driveFileId`を引く。既存の`findImageByPhotoId`とはzipの取得元（`photos.source_file_id`かサムネイル専用テーブルか）が異なるだけで、zip内からのエントリ取り出し自体は同じロジックのため、共通の`extractImageFromZip`（private）へ切り出しDRYにした。zipのダウンロード・キャッシュ（`getOrFetchArchiveZip`、`archiveZipCache`、最大`MAX_CACHED_ARCHIVES`件のLRU）はフルサイズ・サムネイルの両方で共有する（driveFileIdをキーにしており衝突しないため、キャッシュ容量を分ける必要はないと判断した）
- 撮影年月に対応するサムネイルアーカイブが存在しない（未処理・失敗年月）場合、サムネイルzip内に対応するエントリが見つからない（個々の写真のサムネイル生成失敗等）場合はいずれも`findThumbnailByPhotoId`がnullを返し、コントローラー（`PhotosController.getThumbnail`）がHTTP 404を返す
- フロントエンドの`PhotoGridItem`は、`resolvePhotoThumbnailUrl`（新規、`photosApi.ts`）を`<Image>`の初期`src`とする。`onError`（404等）が発生した時点で1度だけ`resolvePhotoImageUrl`（フルサイズ、既存）へ`src`を切り替える（`hasThumbnailFailed`のstateで1度きりのフォールバックであることを保証し、フルサイズ側もエラーになった場合は既存通りローディング表示を諦める）。検討事項として挙がっていた「新規取り込み時のサムネイル生成完了までのタイムラグ」は、Issue #104によりバックフィル時点でサムネイルも同時に生成・アップロードされるようになったため実質的に発生しない（Issue #105のIssueコメントで確認済み）

## フルサイズ写真のHEIC事前一括変換（Issue #106）
`GET /photos/:id/image`は月別アーカイブzip内のバイト列を加工せずそのまま返すため、`.heic`写真は`image/heic`のContent-Typeで生のHEICバイト列が返っていた。多くのブラウザ（Safari以外）はHEICをネイティブにデコードできず、フルサイズ写真としてHEIC画像を表示しようとすると失敗する（壊れた画像アイコンが表示される）。Issue #100のサムネイル生成では既にHEIC→JPEG変換（`heic-conversion.util.ts`）を実装済みだが、元サイズ画像の配信経路には組み込まれていなかったため、事前一括変換パイプラインを新設した。

- **検討事項の回答（ユーザー確定）**: 変換後データの保存方式は、既存のフルサイズアーカイブ内の`.heic`エントリを直接`.jpg`エントリへ置き換える方式（元のHEICバイト列は保持しない）を採用した。サムネイルのように別アーカイブとして二重に保持する方式は採らない。
- `isActualHeicFile`（`heic-conversion.util.ts`、新規export）は、`thumbnail-generation.util.ts`が内部に持っていたHEIC拡張子判定＋ISOBMFFのftypボックス確認（`looksLikeHeicContainer`）のロジックを`heic-conversion.util.ts`側へ移設し、ファイル名・バッファを渡すだけで判定できる関数として切り出したもの。サムネイル生成（元サイズ300pxの解像度）と本対応（元サイズ）は変換対象の解像度が異なり中間結果を流用できないため変換処理自体は別物だが、「拡張子だけHEICで中身は実際には別形式のファイルを誤変換しない」という判定ロジックは共通化した（Issue #106のユーザー回答「共通化できる部分はちゃんと共通化してください」に対応）。`thumbnail-generation.util.ts`は自前の判定ロジックを削除し、この関数を使うよう変更した
- `convertHeicArchiveEntries`（新規、`convert-heic-archive-entries.util.ts`）は、月別アーカイブzip本体と対象エントリパス一覧を受け取り、実際にHEICであるエントリのみ`convertHeicBufferToJpegBuffer`でJPEGへ変換し、`.jpg`拡張子のエントリへ置き換える（衝突時は`resolveUniquePath`で連番、新規エントリはSTORED）。拡張子だけHEICで中身が実際には別形式のエントリは変換せずそのまま残す（サムネイル生成と同じ方針）。1件の変換失敗は他のエントリの変換を止めず、失敗したエントリは元のHEICエントリのまま残る
- `convert-heic-photos-to-jpeg.ts`（新規、`pnpm --filter backend run convert-heic:photos`）がオーケストレーションを担う。`generate-thumbnail-archives.ts`と同じ「未処理分を検出して処理する恒久パイプライン」のパターンを採用しており、専用のone-offスクリプトは用意していない（Issueの要求通り、初回実行で新規取り込み分・既存アップロード済みのバックログの両方を自動的にカバーする）
  - 進捗管理には、`video_stripped_year_months`のような専用テーブルを新設せず、`photos.file_name`が`.heic`/`.heif`拡張子であること自体を「未処理」の判定基準として使う（`ILike`で大文字小文字を無視して検索）。変換が完了した写真は`file_name`/`archive_path`が`.jpg`へ更新されるため、次回実行時のクエリに自然と現れなくなり、追加のテーブルなしに冪等性を保てる。拡張子だけHEICで実際には別形式のエントリ（変換されずそのまま残る）は次回以降も毎回クエリに現れ続け無駄なダウンロード・再確認が発生するが、手動トリガーのバッチ処理でありコストは小さいため許容する
  - `photos.source_file_id`（月別アーカイブzip）単位でグループ化し、1つのzipにつき1回のダウンロード・アップロードで対象写真をまとめて変換する。変換後のzipは同じ`driveFileId`へ`updateFileContent`で上書きする（動画削除・統合の`strip-videos-and-consolidate-archives.ts`とは異なり、新規ファイル作成＋旧ファイル削除の手順は取らない。複数の元ファイルを統合するわけではなく1つのアーカイブを編集するだけのため、`MonthlyPhotoArchiveService.reorganize`の追記時と同じ「既存ファイルへの上書き」で十分と判断した）
  - 1つのzipの処理に失敗しても、他のzipの処理は継続する（`strip-videos-and-consolidate-archives.ts`と同じ設計）。実行前に必ず`assertHeifConvertAvailable`でheif-convertの可用性を確認する

## 地図上の写真吹き出し表示（Issue #107）
アクティビティがフォーカスされた時点で、そのアクティビティに紐づく写真（Issue #105と同じ`usePhotos`の取得結果）のサムネイルを地図上のGPS座標へ吹き出しとして表示する。ユーザー確定済みの仕様として、(1) フォーカス時点で全写真の読み込みを一斉に開始し完了したものから順に表示する、(2) 近接する写真はクラスタリングしてまとめる、(3) フォーカス解除時は吹き出しを全て消す、(4) 位置情報を持たない写真は表示しない（撮影日時とアクティビティの軌跡からの位置補完は、軌跡データに時刻情報が無いため見送り）、の4点がある。

- **`usePhotos`の呼び出し元をMapWorkspaceへ集約**: `ActivityDetailSidebar`（パネル表示）と`MapView`（吹き出し表示）の両方が同じ写真一覧を必要とするため、`usePhotos`の呼び出しを`MapWorkspace.tsx`へ持ち上げ、`photos`/`isPhotosLoading`を両コンポーネントへpropsとして渡すよう変更した。`usePhotos`は`activityId: string | null`を受け付けるようになり（未フォーカス時は`null`を渡す）、`null`の場合は取得を行わず即座に空配列・`isLoading: false`を返す。`ActivityDetailSidebar`は内部で保持していた`usePhotos`呼び出しを廃止し、`photos`/`isPhotosLoading`を必須propsとして受け取るだけになった
- **クラスタリング**: `supercluster`（新規依存追加、型定義は`@types/supercluster`）を使う。`buildPhotoClusterIndex`（`photoBalloonCluster.util.ts`）が、位置情報を持つ写真のみを対象にクラスタリングインデックスを構築する（`PHOTO_BALLOON_CLUSTER_RADIUS_PX`=60px、`PHOTO_BALLOON_CLUSTER_MAX_ZOOM`=20）。`getVisiblePhotoClusters`が、指定した表示範囲(bbox)・ズームレベルで実際に表示すべきクラスタ・個別写真の一覧（`PhotoBalloonPoint[]`）を返す。いずれも純粋関数でMapLibreの`Map`インスタンスに依存しないため、実データに近い座標を使った単体テストで挙動を直接検証できる
- **マーカー表示**: クラスタ・個別写真いずれも`maplibregl.Marker`（DOM Marker）として表示する。`createPhotoBalloonThumbnailElement`/`createPhotoBalloonClusterElement`（`photoBalloonElement.ts`）が、`startGoalMarkerElement.ts`の`createMarkerElement`と同じパターン（`react-dom/client`の独立したReact rootを`flushSync`で同期マウントし、`maplibregl.Marker`の`element`オプションへ渡す）でDOM要素を組み立てる。マウント先のReact rootはアプリ本体の`ChakraProvider`配下に含まれないため、`PhotoBalloonThumbnail`・`PhotoBalloonClusterBadge`（いずれも`components/`配下）はChakra UIコンポーネントを使わず、`startGoalMarkerElement.ts`と同様プレーンなDOM要素・インラインstyleとして実装した（Chakraコンポーネントを使うと`ChakraProvider`のcontextが無くエラーになる）
  - `PhotoBalloonThumbnail`は単一写真のサムネイルを円形のバッジとして表示する。サムネイル優先・失敗時にフルサイズへフォールバックするロジックは`usePhotoThumbnailFallback`（新規フック）へ切り出し、`PhotoGridItem`（アクティビティパネルのグリッド表示、Issue #105）と共通化した（DRY）。読み込み完了まで`visibility: hidden`にする点も`PhotoGridItem`と同じで、これにより「読み込みが完了した写真から順に表示」という要求を、進捗管理を別途実装せず`<img>`の`onLoad`だけで自然に満たしている
  - `PhotoBalloonClusterBadge`はクラスタにまとまっている写真の件数のみを円形バッジで表示する（個別のサムネイルは表示しない）
- **`applyPhotoBalloons`**（`mapLayerInteraction.ts`）が、`markersRef`が保持する直前のマーカー・React rootを全て`remove()`/`unmount()`した後、`clusterIndex`（null時は何も追加せず終了）から`map.getBounds()`・`map.getZoom()`で現在の表示範囲・ズームレベルにおけるクラスタ・個別写真を求め、新しいマーカーとして追加する。`applyStartGoalMarkers`と同じ「差分更新ではなく毎回全消去→再構築」の設計を踏襲する（1アクティビティあたりの写真件数は多くても数十件程度のため軽量）
- **`MapView.tsx`側の結線**: 新規`photos: Photo[]` propを追加。`photoClusterIndexRef`（`photos`が変わるたびに`buildPhotoClusterIndex`で再構築）・`photoBalloonMarkersRef`の2つの`useRef`を持つ。`photos`を依存配列に含む`useEffect`が、インデックス再構築後ただちに現在の表示範囲で`applyPhotoBalloons`を呼ぶ（フォーカス変化・フォーカス解除の反映はこの経路）。加えて、地図のパン・ズーム操作でクラスタリング結果自体が変わりうるため、マウント時に一度だけ`map.on('moveend', ...)`を登録し、`photoClusterIndexRef.current`（refのため常に最新のインデックスを参照する、クロージャの陳腐化対策は既存の他ハンドラと同じパターン）を使って`applyPhotoBalloons`を再実行する

## 写真の拡大プレビュー表示（Issue #108）
アクティビティパネル（`PhotoGridItem`、Issue #105）・地図上の吹き出し（`PhotoBalloonThumbnail`、Issue #107）いずれのサムネイルをクリックした場合も、共通の拡大プレビューダイアログでフルサイズ画像（`/photos/:id/image`。Issue #106のHEIC事前変換が完了していればJPEG化済み）を表示する。ユーザー確定済みの仕様として、(1) 矢印キー（→/←）で前後の写真へ移動できる、(2) 吹き出し由来・パネル由来のクリックで見た目・挙動を共通化する、の2点がある。

- **状態の一元管理**: プレビュー中の写真は「`photos`配列内でのindex」（`previewPhotoIndex: number | null`、`MapWorkspace.tsx`）として管理する。パネル・吹き出しいずれのクリックも共通の`handlePhotoClick(photoId)`を呼び、Issue #107で既に`MapWorkspace`へ集約済みの`photos`配列から対象のindexを検索して設定する。これにより「見た目・挙動の共通化」（ユーザー回答）を、UIコンポーネントを1つに集約する形で満たす（吹き出し由来・パネル由来で別々のモーダル実装を持たない）
- **`PhotoPreviewModal`**（新規、`components/`）は、共通ダイアログラッパー`AppDialog`（既存、`Dialog.Root`/`Backdrop`/`Positioner`/`Content`等のChakra UI Dialog構造を集約したもの）の上に構築する。`selectedIndex`が`null`の間は`isOpen=false`として非表示にする
  - 前後移動は、`selectedIndex`の前後に隣接するindexへの移動として実装し、`hasPrevious`/`hasNext`（配列の先頭・末尾での境界判定）で前後ボタンの無効化を制御する。矢印キーでの移動（ユーザー回答）は、ダイアログが開いている間だけ`window`への`keydown`リスナーを登録する`useEffect`で実装し、`hasPrevious`/`hasNext`と同じ境界判定を使う
  - フルサイズ画像は`PhotoPreviewImage`（内部コンポーネント）が`key={photo.id}`でラップして表示する。前後移動のたびに`photo.id`が変わり`key`が変わることでReactがコンポーネントを再マウントするため、読み込み中フラグ（`isLoaded`）が写真ごとに自然にリセットされ、都度ローディングスピナーを表示できる（`useEffect`等での手動リセットが不要）
- クリック元の結線: `PhotoGridItem`は`onClick` propを追加しクリック領域全体（`Box`）に設定。`PhotoBalloonThumbnail`は、写真吹き出しのDOM要素自体が`maplibregl.Marker`用の独立したReact root（`ChakraProvider`配下外、Issue #107参照）にあるため、クリック領域を`<button>`（ネイティブでキーボード操作にも対応するため、`<img>`に直接`role="button"`を付けるのではなく`<button>`でラップする方針にした。`<img>`はHTML仕様上インタラクティブでない要素であり、biomeのa11yルール（`useSemanticElements`）もこれを指摘した）とし、内側に`<img>`を配置する

