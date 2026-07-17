# クラス図（現状の実装）

Issue #29 の対応として、現在の実装（2026-07-14時点、PR #40まで）についてのクラス図と、設計上の改善提案をまとめる。

バックエンド（NestJS、実際のクラス設計）とフロントエンド（React、関数コンポーネント+フック）は設計の性質が異なるため、図を分けて作成した。

## バックエンド

```mermaid
classDiagram
    class ActivitiesController {
        +findAll() CyclingActivityDto[]
        +sync() SyncResult
        +startBackfill() BackfillStartResult
        +startForceRefetch() BackfillStartResult
        +getBackfillStatus() BackfillStatus
        +getPassedMunicipalities(id, era) PassedMunicipalityDto[]
    }
    class MunicipalitiesController {
        +getBoundaries(era) FeatureCollection
    }
    class ActivitiesService {
        +findAll() CyclingActivityDto[]
        +sync() SyncResult
    }
    class ActivitiesBackfillService {
        -running boolean
        -lastError AppErrorInfo
        +start() BackfillStartResult
        +startForceRefetch() BackfillStartResult
        +getStatus() BackfillStatus
    }
    class StravaActivitiesService {
        +fetchCyclingActivities(options) StravaActivity[]
        +fetchCyclingActivityDetail(id) StravaActivityDetail
    }
    class StravaAuthService {
        -tokenState TokenState
        +getAccessToken() string
    }
    class StravaApiClient {
        +getActivities(accessToken, params) StravaActivity[]
        +getActivityDetail(accessToken, activityId) StravaActivityDetail
        +refreshToken(params) StravaTokenResponse
    }
    class StravaRateLimiterService {
        +wait() Promise~void~
    }
    class MunicipalitiesService {
        +findPassedMunicipalities(activityId, era) PassedMunicipalityDto[]
        +findBoundariesByEra(era) FeatureCollection
    }
    class CyclingActivityRepository {
        +findAll() CyclingActivityEntity[]
        +findPendingDetail() CyclingActivityEntity[]
        +saveDetail(entity) void
        +saveDetails(entities) void
        +savePlaceholdersIfNotExists(activities) void
        +resetAllDetailFetchedAt() void
        +countAll() number
        +countPendingDetail() number
        +countCompletedDetail() number
    }
    class CyclingActivityEntity {
        +id string
        +name string
        +distanceMeters number
        +path MultiLineString
        +detailFetchedAt Date
    }
    class SyncStateEntity {
        +lastSyncedAt Date
    }
    class MunicipalityEntity {
        +era string
        +prefectureName string
        +municipalityName string
        +geom MultiPolygon
    }
    class AllExceptionsFilter {
        +catch(exception, host) void
    }
    class AppException {
        +errorCode AppErrorCode
        +message string
        +hint string
    }
    class HttpException
    AppException --|> HttpException

    ActivitiesController --> ActivitiesService
    ActivitiesController --> ActivitiesBackfillService
    ActivitiesController --> MunicipalitiesService
    MunicipalitiesController --> MunicipalitiesService
    ActivitiesService --> StravaActivitiesService
    ActivitiesService --> ActivitiesBackfillService : 実行中判定を委譲
    ActivitiesService --> CyclingActivityRepository
    ActivitiesService --> SyncStateEntity : Repository
    ActivitiesBackfillService --> StravaActivitiesService
    ActivitiesBackfillService --> StravaRateLimiterService
    ActivitiesBackfillService --> CyclingActivityRepository
    CyclingActivityRepository --> CyclingActivityEntity : Repository
    StravaActivitiesService --> StravaAuthService
    StravaActivitiesService --> StravaRateLimiterService
    StravaActivitiesService --> StravaApiClient
    StravaAuthService --> StravaApiClient
    MunicipalitiesService --> MunicipalityEntity : Repository
    AllExceptionsFilter ..> AppException : 整形して返す
```

- `toStravaApiException`（`strava-api.exception.ts`）は独立した例外クラスではなく、axiosエラーを`AppException`インスタンスへ変換する純粋関数。`StravaActivitiesService`/`StravaAuthService`はこれをそのままthrowする。
- `cycling-activity-entity.util.ts`（`toPlaceholderCyclingActivityEntity`・`toCyclingActivityEntityFromDetail`）・`cycling-activity-dto.util.ts`（`toCyclingActivityDto`）はクラスを持たない変換関数群で、`CyclingActivityEntity`⇔Strava API⇔DTOの変換をこの層に集約している。

### モジュール依存関係

```mermaid
classDiagram
    class AppModule
    class ActivitiesModule
    class StravaModule
    class MunicipalitiesModule

    AppModule --> ActivitiesModule
    ActivitiesModule --> StravaModule
    ActivitiesModule --> MunicipalitiesModule
```

## フロントエンド

Reactの関数コンポーネント・フックはクラスではないが、依存関係をクラス図の記法で表現する（コンポーネントは`<<component>>`、フックは`<<hook>>`、グローバルステートは`<<atom>>`のステレオタイプを付与）。

```mermaid
classDiagram
    class App {
        <<component>>
    }
    class MapWorkspace {
        <<component>>
    }
    class MapControls {
        <<component>>
    }
    class LayerDialog {
        <<component>>
    }
    class SettingsDialog {
        <<component>>
    }
    class BackfillProgressFooter {
        <<component>>
    }
    class MapView {
        <<component>>
    }
    class ActivityDetailSidebar {
        <<component>>
    }
    class FilterDialog {
        <<component>>
    }
    class ErrorDialog {
        <<component>>
    }
    class AppDialog {
        <<component>>
    }
    class useLayerVisibility {
        <<hook>>
    }
    class useBackfillStatus {
        <<hook>>
    }
    class useBackfillProgressFooter {
        <<hook>>
    }
    class useActivitySelection {
        <<hook>>
    }
    class useActivityFilter {
        <<hook>>
    }
    class usePassedMunicipalities {
        <<hook>>
    }
    class useErrorReporter {
        <<hook>>
    }
    class errorsAtom {
        <<atom>>
    }

    App --> MapWorkspace
    MapWorkspace --> MapControls
    MapWorkspace --> LayerDialog
    MapWorkspace --> SettingsDialog
    MapWorkspace --> BackfillProgressFooter
    MapWorkspace --> MapView
    MapWorkspace --> ActivityDetailSidebar
    MapWorkspace --> FilterDialog
    MapWorkspace --> ErrorDialog
    MapWorkspace --> useLayerVisibility
    MapWorkspace --> useBackfillStatus
    MapWorkspace --> useActivitySelection
    MapWorkspace --> useActivityFilter
    BackfillProgressFooter --> useBackfillProgressFooter
    MapView --> useErrorReporter
    ActivityDetailSidebar --> usePassedMunicipalities
    usePassedMunicipalities --> useErrorReporter
    useBackfillStatus --> useErrorReporter
    useErrorReporter --> errorsAtom
    ErrorDialog --> errorsAtom
    LayerDialog --> AppDialog
    SettingsDialog --> AppDialog
    FilterDialog --> AppDialog
    ErrorDialog --> AppDialog
```

- Issue #28（PR #40）でエラー状態を`errorsAtom`によるグローバルステートへ切り出したことで、`MapView`・`ActivityDetailSidebar`・`useBackfillStatus`・`usePassedMunicipalities`は`useErrorReporter`を直接呼び出すのみになり、`onError`のprops経由の受け渡しが無くなった。
- Issue #32で左サイドバー（`LayerSidebar`）を廃止し、地図右下に浮かぶ`MapControls`のアイコンから`LayerDialog`・`FilterDialog`・`SettingsDialog`を開く構成へ変更した。初期取り込み・強制再取得の進捗表示は、設定ダイアログが即座に閉じる仕様になったことに伴い、地図下部の`BackfillProgressFooter`（表示状態を`useBackfillProgressFooter`で管理）へ移した。
- PR #55のレビュー対応として、`LayerDialog`・`SettingsDialog`・`FilterDialog`・`ErrorDialog`が共通して持っていたChakra UIの`Dialog.Root`/`Backdrop`/`Positioner`/`Content`等のラッパー構造を`AppDialog`（新規）へ切り出した。各ダイアログはJSXのネスト深さが1階層に集約され、`check-file-size.mjs`（design_principles.md参照）が検出していた`LayerDialog`のネスト深さ超過も解消された。
- `layerVisibility`・`selectedIds`/`focusedId`・`filter`は、現時点では`MapWorkspace`から直接の子コンポーネントへ渡されるのみで、深いバケツリレーは発生していない。

## 設計上の改善提案

1. **（対応済み・Issue #50）`ActivitiesService`と`ActivitiesBackfillService`の責務の重なり**: 両者とも`StravaActivitiesService`と`CyclingActivityEntity`のRepositoryに直接依存しており、Strava詳細取得→Entity変換→DB保存という同じ手順を（`cycling-activity-entity.util.ts`の共通関数経由とはいえ）別々の場所で呼び出していた。両サービスが共通で使う`CyclingActivityRepository`（TypeORMのRepositoryをラップする独自クラス、`activities/cycling-activity.repository.ts`）を切り出し、DB未登録分のみプレースホルダー保存する重複チェック処理（`savePlaceholdersIfNotExists`）を含む全てのDBアクセスを一本化した。
2. **`ActivitiesController`が3つのサービスに直接依存している**: `ActivitiesService`・`ActivitiesBackfillService`・`MunicipalitiesService`という異なる関心事（参照/新規アクティビティ取得・バックフィル・逆ジオコーディング）を1つのコントローラーが束ねている。現状はエンドポイント数が少なく許容範囲だが、今後エンドポイントが増える場合はコントローラーの分割（例: `MunicipalitiesController`を独立させる）を検討するとよい。
3. **（対応済み・Issue #52）`StravaActivitiesService`/`StravaAuthService`が`HttpService`（axiosの薄いラッパー）に直接依存**: `StravaApiClient`（`strava/strava-api.client.ts`）を切り出し、HTTPリクエストの組み立て・実行とエラーのAppExceptionへの変換のみをその責務とした。認証トークンのキャッシュ・ページング・アクティビティ種別によるフィルタリングは引き続き`StravaActivitiesService`/`StravaAuthService`側の責務として残している。
4. **フロントエンドの`MapWorkspace`が担う責務の広さ**: レイヤー表示状態・バックフィル進捗・アクティビティ選択・フィルタ条件と、複数のフックを束ねている。Issue #32（左サイドバー廃止・Map Controlsへの移行）で`LayerDialog`・`SettingsDialog`・`BackfillProgressFooter`という独立したコンポーネントに分割したが、各コンポーネントへの配線（フックの呼び出し・propsの受け渡し）自体は引き続き`MapWorkspace`が担っている。責務の広さそのものの解消（例: Contextやカスタムフックへの集約）は現状の規模では過剰設計になりうるため、追加のフックが増えるタイミングで改めて検討する。
5. **エラーハンドリングの一貫性は良好**: バックエンドは`AllExceptionsFilter`によるレスポンス形式の統一、フロントエンドは`errorsAtom`によるグローバルなエラースタックで一元管理されており、この部分の設計は現状の規模に対して適切と判断する。追加の変更提案は無い。
