# geoInfo_viewer

## 開発環境セットアップ

### アプリケーションの起動方法

#### 開発時（ホットリロードあり）

以下の3つを、それぞれ別ターミナルで起動してください（`pnpm run dev:backend`は後述のDB・Strava連携のセットアップが完了している必要があります）。

```bash
pnpm run dev:backend    # バックエンド(NestJS)を起動
pnpm run dev:renderer   # フロントエンド(Vite/React)を起動
pnpm run dev:electron   # dev:rendererの起動を待ってからElectronアプリを起動
```

`dev:electron`は`ELECTRON_RENDERER_URL`にViteのdevサーバー（`http://localhost:5173`）を設定してElectronを起動するため、フロントエンドの変更がホットリロードされます。

#### 本番相当の動作確認時（ホットリロード無し）

```bash
pnpm run start   # build（frontend/electronのビルド）してからElectronアプリを起動
```

`ELECTRON_RENDERER_URL`を設定しないため、ビルド済みの静的ファイル（`frontend/dist/index.html`）を読み込みます。コードを変更した場合は再度`pnpm run start`を実行してください。

### バックエンド（Strava連携）

自転車ログ表示機能はStrava APIと連携するため、`backend/.env.example`を`backend/.env`にコピーし、Strava側で取得した認証情報を設定してください。

```bash
cp backend/.env.example backend/.env
```

- `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET`: [Stravaの開発者向けAPIアプリケーション設定](https://www.strava.com/settings/api)で取得できるID・シークレット
- `STRAVA_REFRESH_TOKEN`: OAuth認可により取得したリフレッシュトークン（失効しないため、手動で一度取得し設定する。取得手順はStrava公式のOAuth連携ドキュメントを参照）

`.env`はGit管理対象外（`.gitignore`）です。

### バックエンド用データベース（PostgreSQL/PostGIS）

ルートの`docker-compose.yml`でPostGIS同梱のPostgreSQLコンテナを起動します（`backend/.env.example`のDB接続情報はこのコンテナにそのまま接続できる値になっています）。

```bash
docker-compose up -d
pnpm --filter backend run migration:run
```

コンテナはホストの`5433`番ポートで待ち受けます（Homebrew等でネイティブにPostgreSQLを起動している場合の`5432`との衝突を避けるため）。