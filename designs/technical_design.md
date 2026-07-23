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
- アクティビティの取得には詳細API（`GET /activities/{id}`、1ログにつき1リクエスト）を使い、常に高解像度の軌跡を取得する。一覧APIが返す簡略化された軌跡（低解像度）は使用しない
- 取得した軌跡（`path`）は、隣接する2点間の距離が10km以上離れている箇所（トンネル内・フェリー乗船中等の測定不能区間）で複数の区間に分割して保持する
  - 距離の算出はHaversine公式（大圏距離）を用いる（`splitPathAtJumps`、`backend/src/activities/split-path-at-jumps.util.ts`）
  - 分割した結果2点未満（線を描画できない孤立した1点）になった区間は除外する
  - DBの`path`列は単一の線（PostGIS `geometry(LineString,4326)`）ではなく、複数の線をまとめて持てる`geometry(MultiLineString,4326)`として保持する（マイグレーション`1720800000000-ChangeCyclingActivitiesPathToMultiLineString`）
  - この分割は詳細API呼び出し時（`toCyclingActivityEntityFromDetail`）に行われるため、バックフィル・フォースリフェッチ・新規アクティビティ取得のいずれも、対象アクティビティの詳細取得を行うタイミングで共通して適用される
  - フロントエンドの`path`型は区間ごとの座標配列の配列（`[number, number][][]`）であり、地図描画は`MultiLineString`ジオメトリとして行う（`cyclingActivityToGeoJson`）

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
  - `categorizeStyleLayer`が`place`ソースレイヤーをadmin-boundaryへ分類する対象（`ADMIN_PLACE_LABEL_LAYER_IDS`）は当初`label_state`/`label_city`/`label_city_capital`/`label_town`/`label_village`のみで、`label_other`（使用中のOSMベーススタイル`https://tiles.openfreemap.org/styles/liberty`で、`class`が`city`/`continent`/`country`/`state`/`town`/`village`のいずれにも該当しない`place`地物＝suburb/hamlet/neighbourhood等、大字・字等それより細かい地名に相当を描画するレイヤー）が含まれていなかった。そのため過去年代を表示中でも`label_other`が`resolveUnusedAdminBoundaryLayerIds`の対象に含まれず非表示にならず、現在の大字・字等の地名が表示され続ける不具合があった（Issue #78）。`ADMIN_PLACE_LABEL_LAYER_IDS`へ`label_other`を追加することで解消した（新規のレイヤーIDや処理を追加せず、Issue #67で実装済みの仕組みがそのまま適用される）
- レイヤーダイアログの年代選択（プルダウン）は、レイヤーの表示/非表示と同じ`LayerDialog`内部のdraft state（`draftEra`）が管理し、同じ「実行」ボタンのタイミングで確定する（年代選択のためだけの別ダイアログ・別コンポーネントを設けていない）
- 選択中の年代は`MapWorkspace`から`MapView`（描画用）・`ActivityDetailSidebar`（通過自治体の判定用、`usePassedMunicipalities`経由）の両方へ`adminBoundaryEra`として渡される
- 2026-07時点で投入済みの年代は`current`（2023-01-01）・`2000-10-01`（平成の大合併前）・`1950-10-01`（昭和の大合併前）・`1920-01-01`（大正時代）の4つで、Issue #34が要望する全年代の投入が完了している

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
Issue #23「写真閲覧機能」の実現方式として、Google Photos APIの直接連携ではなくGoogle Takeout（増分エクスポート）＋Google Drive経由の取り込み方式を採用した（詳細な調査経緯・GCP設定はIssue #23のコメント参照）。以下は、Google Drive上のTakeoutエクスポート（zip）から写真のメタデータをバックエンドのDBへ取り込むパイプラインの設計である。写真閲覧機能そのもののうちサイドバーのグリッド表示は実装済み（後述）、地図上の吹き出し表示は未実装である。

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
- 地図上の吹き出し表示（位置情報をもとにした表示、Issue本文の要望）は本対応の対象外で未実装

## 写真ローカルフラット化ツール
Google Takeoutで一括ダウンロードした写真をローカルへ展開すると、アルバム単位・年月単位等でディレクトリが細かくネストされた状態になる。既存写真の一括取り込み（写真ローカルバックフィル、別途対応）は入力としてサブディレクトリの無い1つのフラットなディレクトリを前提とするため、ネストされた展開データをフラット化する前処理ツール`backend/src/photos/flatten-local-photo-directory.ts`（`pnpm --filter backend run flatten:photos-local -- <展開済みディレクトリ> <出力先ディレクトリ>`）を用意した。

- `seed-municipalities.ts`と同様、DIコンテナを経由しない独立スクリプトとして実装（DB接続も不要な純粋なファイル操作のため、`DataSource`の初期化も行わない）。
- 対象ディレクトリを再帰的に走査し、見つかった全ファイル（写真・JSONサイドカーを問わない）を出力先ディレクトリへコピーする。元のディレクトリ構造・ファイルは変更しない（コピーのみ）。
- Google Takeoutは、1枚の写真が複数のアルバムに属する場合、同一内容のファイルが複数のディレクトリに重複して含まれることがある。ファイル名が衝突した際は内容のSHA-256ハッシュ（`node:crypto`、動画等の大きいファイルでもメモリを圧迫しないようストリームで計算）を比較し、内容が完全に一致する場合は重複とみなしコピーをスキップして1件に集約する。内容が異なる場合は、`mergeMonthlyArchive`（月別アーカイブ内での同名衝突回避）と共通の`resolveUniquePath`（`monthly-archive.util.ts`からexport）で拡張子の直前へ連番（`-2`, `-3`, ...）を付けて別ファイルとして保存する。

## 既存写真の一括取り込み（写真ローカルバックフィル）
`PhotoIngestService.ingest`（`POST /photos/ingest`）はTakeout zip全体を一度にメモリへ展開する方式（`adm-zip`、Buffer型）のため、Node.jsの`Buffer`最大サイズ（64bit環境で約2〜4GB）を超えるzipを扱えない。実データでは1エクスポートあたり最大50GB・複数ファイルという規模になることが判明し、既存写真をまとめて取り込むにはこの方式が使えないことがIssue #23の対応中に分かった（詳細な検討経緯はIssue #23のコメント参照）。この制約に対応するため、ユーザーが事前にTakeout zipを手元で展開し写真本体・JSONサイドカーをサブディレクトリなしの1フラットディレクトリへ集約した上で、それ以降（年月ごとの振り分け・DBへの投入）を自動化する`backend/src/photos/backfill-photos-from-local.ts`（`pnpm --filter backend run backfill:photos-local -- <ディレクトリパス>`）を用意した。

- `seed-municipalities.ts`と同じ「NestJSのDIコンテナを経由せず、`DataSource`・各サービスを手動で`new`してスクリプトから直接呼び出す」パターンで実装しており、スクリプト本体（オーケストレーション部分）に対する専用の単体テストは持たない（本プロジェクトの既存の方針を踏襲）。分割等の純粋なロジック（`splitPhotosIntoSizedParts`）は個別のutil関数として切り出し、そちらには単体テストがある
- `PhotoIngestService.ingest`とロジックを重複させないよう、以下の2つの関数を`PhotoIngestService`から切り出し・`takeout-metadata.util.ts`へ移設し、両方から共通で呼び出す形にした
  - `resolvePhotoMetadata`（`takeout-metadata.util.ts`）: JSONサイドカー優先・EXIFフォールバックでのメタデータ解決
  - `toPhotoEntity`（`photo-ingest.service.ts`からexport）: 月別アーカイブへの振り分け結果から`PhotoEntity`を組み立てる処理
- 処理は以下の3段階で行い、いずれの段階でも全写真の実バイナリを同時にメモリへ保持しないようにしている
  1. `scanLocalPhotoDirectory`（`local-photo-directory.util.ts`）がディレクトリを走査し、ファイル名のみで写真本体・JSONサイドカーへ分類する（写真本体側の`data`はプレースホルダの空Bufferとし、実バイナリは`readLocalPhotoData`で必要になった時点まで読み込まない）。`matchPhotosWithJsonSidecars`によるファイル名マッチング自体はパスのみを見るため、この時点で問題ない
  2. マッチした写真ごとに`resolvePhotoMetadata`でメタデータを解決する。写真本体は`createLazyPhotoData`（`local-photo-directory.util.ts`）でdataへのアクセスを遅延させたエントリとして渡し、JSONサイドカーで解決できた場合は写真本体に一切アクセスしない。JSONが無い・不正な場合のEXIFフォールバックで実際にdataへアクセスされた時点で初めて`readFileSync`が実行される
     - 当初は全件を`readLocalPhotoData`で無条件に読み込んでからメタデータ解決していたが、数万件規模（外付けHDD、動画含む）での実行時にJSONで解決できる大多数の写真についても不要な読み込みが発生し実行時間が大きく伸びていたことが判明したため、遅延読み込みへ変更した（Issue #23）
  3. `groupPhotosByYearMonth`で年月ごとにグループ化した後、月ごとに1グループずつ、さらに`splitPhotosIntoSizedParts`（`split-photos-into-sized-parts.util.ts`）で`MAX_ARCHIVE_PART_SIZE_BYTES`（1GiB）ごとの複数「part」へ分割し、partごとに（`MonthlyPhotoArchiveService.reorganize`は`[group]`という単一要素の配列で呼び出す）該当写真の実バイナリを読み込み、月別アーカイブへの振り分け・Google Driveへのアップロード・`photos`テーブルへの保存を行う
    - 当初は1つの年月の全写真を1回の`reorganize`呼び出し（1つのzip）にまとめて処理していたが、動画を多数含む月（実データで写真729件・約16.6GiB）では、元データ（`readLocalPhotoData`で読み込んだBuffer群）とzip化後のバッファ（`AdmZip.toBuffer()`が生成する結合済みBuffer）を同時に保持する必要があり、ピークメモリ使用量が実行環境の物理メモリ（実機は16GB）を大きく超えてプロセスがエラーも出さないまま強制終了される不具合が実際に発生した（後述の`GoogleDriveApiClient`のtimeout追加後も再発したことで、ネットワークハングではなくメモリ不足が真因と判明。Issue #23）。対応として、1つの年月を1GiBごとの複数partへ分割し、それぞれ独立したzipとして処理することでピークメモリ使用量を抑えた
    - `monthly_photo_archives`は`(year_month, part)`の組で一意（マイグレーション`AddPartToMonthlyPhotoArchives`）とし、1つの年月が複数のzipファイル（Google Drive上は`2026-01.zip`・`2026-01-part2.zip`・...のように命名）にまたがることを許容する。`photos`テーブル側は`source_file_id`が具体的にどのzipファイルを指すかを個別に保持しているため、1つの年月が複数zipに分かれていても写真の検索・取得（撮影年月とは無関係に`taken_at`で行う）には影響しない
    - 本対応より前（`part`列導入前）に作成された既存行は、分割という概念が存在しなかった時代に「その年月の全写真を含む唯一のzip」として作成されたものであるため、マイグレーションで`part = -1`（`LEGACY_WHOLE_MONTH_PART`）を設定し、サイズに関わらず常に処理済み（丸ごとスキップ対象）として扱う。これにより、既存の大容量な月（1GiB超）を新方式で誤って再分割・重複アップロードしてしまうことを防いでいる
- 対象件数が多いと全体の実行に長時間かかるため、途中で中断され再実行された場合の重複登録を避ける目的で、以下の2段階でスキップ判定を行う
  1. `monthly_photo_archives`に`part = -1`（`LEGACY_WHOLE_MONTH_PART`）のレコードがある年月（＝本対応より前に一括で処理済みの月）は丸ごとスキップする
  2. それ以外の年月は、`(year_month, part)`ごとに既にレコードがあるpartをスキップし、無いpartのみ処理する
  `reorganize`・`mergeMonthlyArchive`は同名ファイルの衝突を「別写真」として連番を付けて共存させる設計（既存アーカイブへの追記を前提とする通常の取り込みパイプラインでは正しい挙動）のため、スキップせず再実行すると同一写真が重複登録されてしまう。この対策はpart単位の粒度であり、1つのpartの処理途中（Driveへのアップロード直後〜DB保存の間等）で中断された場合はレコードが無い・不完全な状態になりうるため自動スキップされず再処理される（必要に応じて手動確認が必要）
- アクセストークンは全体で1回だけ取得するのではなく月のグループごとに取得し直す。対象件数が多く実行が長時間に及ぶとアクセストークンが途中で失効しうるため（`GoogleDriveAuthService`は有効期限内であればキャッシュを返すため、都度呼び出すコストは小さい）
- Node.jsの`fs.readFileSync`は実行環境のメモリ量に関わらず2GiB（`2 ** 31 - 1`バイト）を超えるファイルを読み込めない（`RangeError: File size is greater than 2 GiB`）。実際に約55,000件規模のGoogle Photosライブラリ（動画を含む）で2.5GB超の動画ファイルにより発生した。段階2でメタデータ解決のため写真1件分の実バイナリを読み込む直前に`statSync`でファイルサイズを確認し、上限を超える場合は読み込み自体を試みずスキップする（`skippedTooLargePaths`としてカウントし、完了時にパス一覧を出力。段階3では既にメタデータ解決の時点で除外済みのため到達しない）
- スクリプト内のログ出力は`console.log`ではなく`fs.writeSync`による同期出力（`log`ヘルパー関数）を使う。`console.log`は標準出力がパイプ（`tee`等）へ接続されている場合Node.jsによって非同期にバッファリングされることがあり、プロセスが外部要因（ネットワークハング等）で停止した場合にバッファ済みだが未フラッシュの行が失われ、どこまで進行したか実行ログから追跡できなくなる問題が実際に発生したため（Issue #23）。あわせて、月グループの処理開始時に写真件数・合計バイト数をログ出力し、Google Driveへの振り分け・アップロード完了時にも完了ログを出す（どの月のどの段階で停止したか特定できるようにするため）
