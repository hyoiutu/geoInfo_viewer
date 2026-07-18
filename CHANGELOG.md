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

### [2026-07-18] Issue #23対応としてGoogle Drive連携のGCP設定を検証するバックエンドモックを実装した
* **修正の動機・概要**:
  - Issue #23のコメントで固まった方針（Google Takeoutの増分エクスポート→Google Drive経由での取り込み、`drive.file`スコープ＋Google Picker API採用、GCP側の設定完了）を踏まえ、実際にバックエンドからDrive APIでファイルを取得できるか（GCP設定が機能しているか）を検証するためのモック実装。ユーザーからの直接依頼により対話モードで着手した。
  - `StravaAuthService`/`StravaApiClient`（Issue #52でクライアント抽象化済み）と同型の構成（`GoogleDriveAuthService`: アクセストークンのキャッシュ・失効判定・リフレッシュ、`GoogleDriveApiClient`: 生のHTTPアクセスとエラー変換）を踏襲した。GoogleのトークンレスポンスはStravaの`expires_at`（epoch秒）と異なり`expires_in`（有効期間の秒数）を返すため、`GoogleDriveAuthService`側で現在時刻に加算して失効日時を算出する点のみ異なる。
  - 検証用エンドポイント`GET /google-drive/files/:fileId`を用意し、指定したDriveファイルのメタデータ取得とバイナリダウンロードの両方を行い、メタデータの`size`と実際にダウンロードできたバイト数が一致するか（`sizeMatches`）を返すことで、GCP設定・OAuth・スコープが正しく機能しているかを確認できるようにした。
  - issue-reviewスキルでのレビューにより「外部サービス連携の認証情報が未整備」という懸念（過去のIssue #23レビューで一度WIPスキップの理由になったもの）を検出。対話モードのため`AskUserQuestion`でユーザーに確認し、`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REFRESH_TOKEN`が必要である旨を提示した上で着手した（実際の値は本対応に含まず、ユーザーが別途`.env`へ設定する）。
  - 対話モードでの確認により、今回のスコープはバックエンドのみとし、フロントエンドのGoogle Identity Services／Google Picker UIの組み込みは対象外とした。
  - 実装中、`biome check --write`によるDIコンストラクタ注入importの`import type`誤変換の罠（typescript_rules.md記載、PR #64でも一度発生した既知の問題）が、`google-drive`配下の新規ファイルだけでなく、ディレクトリ全体に対する実行だったため既存の`strava`/`activities`/`municipalities`配下の複数ファイルにも再発した。各ファイルを個別に確認し通常の`import`へ戻すことで解消した。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `backend/src/google-drive/`配下を新規追加: `google-drive.constants.ts`・`google-drive-api.client.ts`・`google-drive-auth.service.ts`・`google-drive-files.service.ts`・`google-drive.controller.ts`・`google-drive.module.ts`・`types/google-drive.type.ts`・`types/google-drive-file-info.dto.ts`（各`__tests__`含む）。
    - `backend/src/common/errors/google-drive-api.exception.ts`（新規）・`app-error-code.constants.ts`に`GOOGLE_DRIVE_AUTH_FAILED`/`GOOGLE_DRIVE_FILE_NOT_FOUND`/`GOOGLE_DRIVE_RATE_LIMITED`/`GOOGLE_DRIVE_API_ERROR`を追加。
    - `backend/.env.example`に`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REFRESH_TOKEN`を追加。
    - `backend/src/app.module.ts`に`GoogleDriveModule`を登録。
    - 単体テスト（TDD、Red→Green、新規19件）・lint・typecheckは全てGreen。
  * **README.md**: 変更なし。
  * **仕様書**: 変更なし（ユーザーから見た機能はまだ無く、GCP設定を検証するための内部実装のため）。
  * **設計書**: 変更なし。フロントエンドのPicker UI・アクティビティ日時に基づく写真検索等を含む本実装が固まった段階で、「写真閲覧機能」の章としてまとめて`designs/technical_design.md`へ反映する方針とした。

### [2026-07-17] Issue #52対応としてStrava APIクライアントを抽象化した
* **修正の動機・概要**:
  - `designs/class_diagram.md`（Issue #29対応）の設計上の改善提案3件目として指摘されていた、`StravaActivitiesService`/`StravaAuthService`が`HttpService`（axiosの薄いラッパー）に直接依存している問題を解消した（Issue #52）。自律モードで対応した。
  - `StravaApiClient`（新規）を切り出し、HTTPリクエストの組み立て・実行と、エラーのAppExceptionへの変換（`toStravaApiException`）のみをその責務とした。認証トークンのキャッシュ・ページング・アクティビティ種別によるフィルタリング等の業務ロジックは、引き続き`StravaActivitiesService`/`StravaAuthService`側に残した。
  - Issueの例では`firstValueFrom(this.getStravaActivitiesByMaxPage(page))`のようにObservableを返す薄いラッパーメソッドが示されていたが、実装時にはPromiseを返す高レベルなメソッド（`getActivities`/`getActivityDetail`/`refreshToken`）として設計した。理由: 各呼び出し箇所で重複していた`try/catch`+`toStravaApiException`変換もクライアント内に集約でき、DRY原則の観点でも呼び出し側がより簡潔になるため。
  - 実装中、`biome check --write`によりDIコンストラクタ注入で使うクラス（`HttpService`・`ConfigService`・`StravaApiClient`・`StravaAuthService`・`StravaRateLimiterService`）のimportが`import type`へ誤変換される既知の罠（typescript_rules.md記載）が再発した。単体テスト実行前に気づき、該当箇所を通常の`import`に手動で戻して解消した。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `backend/src/strava/strava-api.client.ts`（新規）・`__tests__/strava-api.client.tests.ts`（新規、9件）。
    - `backend/src/strava/strava-activities.service.ts`・`strava-auth.service.ts`: `HttpService`の直接注入を`StravaApiClient`経由に置き換え。振る舞いは変更していない（既存テストのモック先を`HttpService`から`StravaApiClient`へ差し替え、TDDのRed→Greenで確認）。
    - `backend/src/strava/strava.module.ts`: providersに`StravaApiClient`を追加。
    - 単体テスト（バックエンド）・lint・typecheck・`check:type-assertions`は全てGreen。
  * **README.md**: 変更なし。
  * **仕様書**: 変更なし（内部実装のリファクタリングのみで、ユーザーから見た挙動に変化は無いため）。
  * **設計書**: `designs/class_diagram.md`に`StravaApiClient`クラスを追記し、改善提案3件目を「対応済み」に更新。

### [2026-07-17] Issue #34対応(フェーズ2)として行政区画レイヤーに過去年代(1920年・大正時代)を追加し、Issue #34が要望する全年代の投入を完了した
* **修正の動機・概要**:
  - PR #63（1950-10-01の投入）に続き、Issue #34が要望する最後の年代である1920-01-01（大正時代）を追加投入した。パイプラインは年代非依存に一般化済みのため、年代識別子の追加（バックエンド・フロントエンド）とシード実行のみで完結する変更となった。
  - `MUNICIPALITY_ERA_TAISHO`（値: `'1920-01-01'`）を追加。この年代は「〇〇の大合併前」という合併起点の呼び方ではなく単純に「大正時代」を指すため、既存の`MUNICIPALITY_ERA_PRE_HEISEI_MERGER`/`MUNICIPALITY_ERA_PRE_SHOWA_MERGER`とは異なり`_PRE_..._MERGER`という命名パターンを踏襲せず、Issueの表現に合わせた名前とした。
  - `seed:municipalities`を再実行し全国47都道府県分のデータを投入した（投入結果: `current` 1,917件、`2000-10-01` 3,372件、`1950-10-01` 10,562件、`1920-01-01` 12,235件。時代を遡るほど市区町村数（当時の町村単位）が増加する傾向と整合する）。
  - これによりIssue #34「歴史的行政区画表示機能」が要望する3年代（2000-10-01・1950-10-01・1920-01-01）全ての投入・表示・通過自治体連動が完了したため、本PRのマージ後にIssue #34をクローズする。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - バックエンド: `backend/src/municipalities/era.constants.ts`に`MUNICIPALITY_ERA_TAISHO`を追加し`MUNICIPALITY_ERAS`へ追記、`seed-municipalities.ts`の`TOPOJSON_DATE_BY_ERA`に`'1920-01-01': '19200101'`を追加。
    - フロントエンド: `frontend/src/types/municipalityEra.ts`の`MunicipalityEra`型・`MUNICIPALITY_ERAS`に追記、`constants/municipalityEraOptions.ts`の`MUNICIPALITY_ERA_OPTIONS`に「1920年(大正時代)」の選択肢を追加。
    - 単体テスト（バックエンド・フロントエンド）・lint・型チェック・`check:type-assertions`は全てGreen。DBへの投入（`pnpm run seed:municipalities`）も実行し成功を確認。
  * **README.md**: 通過自治体データ・行政区画データの投入手順の節で、投入対象の年代に1920-01-01を追記。
  * **仕様書**: `specs/system_specification.md`のレイヤ切り替え機能節のプルダウン選択肢に「1920年〈大正時代〉」を追記。
  * **設計書**: `designs/technical_design.md`の「行政区画レイヤー（年代選択）」節の投入済み年代一覧を更新し、Issue #34が要望する全年代の投入完了を明記。

### [2026-07-17] Issue #34対応(フェーズ2の一部)として行政区画レイヤーに過去年代(1950年・昭和の大合併前)を追加した
* **修正の動機・概要**:
  - PR #62（2000-10-01の投入）でパイプライン（DBスキーマ→シード→REST API→フロントエンド描画→年代選択UI→通過自治体連動）の動作検証が完了したため、Issue #34フェーズ2の残り年代のうち1950-10-01（昭和の大合併前）を追加投入した。パイプライン自体は年代非依存に一般化済みのため、年代識別子の追加（バックエンド・フロントエンド）とシード実行のみで完結する変更となった。
  - `MUNICIPALITY_ERA_PRE_SHOWA_MERGER`（値: `'1950-10-01'`）を`MUNICIPALITY_ERA_PRE_HEISEI_MERGER`と同じ命名パターンで追加し、`seed:municipalities`を再実行して全国47都道府県分のデータを投入した（投入結果: `current` 1,917件、`2000-10-01` 3,372件、`1950-10-01` 10,562件。市区町村数が合併の進行に伴い減少している傾向と整合する）。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - バックエンド: `backend/src/municipalities/era.constants.ts`に`MUNICIPALITY_ERA_PRE_SHOWA_MERGER`を追加し`MUNICIPALITY_ERAS`へ追記、`seed-municipalities.ts`の`TOPOJSON_DATE_BY_ERA`に`'1950-10-01': '19501001'`を追加。
    - フロントエンド: `frontend/src/types/municipalityEra.ts`の`MunicipalityEra`型・`MUNICIPALITY_ERAS`に追記、`constants/municipalityEraOptions.ts`の`MUNICIPALITY_ERA_OPTIONS`に「1950年(昭和の大合併前)」の選択肢を追加。
    - 単体テスト（バックエンド・フロントエンド）・lint・型チェック・`check:type-assertions`は全てGreen。DBへの投入（`pnpm run seed:municipalities`）も実行し成功を確認。
  * **README.md**: 通過自治体データ・行政区画データの投入手順の節で、投入対象の年代に1950-10-01を追記。
  * **仕様書**: `specs/system_specification.md`のレイヤ切り替え機能節のプルダウン選択肢に「1950年〈昭和の大合併前〉」を追記。
  * **設計書**: `designs/technical_design.md`の「行政区画レイヤー（年代選択）」節の投入済み年代一覧を更新（`1950-10-01`を投入済みに、未投入は`1920-01-01`のみに）。

### [2026-07-17] PR #62のレビュー対応として過去年代の行政区画レイヤーにminzoomを設定した
* **修正の動機・概要**:
  - PR #62（Issue #34フェーズ2）のレビューで、実機（Electronアプリ）で動作確認したところ「ズームレベルを下げても行政区画（過去年代）が計算され続ける」という指摘を受けた。現行年代の市町村境界（`admin-boundary-municipality`）には元々`ADMIN_BOUNDARY_MUNICIPALITY_MIN_ZOOM`（低ズームでの過密表示・不要な計算を避けるための閾値）が設定されていたが、過去年代用に新規追加した塗り・線・ラベルの3レイヤーには同等の設定が漏れていた。
  - 同じ閾値定数を過去年代の3レイヤーにも設定し、都道府県境界より広域なズームでは行政区画（現行・過去年代とも）が描画・計算されないよう統一した。
* **各ファイルへの影響と変更内容**:
  * **実装**: `frontend/src/utils/mapLayerSetup.ts`の`addAdminBoundaryHistoricalLayer`が追加する塗り(`fill`)・線(`line`)・ラベル(`symbol`)の3レイヤー全てに`minzoom: ADMIN_BOUNDARY_MUNICIPALITY_MIN_ZOOM`を追加。対応するテスト（`mapLayerSetup.tests.ts`）も更新。単体テスト・lint・型チェックは全てGreen。
  * **README.md**: 変更なし。
  * **仕様書**: 変更なし（ユーザーから見た挙動は「低ズームで行政区画が表示されない」という既存仕様の延長で、新たな仕様追加ではないため）。
  * **設計書**: `designs/technical_design.md`の「行政区画レイヤー（年代選択）」節に、過去年代レイヤーのminzoom設定を追記。

### [2026-07-17] Issue #34対応(フェーズ2の一部)として行政区画レイヤーに過去年代(2000年)選択機能を追加した
* **修正の動機・概要**:
  - Issue #34「歴史的行政区画表示機能」のフェーズ2（過去3時代の行政区画データ導入・年代選択UI・通過自治体の年代連動）のうち、まず1年代分（2000-10-01、平成の大合併前）のパイプラインを通し、年代選択UI・地図描画・通過自治体連動まで一通り動作することを検証する方針とした（ユーザーとの相談の上、3年代を一度に投入せず段階的に進める判断）。1950-10-01・1920-01-01は`MUNICIPALITY_ERAS`に追記し`seed:municipalities`を再実行するだけで追加できる設計にしてあり、別途対応する。
  - 過去の行政区画データは、既存の`municipalities`テーブル（現行データ用、Issue #18）に`era`列を追加し同じテーブルに複数年代分を格納する方針とした（新規テーブルへ分離する案もあったが、通過自治体判定のクエリが1テーブルで完結する方を採用）。
  - 現行データはOSMのベクトルタイル（Issue #34フェーズ1でPR #59により実装済み）をそのまま使えるが、過去データにはベクトルタイルが存在しないため、バックエンドAPI（`GET /municipalities/boundaries?era=...`）経由でGeoJSONを取得しMapLibreのGeoJSONソースとして描画する方式を採用した。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - バックエンド: `backend/src/migrations/1720900000000-AddEraToMunicipalities.ts`（新規、`municipalities`テーブルに`era`列+インデックス追加）、`MunicipalityEntity`に`era`列追加、`backend/src/municipalities/era.constants.ts`（新規、年代識別子の定義・検証）、`seed-municipalities.ts`（年代ごとに洗い替えるよう一般化、現行+2000-10-01を投入）、`MunicipalitiesService`に`findBoundariesByEra`追加・`findPassedMunicipalities`にera引数追加、`MunicipalitiesController`（新規、`GET /municipalities/boundaries`）、`ActivitiesController.getPassedMunicipalities`にeraクエリパラメータ追加。
    - フロントエンド: `frontend/src/types/municipalityEra.ts`・`constants/municipalityEraOptions.ts`（新規）、`useLayerVisibility`に`draftEra`/`appliedEra`/`setDraftEra`を追加（レイヤー表示状態と同じダイアログ・同じ「実行」タイミングで確定）、`LayerDialog`に年代選択プルダウンを追加、`frontend/src/api/municipalitiesApi.ts`（新規）、`mapLayerSetup.ts`に`addAdminBoundaryHistoricalLayer`/`applyAdminBoundaryHistoricalData`を追加（GeoJSONソース+塗り・線・ラベルの3レイヤー、年代ごとのキャッシュ付き）、`mapLayerCategory.ts`の`resolveStyleLayerIds`をera対応に拡張、`MapView`に`adminBoundaryEra`プロパティ追加、`usePassedMunicipalities`・`ActivityDetailSidebar`にera引数を追加し`MapWorkspace`から選択中の年代を配線。
    - 単体テスト（バックエンド・フロントエンド）・lint・型チェックは全てGreen。E2Eテストも実行し回帰が無いことを確認。
  * **README.md**: 通過自治体データの投入手順の節を、行政区画データ（過去年代含む）の投入手順として更新。年代ごとの洗い替えである旨を明記。
  * **仕様書**: `specs/system_specification.md`のレイヤ切り替え機能節に行政区画の年代選択プルダウンを追記、通過自治体表示機能節に選択中年代との連動を追記。`specs/glossary.md`に「年代（行政区画の）」の用語定義を追加。
  * **設計書**: `designs/technical_design.md`の通過自治体表示機能節を`era`列・年代引数対応に更新し、新規「行政区画レイヤー（年代選択）」節を追加。`designs/class_diagram.md`に`MunicipalitiesController`クラス・`MunicipalityEntity.era`・関連メソッドのera引数を追記。

### [2026-07-16] Issue #50対応としてActivitiesServiceとActivitiesBackfillServiceの共通DBアクセスをCyclingActivityRepositoryへ一本化した
* **修正の動機・概要**:
  - `designs/class_diagram.md`（Issue #29対応）の設計上の改善提案1件目としてIssue化されていた「`ActivitiesService`と`ActivitiesBackfillService`がいずれも`StravaActivitiesService`と`CyclingActivityEntity`のRepositoryに直接依存しており、Strava詳細取得→Entity変換→DB保存という同じ手順を別々の場所で呼び出している」という重複を解消した。
  - 両サービスが共通で使う`CyclingActivityRepository`（`backend/src/activities/cycling-activity.repository.ts`、新規）を切り出し、`findAll`/`findPendingDetail`/`saveDetail`/`saveDetails`/`savePlaceholdersIfNotExists`（重複チェック含む）/`resetAllDetailFetchedAt`/`countAll`/`countPendingDetail`/`countCompletedDetail`という高レベルメソッドに集約した。特に`ActivitiesBackfillService`の`fetchAndSavePlaceholders`にのみ存在していた「DB未登録分のみプレースホルダー保存する」重複チェックロジックを`savePlaceholdersIfNotExists`として一本化し、Issue本文が挙げていた「保存に関する共通処理（重複チェック等）の一本化」を実現した。
  - 実装中、`backend/src/activities`ディレクトリ全体に対して`biome check --write`を実行したところ、NestJSのコンストラクタインジェクションで使うクラス（`StravaActivitiesService`・`ActivitiesBackfillService`・`CyclingActivityRepository`・`MunicipalitiesService`等）のimportが`import type`へ誤変換され、依存性注入が壊れる事故が発生した（`typescript_rules.md`に既知の罠として記載済みだったにもかかわらず再発）。単体テスト実行で即座に検知し、該当ファイル（`activities.service.ts`・`activities-backfill.service.ts`・`activities.controller.ts`）を手動で通常の`import`に戻して解消した。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `backend/src/activities/cycling-activity.repository.ts`（新規）・`__tests__/cycling-activity.repository.tests.ts`（新規、11件）。
    - `backend/src/activities/activities.service.ts`・`activities-backfill.service.ts`: 生の`Repository<CyclingActivityEntity>`直接注入を`CyclingActivityRepository`経由に置き換え。振る舞いは変更していない（既存テストのモック先を`getRepositoryToken(CyclingActivityEntity)`から`CyclingActivityRepository`へ差し替え、TDDのRed→Greenで確認）。
    - `backend/src/activities/activities.module.ts`: providersに`CyclingActivityRepository`を追加。
    - 単体テスト（バックエンド110件）・lint・typecheck・`check:type-assertions`は全てGreen。
  * **README.md**: 変更なし。
  * **仕様書**: 変更なし（内部実装のリファクタリングのみで、ユーザーから見た挙動に変化は無いため）。
  * **設計書**: `designs/class_diagram.md`に`CyclingActivityRepository`クラスを追記し、改善提案1件目を「対応済み」に更新。

### [2026-07-16] Issue #34対応(フェーズ1)として都道府県・市町村の行政区画+地名を切り替え可能な「行政区画」レイヤーとして追加した
* **修正の動機・概要**:
  - Issue #34「歴史的行政区画表示機能」は、現行データでの行政区画レイヤー化（フェーズ1）と、過去3時代（2000/1950/1920年）の行政区画データ導入（フェーズ2）の2段階の要望を含む大規模なIssueだった。Issue本文が「まずは」/「次に」と明示的にフェーズ分けしていたため、今回はフェーズ1（現行データでの行政区画レイヤー化）のみをスコープとし、フェーズ2（過去データの取り込み・年代選択UI・通過自治体の年代連動）は別途対応する前提で見送った。
  - フェーズ1の要望は「都道府県・市町村の行政区画（境界線+地名）を、既存の地名レイヤーとは別の1つの切り替え可能なレイヤーにまとめる。地名レイヤーは都道府県名・市町村名以外の地名（国名・河川名等）のみに絞る」というもの。
  - Issue本文は「sourceLayerはboundary_3」としていたが、実際にOpenFreeMap Liberty（OpenMapTilesスキーマ）のスタイルJSONを取得して確認したところ、`boundary_3`はベーススタイル側のスタイルレイヤーIDであり、ベクトルタイル側のsource-layer名は`boundary`だった。またadmin_levelでフィルタしたところ`boundary_3`は3〜6（国〜都道府県相当）のみを含み、市町村相当のadmin_level 7〜8はベーススタイルに元々描画されていないことが判明した。そのため、都道府県境界は既存の`boundary_3`をそのまま可視性トグルの対象に含め、市町村境界（admin_level 7〜8）は新規スタイルレイヤー（`admin-boundary-municipality`）として追加し、見た目（線の色・破線パターン）は`boundary_3`を模倣した。
  - 地名側は、OpenFreeMap Libertyの`place`ソースレイヤーの各スタイルレイヤーの`filter`を確認し、`label_state`/`label_city`/`label_city_capital`/`label_town`/`label_village`（都道府県名・市町村名）のみを新設の「行政区画」カテゴリへ移し、`label_country_1〜3`・`label_other`（国名・その他の地名）は既存の「地名」カテゴリに残した（`label_other`はfilterで`class`が`city`/`continent`/`country`/`state`/`town`/`village`以外のもののみを含むため、都道府県・市町村名との重複は無い）。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `frontend/src/types/layer.ts`: `ToggleableLayerId`に`'admin-boundary'`を追加。
    - `frontend/src/constants/layerDefinitions.ts`: `LAYER_DEFINITIONS`に`{ id: 'admin-boundary', name: '行政区画', defaultChecked: true }`を追加。
    - `frontend/src/constants/adminBoundary.ts`（新規）: 市町村行政区画レイヤーのID・source-layer・filter（admin_level 7〜8）・paint（`boundary_3`と同じ色・破線）・minzoom（8）を定義。
    - `frontend/src/utils/mapLayerCategory.ts`: `categorizeStyleLayer`を拡張し、`boundary_3`と`place`ソースレイヤーの都道府県・市町村名レイヤーを`admin-boundary`へ分類。
    - `frontend/src/components/MapView.tsx`: `addAdminBoundaryLayer`（新規）で市町村境界レイヤーを`boundary_3`の手前に追加。`resolveStyleLayerIds`に`admin-boundary`カテゴリ（ベーススタイル由来+新規追加レイヤー）の分岐を追加。
    - 既存テスト（`mapLayerCategory.tests.ts`・`MapView.tests.tsx`・`useLayerVisibility.tests.ts`）のフィクスチャに`admin-boundary`を追加し、TDD（Red→Green）で実装。単体テスト（フロントエンド全件）・lint・typecheckは全てGreen。
  * **README.md**: 変更なし。
  * **仕様書**: `specs/system_specification.md`のレイヤ切り替え機能節に「行政区画」レイヤーを追記し、「地名」の説明を「都道府県名・市町村名を除く地名」に修正。`specs/glossary.md`に「行政区画」の用語定義を追加。

### [2026-07-16] PR #56のレビュー対応としてcatch節のAppExceptionナローイングをassertsアサーション関数に置き換えた
* **修正の動機・概要**:
  - PR #56（Issue #48対応）で`error as AppException`のキャストを避けるために追加した`if (!(error instanceof AppException)) { throw error; }`というナローイングについて、「直前の`expect(error).toBeInstanceOf(AppException)`自体が失敗時に例外を投げるため、このif/throwは実質到達しない冗長なコードではないか」という指摘を受けた。
  - 指摘の通りだったため、TypeScriptの`asserts`型ガード関数（`function assertIsAppException(error: unknown): asserts error is AppException`）を`backend/src/test-utils/assert-is-app-exception.ts`（新規）に切り出した。内部で`expect(error).toBeInstanceOf(AppException)`を呼ぶだけの薄い関数だが、これによりアサーションと型の絞り込みを1行で両立でき、呼び出し側の冗長なif/throwが不要になった。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `backend/src/test-utils/assert-is-app-exception.ts`（新規）。
    - `backend/src/strava/__tests__/strava-activities.service.tests.ts`・`strava-auth.service.tests.ts`: 4箇所を`assertIsAppException`経由に置き換え。
    - 単体テスト（バックエンド99件）・lint・typecheck・`check:type-assertions`（0件）は全てGreen。
  * **README.md**: 変更なし。
  * **仕様書**: 変更なし（テストコードのみの改善のため）。
  * **その他**: `rules.md`（このブランチ時点でのファイル名）に、`asserts`型ガード関数によるアサーション+型絞り込みの一本化パターンを追記。

### [2026-07-16] PR #55のレビュー対応としてDialog系コンポーネントの共通ラッパーAppDialogを切り出した
* **修正の動機・概要**:
  - PR #55（Issue #47対応）で追加した`check-file-size.mjs`のレビューで、「主にDialog系ファイルでJSXネスト深さの閾値超過が発生しているが、共通コンポーネントとして切り出せばネストを浅くできないか」という指摘を受けた。
  - `LayerDialog`・`SettingsDialog`・`FilterDialog`・`ErrorDialog`の4コンポーネントを確認したところ、いずれもChakra UIの`Dialog.Root`/`Dialog.Backdrop`/`Dialog.Positioner`/`Dialog.Content`/`Dialog.Header`（タイトル+閉じるボタン）/`Dialog.Body`/`Dialog.Footer`/`Dialog.CloseTrigger`という同一のラッパー構造を持っていることを確認し、`AppDialog`（新規）として共通化した。
  - `ErrorDialog`は他の3つと異なり、閉じる(×)ボタンが無くrole="alertdialog"・タイトルが動的（件数表示）という点で差異があったため、`AppDialog`に`showCloseButton`（省略時true）・`role`（省略時'dialog'）・`title`をReactNodeとして受け取れるオプションを設け、いずれのケースにも対応できるようにした。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `frontend/src/components/AppDialog.tsx`（新規）・`frontend/src/components/__tests__/AppDialog.tests.tsx`（新規）。
    - `frontend/src/components/LayerDialog.tsx`・`SettingsDialog.tsx`・`FilterDialog.tsx`・`ErrorDialog.tsx`: `AppDialog`を使うようリファクタリング（振る舞いの変更は無い、既存テストは無修正のまま全てGreen）。
    - `check:file-size`で検出していた`LayerDialog.tsx`のJSXネスト深さ超過（9、閾値8）を解消したことを確認済み。
    - 単体テスト（フロントエンド202件）・lint・typecheckは全てGreen。E2Eテスト4件も実行し（1回目は既知のタイル読み込み・タイミングのフレーキーさで2件失敗したが、再実行で全て成功）、実装変更による回帰でないことを確認した。
  * **README.md**: 変更なし。
  * **仕様書**: 変更なし（UIの見た目・挙動に変更は無く内部実装の共通化のため）。
  * **設計書**: `designs/class_diagram.md`のフロントエンドのクラス図に`AppDialog`と4ダイアログからの依存関係を追加。

### [2026-07-15] GitHub Issue #48としてコード上の型キャストを解消しcheck:type-assertionsをコミット時に実行するようにした
* **修正の動機・概要**:
  - `check:type-assertions`スクリプトで検出される型キャストが26件（着手時点では31件に増加していた）残っており、これを解消しコミット時に自動実行されるようにしたいという依頼（Issue #48）。自律モードで対応した。
  - 31件を1件ずつ精査し、rules.mdに記載された回避手順（コンテキスト型注釈・型ガード・ジェネリックオーバーロード等）で実際にキャストを排除できるものと、外部境界（外部API JSONレスポンス・DOM要素・NestJSアプリケーションインスタンス等のテストダブル）としてキャストが避けられないものを判別した。
  - **キャストを排除できたもの**: `.includes()`→`.some()`への置き換え、`instanceof`によるcatch節のエラー型ナローイング、`if`文によるnull/discriminated unionのナローイング、変数・オブジェクトリテラルへの型注釈付与（`as`ではなく宣言時の型注釈でコンテキスト型を与える）等で対応した。
  - **`Object.entries`/`Object.fromEntries`の型が常に`string`キーへ広がる問題**（TypeScript本体の既知の制約）は、2箇所（`useLayerVisibility.ts`・`MapView.tsx`）で同じパターンのキャストが必要だったため、DRY原則に従い`typedEntries`/`typedFromEntries`という共通ユーティリティ（`frontend/src/utils/typedObject.ts`、新規）に集約し、キャスト自体をユーティリティ内の1箇所に閉じ込めた（呼び出し側からはキャストが消えた）。
  - **キャストが避けられなかったもの**（説明コメントを付与）: 外部topojson APIレスポンスの解析（`seed-municipalities.ts`）、Testing Libraryが返す`HTMLElement`をイベントハンドラの都合上ある型に固定する必要のあるテストダブル（`Response`・`INestApplication`・`LayerSpecification`等、実際に使うプロパティのみ実装した最小限のテストダブル）、TypeORM `Repository.create()`のモック（ライブラリ自体の型シグネチャがDeepPartial→Entityの変換を許容しているため）。
  - **コミット時の自動実行**: `package.json`の`lint-staged`に`check:type-assertions`を追加し、huskyのpre-commitフックでステージ済みファイルに対して自動実行されるようにした。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `frontend/src/utils/typedObject.ts`（新規）・`frontend/src/utils/__tests__/typedObject.tests.ts`（新規）: `typedEntries`/`typedFromEntries`。
    - `backend/src/strava/strava-activity.util.ts`・`backend/src/strava/__tests__/strava-activities.service.tests.ts`・`backend/src/strava/__tests__/strava-auth.service.tests.ts`・`backend/src/municipalities/seed-municipalities.ts`・`backend/src/database/__tests__/database.config.tests.ts`・`backend/src/activities/__tests__/activities.service.tests.ts`・`backend/src/activities/__tests__/cycling-activity-entity.util.tests.ts`・`backend/src/__tests__/swagger.config.tests.ts`・`frontend/src/utils/__tests__/apiError.tests.ts`・`frontend/src/utils/__tests__/mapLayerCategory.tests.ts`・`frontend/src/hooks/useLayerVisibility.ts`・`frontend/src/components/MapView.tsx`・`frontend/src/hooks/__tests__/useBackfillProgressFooter.tests.ts`・`frontend/src/components/__tests__/MapView.tests.tsx`・`frontend/src/components/__tests__/MapWorkspace.tests.tsx`: 型キャストを解消。
    - `package.json`: `lint-staged`に`check:type-assertions`を追加。
    - 単体テスト（フロントエンド198件・バックエンド99件）・lint・typecheck・`check:type-assertions`（0件）は全てGreen。
  * **README.md**: 変更なし。
  * **仕様書**: 変更なし（内部的な型の書き方の改善であり、アプリケーションの機能仕様には影響しないため）。
  * **その他**: `rules.md`・`commit_rules.md`の該当記述を「コミット時の自動実行には未組み込み」から「lint-staged経由で自動実行される」に更新。

### [2026-07-15] GitHub Issue #47としてrules.mdを分割し機械チェック可能なルールをスクリプトへ移行した
* **修正の動機・概要**:
  - rules.mdが1000行を超えており、エージェントがこれを全て読み込んでも守りきれていないという依頼（Issue #47）。自律モードで対応した。issue-reviewの観点（大規模な再編・分割Issueは境界の判断基準を先に固める）に従い、以下の方針を決めた上で着手した。
  - **分割方針**: 「参照するタイミング」で3ファイルに分割した。`rules.md`（実装時に常に参照する基礎的なTypeScript/React構文規約）、`design_principles.md`（新規、DRY/KISS/YAGNI・SOLID原則等、モジュール分割を判断する場面でのみ参照）、`ui_rules.md`（新規、Chakra UI・色/余白トークン等、フロントエンドUI実装時のみ参照）。より細かい粒度（TypeScript/React/ドキュメントコメント等でさらに分割する案）も検討したが、変更のリスク・レビュー負荷が大きくなるため今回は見送り、3分割にとどめた。
  - **Biomeで既に自動検出されるルールの整理**: `biome.json`の設定と照合したところ、rules.mdの一部規約（default export禁止・三項演算子ネスト禁止・命名規則・型推論の省略・自己閉じタグ・未使用変数/引数・アロー関数・importソート・型定義のtype使用等）はBiomeが既に自動検出・一部は自動修正することを確認した。該当箇所はNG/OK例を削り、Biomeのルール名への参照のみに圧縮した。
  - **rules.md内の重複の発見**: 整理の過程で、rules.md自体に「マジックナンバー」「importソート」「default export禁止」の3項目が実質的に重複して2回ずつ記載されていること、および「コミットメッセージにはプレフィックスを付与する」がcommit_rules.mdと完全に重複していることを発見し、統合・削除した。また「eslint-disableを使用する場合は理由を明記する」等、Biome移行前のESLint時代の構文（`eslint-disable-next-line`）が残っていたため、実際に使われている`biome-ignore`構文に修正した。
  - **「テストケースは日本語で書く」の移動**: コード規約ではなくテスト規約のため、test_rules.mdへ移動した。
  - **ファイルサイズ・JSXネスト深さの機械チェック**: 設計原則（特にSRP）は機械的に判定できないが、責務が集まりすぎている兆候として、ファイル行数・JSXネスト深さの閾値超過を検出する`scripts/check-file-size.mjs`（新規、`check-type-assertions.mjs`と同様のTypeScript Compiler APIベースのスクリプト）を追加した。閾値は行数300・JSXネスト深さ8とした（JSXネスト深さは当初6で試したが、Chakra UIのDialogコンポーネント（Root/Backdrop/Positioner/Content等の必須ラッパー構造）が軒並り引っかかり誤検知が多かったため8に調整した）。実際に実行したところ`MapView.tsx`（459行）・`LayerDialog.tsx`（JSXネスト深さ9）の2件が閾値超過だったが、既存debtの解消は別途判断が必要なため本対応では見送り、スクリプトの追加のみを行った（`check-type-assertions.mjs`と同じ扱い）。現時点ではコミット時の自動実行には組み込んでおらず、手動実行のみ。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `scripts/check-file-size.mjs`（新規）: ファイル行数・JSXネスト深さの検出スクリプト。
    - `package.json`: `check:file-size`スクリプトを追加。
  * **README.md**: 変更なし。
  * **仕様書**: 変更なし（AIエージェントの内部運用ルールであり、アプリケーションの機能仕様には影響しないため）。
  * **その他**: `rules.md`を大幅に整理（1243行→470行）。`design_principles.md`（新規）・`ui_rules.md`（新規）を追加。`test_rules.md`に「テストケースは日本語で書く」を移動。`AGENTS.md`・`.agents/skills/finish-review/SKILL.md`のルールファイル参照箇所に新ファイルを追記。

### [2026-07-15] GitHub Issue #35として振り返りを行いissue-reviewスキルを新設した
* **修正の動機・概要**:
  - レビューやプロンプト入力の都度ルール追加を行っており、これまでのルール・CHANGELOG.md・PRのレビューを俯瞰して振り返る機会が無かった。またユーザーが実装後に仕様書に書いていないことを求めたり、自律モードで実装中に設計上の判断が毎回必要になったりする状況があった（Issue #35）。自律モードで対応した。
  - **振り返り**: rules.md・test_rules.md・commit_rules.md・branch_rules.md・AGENTS.mdを通読し、相互に矛盾する記述が無いか確認した。矛盾は見つからなかったが、唯一の実質的なギャップ（finish-reviewスキルのPRマージ手順に、マージ対象PR自身のbaseがmainかどうかの事前チェックが無かった問題）は、本Issue着手の直前に別件（PR #41レビュー時の実装混入調査）で発見済みであり、PR #49として既に修正済みだった。
  - **issue-reviewスキルの新設**: Issueの実装着手前にレビューを行うスキルを新設した。過去に実装中・実装後のレビューで初めて発覚した手戻りの原因（Issue #23の外部API認証情報不足、Issue #29・#30の分割基準の曖昧さ、Issue #26のUI/UX要望の裏取り不足、PR #42のbase不整合)を`issue_review_notes.md`（新規）に観点として蓄積し、issue-implementスキルの手順1（Issue詳細取得）の直後に必ず経由するよう組み込んだ。
* **各ファイルへの影響と変更内容**:
  * **実装**: アプリケーションコードの変更は無い。
  * **README.md**: 変更なし。
  * **仕様書**: 変更なし（AIエージェントの内部運用スキルであり、アプリケーションの機能仕様には影響しないため）。
  * **その他**: `.agents/skills/issue-review/SKILL.md`（新規）・`issue_review_notes.md`（新規、リポジトリルート）を追加。`.agents/skills/issue-implement/SKILL.md`の手順1にissue-reviewスキルの呼び出しを追記。`AGENTS.md`にissue-reviewスキルの言及を追記。

### [2026-07-15] finish-reviewスキルのPRマージ手順にbase整合性チェックを追加した
* **修正の動機・概要**:
  - PR #41（Issue #29、クラス図作成）をレビューした際、その内容（`designs/class_diagram.md`）が既に`main`へ存在していることが判明した。調査の結果、原因はPR #42（Issue #30）のマージにあった：PR #42は`base: docs/issue-29-class-diagram`（PR #41自身のブランチ）のままマージされており、本来`main`へ入るべき内容がPR #41のブランチへ積み増しされる形になっていた。この時点でPR #41（base元）はまだOPEN・未マージだった。
  - その後、PR #42の子孫であるPR #43がレビューされた際、finish-reviewスキル手順4の「祖先PRが既にclosed & mergedなら`main`に吸収されたとみなす」ロジックによりPR #42が「マージ済み」と判定され、PR #43のbaseが`main`へretargetされてマージされた。これによりIssue #29・#30の内容はPR #41・#42という本来のPRを経由せず、PR #43経由で`main`に混入した。PR #41・#42はGitHub上でopen/mergedのステータスのまま取り残された。
  - 根本原因は、finish-reviewスキルの手順2「PRのマージ」が、マージ対象PR自身の`base`が`main`かどうかを事前チェックしないまま`merge_pull_request`を実行する記述になっていたこと。base変更の判断ロジックは手順4（次PRのレビュー準備）側にしか無く、マージ対象PR自身のbaseが祖先ブランチのまま（かつ祖先PRが未マージ）でも素通りしてしまう構造だった。
  - ユーザーからの指摘を受け、手順2に「baseが`main`以外の場合、base元PRがマージ済みなら`main`へretargetする、未マージなら対象PRをマージせず中断してユーザーに確認する」チェックを追加した。
* **各ファイルへの影響と変更内容**:
  * **実装**: `.agents/skills/finish-review/SKILL.md`の手順2に、マージ前のbase整合性チェック（base元PRの状態確認・`main`へのretarget・未マージ時の中断）を追記。注意事項にも省略禁止の旨を追記。
  * **README.md**: 変更なし。
  * **仕様書**: 変更なし（AIエージェントの内部運用スキルであり、アプリケーションの機能仕様には影響しないため）。

### [2026-07-15] GitHub Issue #26のフォローアップとして自転車ログの線の状態配色をデザイン原則に基づき見直した
* **修正の動機・概要**:
  - PR #38（Issue #26対応、赤ベースの濃淡3段階）を実際にレビューしたところ、線が多く重なる箇所では濃淡の違いだけでは依然として識別しづらいという指摘を受けた。
  - 未選択/選択中/フォーカス中の3状態は「識別（どのアクティビティか）」ではなく「状態」を表すエンコーディングであり、同一色相の濃淡だけに頼るより色相自体を変える方が、重なった際の識別性・色覚多様性（CVD）耐性の両面で優れることを確認した上で設計を見直した。
  - 新配色（グレー/青/赤）は`node scripts/validate_palette.js`（社内のデータビジュアライゼーション設計ガイドに付属する検証スクリプト）でCVD分離・コントラストを確認済み（青・赤のペアはCVD ΔE 69.7で目標値12を大きく上回る。未選択のグレーは意図的な低彩度の背景色のため、識別色向けの彩度下限チェックは対象外とした）。
  - 色相変更に加え、線が重なる場面での識別性を高めるため二次エンコーディング（線幅の段階化: 通常2px/選択中3px/フォーカス中4px、およびフォーカス中の線の下に敷く白色のハロー(縁取り)）を追加した。描画順（通常→選択中→フォーカス中の順に手前へ）は既存のまま変更していない。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `frontend/src/constants/bicycleLog.ts`: `BICYCLE_LOG_LINE_COLOR_DEFAULT`（`#fbb6ce`→`#718096`グレー）・`BICYCLE_LOG_LINE_COLOR_SELECTED`（`#ed64a6`→`#3182ce`青）を変更（`BICYCLE_LOG_LINE_COLOR_FOCUSED`は`#e53e3e`のまま維持）。線幅を状態ごとに分ける`BICYCLE_LOG_LINE_WIDTH_DEFAULT`/`_SELECTED`/`_FOCUSED`（新規、単一だった`BICYCLE_LOG_LINE_WIDTH`を置き換え）と、ハロー用の`BICYCLE_LOG_FOCUSED_OUTLINE_COLOR`/`_WIDTH`/`_LAYER_ID`（新規）を追加。
    - `frontend/src/components/MapView.tsx`: `addBicycleLogLayer`が状態ごとに異なる線幅を使うよう変更し、フォーカス用ソースを参照するハローレイヤーを本体レイヤーより先に(=下に)追加。`resolveStyleLayerIds`の`bicycle-log`にハローレイヤーIDを追加し、レイヤー表示/非表示トグルの対象に含めた。
    - 単体テスト（フロントエンド196件）・lint・typecheckは全てGreen。
  * **README.md**: 変更なし。
  * **仕様書**: `specs/system_specification.md`の線の色に関する記載を新配色・線幅・ハローの説明に更新。

### [2026-07-14] PR #43のレビュー対応として用語集の表記統一をコード上のコメントにも適用した
* **修正の動機・概要**:
  - PR #43のレビューで「用語集で定義した用語（同期→新規アクティビティ取得、初期取り込み→バックフィル、自転車ログ強制再取得→フォースリフェッチ、左右サイドバー→操作パネル/アクティビティパネル）はコード中のコメントにも適用されているか。少なくともMapView.tsxは依然として『同期』という用語が使われている」との指摘を受けた。
  - 実際に確認したところ、直前のコミットでは`specs/`・`designs/`配下のドキュメントのみを更新しており、AGENTS.mdが規定する「コード上のコメント」への適用が漏れていた。バックエンド・フロントエンド・electron/tests配下のコメントを再度全件確認し、22ファイルにわたる旧用語を新用語へ統一した。
  - UI上に実際に表示されるボタンラベル文字列（「自転車ログ初期取り込み」「自転車ログ強制再取得」）と、それに対応するテストのセレクタ文字列（`getByRole('button', { name: '...' })`等）は、コメントではなく実装のUI仕様そのものであるため、今回は変更対象外とした（変更する場合はUI表示文言自体の変更という別の設計判断になるため）。
* **各ファイルへの影響と変更内容**:
  * **実装**: 以下のファイルのコメント（TSDoc・`//`コメント・テスト名）を新用語へ統一。
    - バックエンド: `activities.controller.ts`・`activities.service.ts`・`activities-backfill.service.ts`・`cycling-activity-entity.util.ts`・`strava-activities.service.ts`・`entities/cycling-activity.entity.ts`・migrations 2件・`__tests__/activities.service.tests.ts`・`__tests__/activities-backfill.service.tests.ts`
    - フロントエンド: `MapView.tsx`・`LayerSidebar.tsx`・`ActivityDetailSidebar.tsx`・`errorsAtom.ts`・`activityDetailView.ts`・`useBackfillStatus.ts`・`activitiesApi.ts`
    - electron/tests: `fixtures/activities.js`・`support/mock-strava-server.js`・`bicycle-log.spec.ts`
  * **README.md**: 変更なし。
  * **仕様書**: 変更なし（前回のPR #43対応で既に更新済みのため）。

### [2026-07-14] 型キャストのルール違反を機械的に検出するチェックスクリプトを追加した
* **修正の動機・概要**:
  - PR #39のレビューで、rules.mdが以前から禁止している「コメント無しの型キャスト」がIssue #27の実装時に見過ごされていた事例を発見した。ユーザーから「なぜAIエージェントがルールを守れなかったのか」と問われ調査した結果、rules.mdのルールはBiomeの自動チェック対象外であり、実装時にエージェントが逐一プローズのルールと照合しない限り検出されない、という構造的な弱点が判明した。
  - ユーザーとの相談の結果、Biomeのカスタムルール機構は成熟しておらずESLint導入は大きな決断になるため、まずは軽量な独立スクリプトで運用する方針で合意した。
  - TypeScript Compiler APIを使い、`as unknown as T`（括弧で挟んだ場合を含む）を無条件エラー、それ以外の`as T`を直前行/同一行末尾に`//`コメントが無い場合にエラーとする`scripts/check-type-assertions.mjs`を作成した。`import { x as y }`の別名importはAST上別のノード種別（AsExpressionではない）のため誤検出しない。`as const`も対象外とした。
  - 実際にリポジトリ全体に対して実行したところ、既存コードに26件の未検出の違反（バックエンドのJSON/topojsonパースキャスト、テストファイルのモック用キャスト等）が見つかった。これらの既存debtの解消・コミット時の自動実行への組み込みは別途判断が必要なため、本対応では見送り、スクリプトの追加のみを行った。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `scripts/check-type-assertions.mjs`（新規）: 型キャストの検出スクリプト。
    - `package.json`: `check:type-assertions`スクリプトを追加。
    - `biome.json`: `files.includes`に`scripts/**`を追加。
    - `rules.md`: 「anyやas（型キャスト）は原則使用しない」節に、本スクリプトの案内を追記。
  * **README.md**: 変更なし。
  * **仕様書**: 変更なし（AIエージェントの内部運用ツールであり、アプリケーションの機能仕様には影響しないため）。

### [2026-07-14] finish-reviewスキルにPRマージ後のIssueクローズ手順を追加した
* **修正の動機・概要**:
  - Issue #32対応の自律ループ中、既にPR #21・#22でmainへマージ済みのIssue #18・#19がGitHub上でOPENのまま残っており、`issue-implement`スキルの自律モードが次の対象Issueとして誤って選定しかける事態になった。原因は、既存の運用ではPRマージ後にGitHub Issueをクローズする手順が無く、人間・エージェントいずれも都度手動でクローズしていたため、漏れが発生していたこと。
  - ユーザーの指示を受け、`finish-review`スキルの手順2（PRマージ）にIssueクローズを組み込んだ。マージ成功後、PRのタイトル・ブランチ名からIssue番号を特定し、マージ済みPRへの参照を添えたコメントとともにクローズする。
  - 発見時点で既にOPENのまま残っていたIssue #18・#19は、本対応の一環としてユーザーの許可を得た上で手動でクローズ済み。
* **各ファイルへの影響と変更内容**:
  * **実装**: `.agents/skills/finish-review/SKILL.md`の手順2に、マージ成功後のIssueクローズ手順を追記。
  * **README.md**: 変更なし。
  * **仕様書**: 変更なし（AIエージェントの内部運用スキルであり、アプリケーションの機能仕様には影響しないため）。

### [2026-07-14] GitHub Issue #32として左サイドバーを廃止しMap Controlsへ移行した
* **修正の動機・概要**:
  - 左サイドバーがレイヤー一覧・フィルタボタン・初期取り込み/強制再取得ボタンを縦に積んでおり、地図表示領域を常に圧迫しているという依頼（Issue #32）。自律モードで対応した。
  - 左サイドバー（`LayerSidebar`）を廃止し、代わりに地図右下に浮かぶ3つのアイコンボタン（レイヤー・フィルタ・設定）「マップコントロール」から各ダイアログを開く構成に変更した。レイヤー切り替えは新設の`LayerDialog`（`FilterDialog`と同じdraft/applied方式、リセット/実行ボタン付き）に、初期取り込み・強制再取得は新設の`SettingsDialog`（ボタン押下と同時に処理実行・ダイアログを閉じる）に移した。
  - 設定ダイアログが即座に閉じる仕様変更に伴い、初期取り込み/強制再取得の実行中・完了状態を表示する場所が無くなるため、地図下部に新設の`BackfillProgressFooter`（実行中は進捗%・件数・残り時間、完了後は閉じるボタンを押すまで完了メッセージを表示）を追加した。表示/非表示は新設フック`useBackfillProgressFooter`で管理する（実行開始を検知すると自動表示、閉じるボタンで非表示）。
  - `useLayerVisibility`を、`useActivityFilter`と同じdraft(入力中)/applied(適用中)状態を持つ方式に書き換えた（従来は即時反映だったが、`LayerDialog`の「実行」ボタンで確定する方式に合わせるため）。
  - 実装中に、Chakra UI v3の`Checkbox`（`Switch`と同じくArk UI/`@zag-js`ベース）で2つの非自明な問題を発見した。(1) 単体テスト（jsdom）で`onCheckedChange`がマイクロタスクで非同期に発火するため`fireEvent.click`直後の同期アサーションでは検知できない、(2) 実ブラウザ（Electron/Playwright）E2Eで、視覚的に隠されたinput要素の実座標がダイアログ本体等の他要素と重なりクリックがインターセプトされることがある。いずれも既存の`Switch`向けの同種の記載（test_rules.md）が既にあったため、新規ルールを追加するのではなくCheckbox向けに拡張する形で追記した。
  - E2Eの`bicycle-log.spec.ts`で、初期取り込みボタン押下直後に進捗フッターの「取得中」表示を待つアサーションが、E2E環境（レート制限間隔を極小化・フィクスチャ3件のみ）では処理が一瞬で完了しPlaywrightのポーリングが実行中状態を捕捉できず失敗する事例を確認した。実行中表示の待機を削除し、最終的な完了表示のみを待つよう修正した。
  - 左サイドバー廃止により地図表示領域の幅が変わったため、E2Eスクリーンショットのベースライン（`aerial-photo.png`・`bicycle-log-backfill.png`・`bicycle-log-sync.png`）を再生成し、目視で新しいマップコントロールのアイコンが正しく表示されていることを確認した。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `frontend/src/components/MapControls.tsx`（新規）: レイヤー・フィルタ・設定の3アイコンボタン群。
    - `frontend/src/components/LayerDialog.tsx`（新規）・`frontend/src/components/SettingsDialog.tsx`（新規）・`frontend/src/components/BackfillProgressFooter.tsx`（新規）。
    - `frontend/src/hooks/useLayerVisibility.ts`: draft/applied方式へ書き換え。
    - `frontend/src/hooks/useBackfillProgressFooter.ts`（新規）。
    - `frontend/src/components/MapWorkspace.tsx`: 上記コンポーネント・フックを配線する構成に全面的に書き換え。
    - `frontend/src/components/MapView.tsx`: 地図領域の高さを`height="100vh"`→`height="100%"`に変更（フッターと縦に並ぶflexレイアウトに対応）。
    - `frontend/src/components/LayerSidebar.tsx`（削除）。
    - `frontend/src/theme.ts`: 不要になった`sidebarCollapsedWidth`を削除。
    - `electron/tests/support/layer-controls.ts`（新規）: レイヤー切り替えダイアログを開き、ラベルテキストのクリックでチェック状態を切り替えて実行する`toggleLayer`ヘルパー。
    - `electron/tests/bicycle-log.spec.ts`・`electron/tests/aerial-photo.spec.ts`: 新UIに合わせてレイヤー切り替え手順・初期取り込み完了確認手順を修正。
    - `test_rules.md`: `Checkbox`の非同期`onCheckedChange`（単体テスト）・実ブラウザでのクリックインターセプト（E2E）について、既存の`Switch`向け記載を拡張。
    - 単体テスト（フロントエンド）・lint・typecheck・E2Eテスト4件は全てGreen。
  * **README.md**: 変更なし。
  * **仕様書**: `specs/system_specification.md`の「レイヤ一覧表示機能」「自転車ログフィルタリング機能」「自転車ログ初期取り込み機能」から左サイドバーに関する記載を除去し、マップコントロール・各ダイアログ・進捗フッターを用いる新しい操作方法に更新。`specs/glossary.md`から「左サイドバー」を削除し、「マップコントロール」「レイヤーダイアログ」「設定ダイアログ」「進捗フッター」を追加。
  * **設計書**: `designs/class_diagram.md`のフロントエンドのクラス図を新しいコンポーネント構成に更新し、「`MapWorkspace`の責務の広さ」改善提案の該当箇所にIssue #32対応済みである旨を追記。

### [2026-07-14] GitHub Issue #31として用語集を作成した
* **修正の動機・概要**:
  - 指示・レビュー・仕様書記載の際に一般的な用語（左サイドバー、ダイアログ等）を用いており、表記揺れや説明の冗長化が懸念されるという依頼（Issue #31）。自律モードで対応した。
  - `specs/system_specification.md`・`designs/technical_design.md`・コード上のコメントを調査し、一意に定めておくべき用語（自転車ログ、アクティビティ、同期、初期取り込み、選択/フォーカス、左右サイドバー等）をリストアップし、`specs/glossary.md`（新規）にまとめた。
  - 調査の過程で、実際に表記揺れを発見し修正した: 「同期」処理が仕様書・設計書内で「更新系API」、コード上のコメント（`MapView.tsx`）で「更新用API」と別々に表現されていたため、全て「同期」に統一した。また「アクティビティログ」という表現も「アクティビティ」に統一した。
* **各ファイルへの影響と変更内容**:
  * **実装**: `frontend/src/components/MapView.tsx`のコメント内の表記を「更新用API」→「同期」に修正（動作に影響する変更ではない）。
  * **README.md**: 変更なし。
  * **仕様書**: `specs/glossary.md`（新規）を作成。`specs/system_specification.md`・`designs/technical_design.md`の表記揺れ（「更新系API」/「アクティビティログ」）を修正し、両ファイルの冒頭に`glossary.md`へのリンクを追加。`AGENTS.md`に、用語を使う際はglossary.mdの定義に従う旨を追記。

### [2026-07-14] GitHub Issue #30として仕様書を仕様書と設計書に分割した
* **修正の動機・概要**:
  - `specs/system_specification.md`に、ユーザーから見た仕様レベルの記述だけでなく、アルゴリズム・データモデル・クラス名・PostGISの関数名等の設計レベルの記述も混在しており、レビューしづらいという依頼（Issue #30）。自律モードで対応した。
  - 設計書を置く`designs/`フォルダを新設し、`designs/technical_design.md`へ実装上の設計（技術スタック、ディレクトリ構造、各機能のアルゴリズム・データモデル・処理フロー）を移した。`specs/system_specification.md`にはユーザーから見た機能・挙動のみを残した。
  - 設計書へ移す過程で、既存のコードを参照し、仕様書の記述が実装と乖離していた箇所を補強・修正した（例: `StravaApiException`という独立した例外クラスが存在するという記述は誤りで、実際は`toStravaApiException`という変換関数であることを確認し修正。エラー状態管理も、Issue #28で`onError`のバケツリレーからJotaiの`errorsAtom`へ変更されていたのに仕様書側が追従できていなかったため修正）。
  - Issue #29で作成した`CLASS_DIAGRAM.md`（リポジトリルート）も、新設した`designs/`フォルダへ移動した（`designs/class_diagram.md`）。
  - AGENTS.mdの実装・README・仕様書の乖離確認ルールに、`designs/`以下の設計書も対象として追加した。`issue-implement`・`pr-review-respond`・`finish-review`スキルの該当箇所も同様に更新した。
* **各ファイルへの影響と変更内容**:
  * **実装**: アプリケーションコードの変更は無い。
  * **README.md**: 概要文に`designs/technical_design.md`へのリンクを追加。
  * **仕様書**: `specs/system_specification.md`から実装上の設計に関する記述を`designs/technical_design.md`へ移動し、ユーザーから見た仕様のみを残す構成に変更。
  * **その他**: `AGENTS.md`・`.agents/skills/issue-implement/SKILL.md`・`.agents/skills/pr-review-respond/SKILL.md`・`.agents/skills/finish-review/SKILL.md`の仕様書関連の記述に、`designs/`以下の設計書も対象として追加。

### [2026-07-14] GitHub Issue #29として現状の実装のクラス図と改善提案をまとめた
* **修正の動機・概要**:
  - 設計・実装がエージェント任せになっており、現在の依存関係が適切かレビューできる状態になっていないという依頼（Issue #29）。自律モードで対応した。
  - バックエンド（NestJSの実クラス設計）とフロントエンド（Reactの関数コンポーネント・フックの依存関係を`<<component>>`/`<<hook>>`/`<<atom>>`のステレオタイプで表現）に分けてMermaidのクラス図を作成した。作成した図は`@mermaid-js/mermaid-cli`で実際にレンダリングし、構文エラーが無いことを確認済み。
  - 図をもとに、現状の設計に対する改善提案（`ActivitiesService`/`ActivitiesBackfillService`の責務の重なり、`ActivitiesController`の依存の広さ、Strava HTTPクライアントの抽象化、`MapWorkspace`の責務、エラーハンドリングの一貫性）をまとめた。過剰設計を避けるため、現状の規模で対応不要と判断した項目もその理由とともに明記した。
* **各ファイルへの影響と変更内容**:
  * **実装**: `CLASS_DIAGRAM.md`（新規、リポジトリルート）: クラス図（バックエンド2種・フロントエンド1種）と改善提案。アプリケーションコードの変更は無い。
  * **README.md**: 変更なし。
  * **仕様書**: 変更なし（実装の依存関係を可視化するドキュメントであり、アプリケーションの機能仕様には影響しないため）。

### [2026-07-14] GitHub Issue #28としてエラー状態をJotaiによるグローバルステートへ置き換えた
* **修正の動機・概要**:
  - `onError`コールバックが`MapWorkspace`を起点に`MapView`・`ActivityDetailSidebar`→`ActivityDetail`→`usePassedMunicipalities`、`useBackfillStatus`と複数階層にわたってバケツリレーされており、コンポーネントの整理やアプリケーション拡大に伴いこの構造が深刻化する前に解消してほしいという依頼（Issue #28）。自律モードで対応した。
  - Jotaiを導入し、エラースタックを`errorsAtom`（グローバルステート）として持たせた。エラーが発生しうる箇所（`MapView`・`useBackfillStatus`・`usePassedMunicipalities`）は`useErrorReporter`フックを直接呼び出してエラーを追加するようになり、`onError`propsを親から受け取る必要が無くなった。`ErrorDialog`も`errorsAtom`を直接参照・更新するようになり、`errors`/`onDismiss`propsが不要になった。
  - 他にグローバルステート化すべきものがないか調査したが、`onError`ほど深い（3階層以上の）バケツリレーが発生している状態は他に見当たらなかった（`layerVisibility`・`selectedIds`・`filter`等は`MapWorkspace`から直接の子コンポーネントへ渡されるのみ）ため、今回は`onError`のみを対象とした。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `frontend/package.json`・`pnpm-lock.yaml`: `jotai`を追加。
    - `frontend/src/atoms/errorsAtom.ts`（新規）: `errorsAtom`。
    - `frontend/src/hooks/useErrorReporter.ts`（新規）: `errorsAtom`へエラーを追加する`useErrorReporter`。
    - `frontend/src/hooks/useBackfillStatus.ts`・`frontend/src/hooks/usePassedMunicipalities.ts`: `onError`引数を廃止し`useErrorReporter`を直接使うよう変更。
    - `frontend/src/components/MapView.tsx`・`frontend/src/components/ActivityDetailSidebar.tsx`: `onError`propsを廃止。
    - `frontend/src/components/ErrorDialog.tsx`: `errors`/`onDismiss`propsを廃止し`errorsAtom`を直接参照・更新。
    - `frontend/src/components/MapWorkspace.tsx`: エラー用のローカルステート・コールバックを削除。
    - `frontend/src/test-utils/renderWithChakra.tsx`: JotaiのProviderでラップ（テストケース間でグローバルステートが漏れないよう、呼び出しごとに独立したストアを持たせる）。
    - `frontend/src/test-utils/ErrorsProbe.tsx`（新規）: テストからerrorsAtomの値を検証するためのテスト専用コンポーネント。
    - 単体テスト（フロントエンド180件）・lint・typecheckは全てGreen。
  * **README.md**: 変更なし。
  * **仕様書**: 変更なし（内部アーキテクチャの変更であり機能仕様に影響しないため）。

### [2026-07-14] GitHub Issue #27として軌跡の位置飛び（測定不能区間）を検出し区間分割するようにした
* **修正の動機・概要**:
  - トンネル内やフェリー乗船中等、GPSの測定ができない区間で、計測一時停止地点・計測再開地点の2点間に線が引かれてしまい、その線上に重なる自治体を誤って通過自治体としてカウントしてしまうという不具合（Issue #27）。自律モードで対応した。
  - 隣接する2点間の距離をHaversine公式で算出し、10km以上離れている箇所を位置飛びと判定して軌跡を複数の区間に分割する純粋関数`splitPathAtJumps`を新設した。分割後に2点未満（線を描画できない孤立した1点）になった区間は除外する。
  - この分割は詳細API(`GET /activities/{id}`)のレスポンスをEntityへ変換する`toCyclingActivityEntityFromDetail`内で行っており、初期取り込み・強制再取得・更新API呼び出しのいずれも同じ関数を経由するため、Issueで要求された3つのタイミング全てに自動的に適用される。
  - DBの`path`列を、単一の線（LineString）ではなく複数の線をまとめて持てるMultiLineStringへ変更した。既存行はマイグレーションで`ST_Multi()`により単一区間のMultiLineStringへ変換されるが、実際に位置飛びの分割を適用するには「自転車ログ強制再取得」ボタンでの再取得が必要（マイグレーション自体は位置飛びの再判定を行わないため）。
  - 通過自治体の逆ジオコーディングクエリ（`ST_Segmentize`+`ST_DumpPoints`）はMultiLineStringに対しても各区間ごとに独立してサンプリングされるため、SQLの変更は不要だった（区間間の存在しない線を誤ってサンプリングすることも無い）。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `backend/src/activities/split-path-at-jumps.util.ts`（新規）: `splitPathAtJumps`。
    - `backend/src/activities/entities/cycling-activity.entity.ts`: `path`列の型を`LineString`→`MultiLineString`に変更。
    - `backend/src/activities/cycling-activity-entity.util.ts`: `toCyclingActivityEntityFromDetail`が`splitPathAtJumps`を使い、区間分割した`MultiLineString`を構築するよう変更。
    - `backend/src/activities/cycling-activity-dto.util.ts`・`backend/src/activities/types/cycling-activity.dto.ts`: `path`の型を`[number, number][]`→`[number, number][][]`に変更。
    - `backend/src/migrations/1720800000000-ChangeCyclingActivitiesPathToMultiLineString.ts`（新規）: `path`列をgeometry(LineString,4326)からgeometry(MultiLineString,4326)へ変更するマイグレーション。実DBに適用し、既存データの変換・通過自治体クエリの動作を確認済み。
    - `frontend/src/api/activitiesApi.ts`: `CyclingActivity.path`の型を`[number, number][][] | null`に変更。
    - `frontend/src/utils/cyclingActivityToGeoJson.ts`: 描画するGeoJSONジオメトリを`LineString`→`MultiLineString`に変更。
    - `frontend/src/components/MapView.tsx`: スタート・ゴールマーカー（Issue #24）が、区間分割された`path`の最初の区間の最初の点・最後の区間の最後の点を参照するよう変更。
    - 単体テスト（バックエンド99件・フロントエンド178件）・lint・typecheckは全てGreen。
  * **README.md**: 変更なし。
  * **仕様書**: `specs/system_specification.md`の「自転車ログ表示機能」節に、位置飛びの検出・区間分割の仕様（10km以上の閾値、孤立した1点区間の除外、適用タイミング）を追記。

### [2026-07-14] GitHub Issue #26として地図上のアクティビティの線の色を赤ベースの濃淡に変更した
* **修正の動機・概要**:
  - 未選択(赤)・選択中(青)・フォーカス中(紫)がすべて原色に近く、重なると見にくいという依頼（Issue #26）。自律モードで対応した。
  - 赤ベースの濃淡のみで区別する配色に変更した。フォーカス状態には、以前デフォルト（未選択）状態に使っていた赤(`#e53e3e`)をそのまま流用した（Issueの「フォーカスがこれまで未選択に使われていた赤」という指定通り）。
* **各ファイルへの影響と変更内容**:
  * **実装**: `frontend/src/constants/bicycleLog.ts`の`BICYCLE_LOG_LINE_COLOR_DEFAULT`（`#e53e3e`→`#fbb6ce`淡いピンク）・`BICYCLE_LOG_LINE_COLOR_SELECTED`（`#3182ce`→`#ed64a6`濃いめのピンク）・`BICYCLE_LOG_LINE_COLOR_FOCUSED`（`#805ad5`→`#e53e3e`赤）を変更。単体テストは色定数を直接参照しているため変更不要、lint・typecheckは全てGreen。
  * **README.md**: 変更なし。
  * **仕様書**: `specs/system_specification.md`の「アクティビティ詳細閲覧機能」節の線の色の記載を新しい配色に更新。

### [2026-07-14] GitHub Issue #25として自律モードがWIPラベル付きIssueを拾わないようにした
* **修正の動機・概要**:
  - 自律モードはOPENなIssueを番号の小さい順に全て拾い上げて実装する仕様だったが、思いつきをメモしただけでまだ内容が固まっていないIssue（`WIP`ラベルを付けて区別している）まで自律的に実装されてしまうのは望ましくないという依頼（Issue #25）。
  - `issue-implement`スキルの自律モード（手順2-B）における対象Issue選定条件に、「`WIP`ラベルが付いていないこと」を追加した。対話モードでは引き続き`WIP`ラベル付きのIssueも選択肢に表示する（ユーザーが対話で内容を詰めながら着手できるようにするため）。
* **各ファイルへの影響と変更内容**:
  * **実装**: `.agents/skills/issue-implement/SKILL.md`の手順1（Issue一覧取得時にラベル情報も含める旨を明記）・手順2-A（対話モードでは`WIP`ラベル付きも選択肢に含める旨を明記）・手順2-B（自律モードの対象Issue選定条件に`WIP`ラベル除外を追加）を更新。

### [2026-07-14] GitHub Issue #24としてフォーカス中のアクティビティにスタート・ゴールマーカーを表示する機能を実装した
* **修正の動機・概要**:
  - フォーカス中のアクティビティが単なる線の表示のため、他の線と重なるとスタート地点・ゴール地点が分かりにくいという依頼（Issue #24）。自律モードで対応した。
  - `lucide-react`を新規導入し、フォーカス中アクティビティの軌跡（`path`）の先頭・末尾の座標に、`maplibregl.Marker`でスタート（再生アイコン）・ゴール（旗アイコン）を示すマーカーを表示するようにした。
  - 開始地点と終了地点が同じ座標になる周回ルートの場合にスタートのマーカーが埋もれないよう、ゴールのマーカーを先に、スタートのマーカーを後に地図へ追加することで、スタートが手前に描画されるようにした。
  - 軌跡（GPSルート）を持たないアクティビティがフォーカスされた場合はマーカーを表示しない（既存の`cyclingActivityToGeoJson`同様、`path`が`null`のケースを考慮）。
* **各ファイルへの影響と変更内容**:
  * **実装**:
    - `frontend/package.json`・`pnpm-lock.yaml`: `lucide-react`を追加。
    - `frontend/src/constants/startGoalMarkers.ts`（新規）: マーカーのアイコン色・サイズの定数。
    - `frontend/src/utils/startGoalMarkerElement.ts`（新規）: `lucide-react`のアイコンを`react-dom/server`の`renderToStaticMarkup`で静的にレンダリングし、`maplibregl.Marker`にそのまま渡せるDOM要素を組み立てる`createStartMarkerElement`・`createGoalMarkerElement`。
    - `frontend/src/components/MapView.tsx`: `findActivityById`（`applySelectionLayers`と共通化）・`applyStartGoalMarkers`を追加し、フォーカス中のアクティビティが変化するたびにマーカーを更新する`useEffect`を追加。
    - 単体テスト（フロントエンド177件）・lint・typecheck・E2Eテスト4件は全てGreen。
  * **README.md**: 変更なし。
  * **仕様書**: `specs/system_specification.md`の「アクティビティ詳細閲覧機能」節に、スタート・ゴールマーカーの表示条件（アイコン種別、開始・終了地点が重なる場合の手前関係、軌跡が無い場合の非表示）を追記。

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

### [2026-07-14] PR #22のレビュー対応としてMapViewのgetSource呼び出しの型キャストをジェネリクスへ置き換えた
* **修正の動機・概要**:
  - PR #22のレビューで、`MapView.tsx`内の`map.getSource(id) as maplibregl.GeoJSONSource`という型キャストについて「rules.mdのルールに違反していないか、コメントも無いが理由があるのか」との指摘を受けた。
  - 調査の結果、`maplibre-gl`の`getSource`にはジェネリック引数を取るオーバーロード(`getSource<TSource extends Source>(id: string): TSource | undefined`)が存在し、`map.getSource<maplibregl.GeoJSONSource>(id)`と書くことでキャスト無しで型を指定できることが分かった。この方法に置き換え、戻り値が`undefined`になりうる分岐(本来到達しないはずだが型上は存在する)を早期returnで処理するようにした。
* **各ファイルへの影響と変更内容**:
  * **実装**: `frontend/src/components/MapView.tsx`の3箇所の`as maplibregl.GeoJSONSource`キャストを、`getSource`のジェネリック呼び出し+undefinedガードへ置き換え。
  * **README.md**: 変更なし。
  * **仕様書**: 変更なし(型定義の修正であり機能仕様に影響しないため)。

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
