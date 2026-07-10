# geoInfo_viewer

あらゆる位置情報を統合して一つの地図で見られるようにするアプリケーションです。仕様の詳細は[specs/system_specification.md](specs/system_specification.md)を参照してください。

## 前提環境

以下がインストール済みであることを前提としています。

- Node.js（`pnpm`が利用できるバージョン。`package.json`の`packageManager`でpnpmのバージョンを固定しているため、[Corepack](https://nodejs.org/api/corepack.html)経由（`corepack enable`）でのインストールを推奨します）
- Docker / Docker Compose（バックエンド用データベース(PostgreSQL/PostGIS)をコンテナで起動するために使用します）

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
- `STRAVA_REFRESH_TOKEN`: OAuth認可により取得したリフレッシュトークン（失効しないため、手動で一度取得し設定する）。取得手順は[Strava公式のOAuth連携ドキュメント](https://developers.strava.com/docs/authentication/)を参照。概要は以下の通り。
  1. `https://www.strava.com/oauth/authorize?client_id=<STRAVA_CLIENT_ID>&redirect_uri=http://localhost&response_type=code&scope=activity:read_all` をブラウザで開き認可する（`scope=activity:read_all`を明示しないと、後述のアクティビティ取得APIが401エラーになるため必須）
  2. リダイレクト先URLの`code=`パラメータの値をコピーする
  3. `curl -X POST https://www.strava.com/oauth/token -d client_id=<STRAVA_CLIENT_ID> -d client_secret=<STRAVA_CLIENT_SECRET> -d code=<コピーしたcode> -d grant_type=authorization_code` を実行し、レスポンスの`refresh_token`を`STRAVA_REFRESH_TOKEN`に設定する

`.env`はGit管理対象外（`.gitignore`）です。

### バックエンド用データベース（PostgreSQL/PostGIS）

ルートの`docker-compose.yml`でPostGIS同梱のPostgreSQLコンテナを起動します（`backend/.env.example`のDB接続情報はこのコンテナにそのまま接続できる値になっています）。

```bash
docker-compose up -d
pnpm --filter backend run migration:run
```

コンテナはホストの`5433`番ポートで待ち受けます（Homebrew等でネイティブにPostgreSQLを起動している場合の`5432`との衝突を避けるため）。

#### マイグレーションの実行タイミング

`pnpm --filter backend run migration:run`は以下のタイミングで実行してください。

- 初回セットアップ時（`docker-compose up -d`で新規にDBコンテナを起動した直後）
- `backend/src/migrations/`配下に新しいマイグレーションファイルが追加された変更を`git pull`等で取り込んだ後（`pnpm --filter backend run dev`でバックエンドを起動する前に実行すること。未適用のマイグレーションがあるとDBのテーブル定義がコードと一致せず、起動時やAPI呼び出し時にエラーになります）

他に利用可能なマイグレーション関連コマンド:

```bash
pnpm --filter backend run migration:generate  # Entityの変更差分からマイグレーションファイルを生成
pnpm --filter backend run migration:revert    # 直近のマイグレーションを1件分ロールバック
```