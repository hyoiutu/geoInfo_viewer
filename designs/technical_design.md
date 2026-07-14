# geo_info_viewer 設計書

本ファイルは、[specs/system_specification.md](../specs/system_specification.md)に記載された仕様を実現するための、技術スタック・データモデル・アルゴリズム・処理フロー等の実装上の設計を記載する。ユーザーから見た機能・挙動そのものは仕様書を参照。

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
- レイヤONのタイミングでStrava APIを呼び出し、前回の切り替えからアクティビティログが更新されていないかチェックし、更新されていれば、バックエンドのDBを更新した上でフロントエンドの地図上に自転車ログを表示する（`ActivitiesService.sync()`）
  - Strava のAPIトークンは6時間で失効するため、失効していた場合リフレッシュトークンを使ってAPIトークンを更新する（`StravaAuthService`）
- アクティビティの取得には詳細API（`GET /activities/{id}`、1ログにつき1リクエスト）を使い、常に高解像度の軌跡を取得する。一覧APIが返す簡略化された軌跡（低解像度）は使用しない
- 取得した軌跡（`path`）は、隣接する2点間の距離が10km以上離れている箇所（トンネル内・フェリー乗船中等の測定不能区間）で複数の区間に分割して保持する
  - 距離の算出はHaversine公式（大圏距離）を用いる（`splitPathAtJumps`、`backend/src/activities/split-path-at-jumps.util.ts`）
  - 分割した結果2点未満（線を描画できない孤立した1点）になった区間は除外する
  - DBの`path`列は単一の線（PostGIS `geometry(LineString,4326)`）ではなく、複数の線をまとめて持てる`geometry(MultiLineString,4326)`として保持する（マイグレーション`1720800000000-ChangeCyclingActivitiesPathToMultiLineString`）
  - この分割は詳細API呼び出し時（`toCyclingActivityEntityFromDetail`）に行われるため、初期取り込み・強制再取得・更新API呼び出しのいずれも、対象アクティビティの詳細取得を行うタイミングで共通して適用される
  - フロントエンドの`path`型は区間ごとの座標配列の配列（`[number, number][][]`）であり、地図描画は`MultiLineString`ジオメトリとして行う（`cyclingActivityToGeoJson`）

# 自転車ログフィルタリング機能
- 仕様書記載のフィルタ条件（年月・獲得標高・平均時速・走行距離）はフロントエンドの純粋関数`filterActivities`・バリデーション関数`isActivityFilterValid`（`frontend/src/utils/filterActivities.ts`）で実現する
- ダイアログの入力中（draft）状態と実際に地図へ適用される状態（applied）は`useActivityFilter`フックで分離管理し、「実行を押したときのみ確定し、閉じるボタンでは破棄され、再度開いたときは直近の適用内容を復元する」という挙動を実現する
- フィルタで除外され地図上に表示されなくなったアクティビティの選択・フォーカス解除は、`useActivitySelection`の`pruneToVisible(visibleIds)`で実現する。`MapWorkspace`がフィルタ適用後の表示対象ID集合を`useMemo`で求め、変化のたびに`pruneToVisible`を呼ぶ

# 自転車ログ初期取り込み機能
- Stravaのレート制限は「非アップロード系エンドポイント: 15分あたり100リクエスト」を採用し、リクエスト間隔を9秒（15分 ÷ 100 = 9秒、`StravaRateLimiterService`）に固定してペーシングする
- 実行中フラグ（`ActivitiesBackfillService`の`running`）はインメモリ管理とする（DBには永続化しない）。バックエンドが再起動した場合はフラグがリセットされ、ユーザーが再度ボタンを押すことでDB上の未取得分から再開する
- 一覧取得は1ページあたりの最大件数でページングし、空のページが返るまで取得を繰り返すことで全件を取得する
- GPSルートの無い（手動記録等の）アクティビティを「未取得」と誤判定しないよう、詳細取得が完了した時刻（`detailFetchedAt`）を保持する列を設け、この列の有無で取得済みかどうかを判別する（軌跡データ自体の有無では判別しない）

# アクティビティ詳細閲覧機能
- 自転車ログの線は太さ3pxと細く正確なクリックが難しいため、クリック地点を中心とした10px四方（片側5px）のバウンディングボックス内に描画されているアクティビティをヒットテストで検出する（`registerBicycleLogClickHandler`、`MapView.tsx`）
- 選択中・フォーカス中のアクティビティの描画は、通常・選択用・フォーカス用の3つの独立したGeoJSONソース・レイヤーを用意し、追加した順（＝描画順）で「通常 < 選択中 < フォーカス中」の手前関係を実現する（`applySelectionLayers`）
- スタート・ゴールマーカーは`lucide-react`のアイコン（スタート: `Play`、ゴール: `Flag`）を`react-dom/server`の`renderToStaticMarkup`で静的にレンダリングし、`maplibregl.Marker`のDOM要素として表示する（`createStartMarkerElement`/`createGoalMarkerElement`）
  - 開始地点と終了地点が同じ座標の場合に手前へ描画されるよう、ゴールのマーカーを先に、スタートのマーカーを後に地図へ追加する（MapLibreの`Marker`はDOM要素として描画されるため、後から追加した方がDOM上で後に来ることを利用している）

# 通過自治体表示機能
- 全国の市区町村境界データ（[政府統計の総合窓口(e-Stat)地図で見る統計(統計GIS)提供の市区町村界データ、GeoShapeリポジトリ、2023-01-01時点、高解像度版、政令指定都市統合版ではない方](https://geoshape.ex.nii.ac.jp/city/choropleth/)）をバックエンドのDB（`municipalities`テーブル、PostGIS）へ投入しておく（`pnpm --filter backend run seed:municipalities`、詳細はREADME.md参照）
  - 政令指定都市の区は、国土数値情報(N03)のプロパティ`N03_003`（市名）+`N03_004`（区名）を連結し「市名+区名」（例: 横浜市中区）として保持する
- 逆ジオコーディングは、アクティビティの軌跡（GPSトラック）をPostGISの`ST_Segmentize`で約100m間隔にサンプリングし、`ST_DumpPoints`で座標点を取り出した上で`ST_Contains`により自治体ポリゴンとの空間結合を行う方式で実装する（`MunicipalitiesService.findPassedMunicipalities`）。全てのGPSポイントに対して逆ジオコーディングすると負荷が高いため間隔を空けてサンプリングする
- 一覧の並び順は、`ST_DumpPoints`が返すサンプリング点の`path`（軌跡上の並び順）を用いて、自治体ごとに最初に通過した時点の`path`値で`DISTINCT ON`し、その値順に並べ替えることで実現する
- 海外を通過した区間の除外は、明示的な国内/海外判定ロジックを追加せず、「`municipalities`テーブルが日本国内のデータのみを保持しているため、海外の区間のサンプリング点はどの自治体にも`ST_Contains`で一致せず、結果として自動的に除外される」という間接的な方式で実現している

# エラーハンドリング機構
## バックエンド
- 全エンドポイントは、エラー発生時のレスポンスボディを`{ errorCode, message, hint }`形式（`AppErrorInfo`）に統一する
  - `errorCode`: `STRAVA_AUTH_FAILED`（Strava認証失敗）・`STRAVA_RATE_LIMITED`（Strava APIレート制限）・`STRAVA_API_ERROR`（その他のStrava API通信エラー）・`INTERNAL_ERROR`（DBエラー等、上記以外の予期しないエラー）の4種類
- 上記の統一形式は、NestJSのグローバル例外フィルタ`AllExceptionsFilter`によって実現する。個別のエンドポイント・サービスは意図的に投げる例外を`AppException`として扱い、フィルタがこれをそのままレスポンスボディとして返す。それ以外の予期しない例外は`INTERNAL_ERROR`として整形して返す
- Strava API呼び出し（`StravaAuthService`・`StravaActivitiesService`）は、axiosのエラーレスポンスのHTTPステータス（401→認証失敗、429→レート制限、それ以外→通信エラー）に応じて、変換関数`toStravaApiException`（`common/errors/strava-api.exception.ts`）で`AppException`へ変換して投げる。`toStravaApiException`は独立した例外クラスではなく、axiosエラーを判定して適切な`AppException`インスタンスを組み立てる純粋関数である。console.logでの記録や、エラーを握りつぶしてfalsyな値を返す実装は行わない
- `POST /activities/sync`は、初期取り込み(バックフィル)実行中のガード（既に実行中のため同期をスキップした場合）に限り`{ success: false }`をエラーではない200レスポンスとして返す。それ以外の失敗（Strava APIエラー等）は例外として投げ、上記のエラーレスポンス形式で返す
- 初期取り込み(バックフィル)は非同期のfire-and-forget処理であるため、実行中に発生したエラーはHTTPレスポンスとしては返せない。代わりに直近のエラーを`lastError`としてサービス内に保持し、`GET /activities/backfill/status`のレスポンスに含めることで、ポーリングしているフロントエンドが参照できるようにする。新たに`start()`が呼ばれた時点で`lastError`はリセットされる

## フロントエンド
- APIレスポンスが異常な場合、レスポンスボディを`AppErrorInfo`としてパースし、`ApiError`（`errorCode`/`hint`を保持する`Error`のサブクラス）としてthrowする
- エラー状態はJotaiの`errorsAtom`（グローバルステート）でアプリ全体から共有される配列（スタック）として一元管理する。API呼び出し等でエラーが発生しうる箇所（`MapView`・`useBackfillStatus`・`usePassedMunicipalities`）は、`useErrorReporter`フックを直接呼び出してエラーを追加する（`onError`のようなpropsのバケツリレーを行わない。詳細はIssue #28・[class_diagram.md](./class_diagram.md)参照）
- `ErrorDialog`（Chakra UIの`Dialog`コンポーネントを使用）は`errorsAtom`を直接参照・更新し、`message`と`hint`を表示する
  - 複数のエラーが発生した場合、後から発生したエラーが先発のエラーを上書きすることはない（`errorsAtom`は配列末尾に追加するのみ）。1つのダイアログ内で「前へ/次へ」ボタンによりスタックされた各エラーを切り替えて閲覧でき、件数が2件以上の場合はタイトルに現在の位置を表示する。「OK」ボタンは現在表示中のエラーのみを`errorsAtom`から取り除く
