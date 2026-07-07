# geoInfo_viewer

## 開発環境セットアップ

### バックエンド（Strava連携）

自転車ログ表示機能はStrava APIと連携するため、`backend/.env.example`を`backend/.env`にコピーし、Strava側で取得した認証情報を設定してください。

```bash
cp backend/.env.example backend/.env
```

- `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET`: [Stravaの開発者向けAPIアプリケーション設定](https://www.strava.com/settings/api)で取得できるID・シークレット
- `STRAVA_REFRESH_TOKEN`: OAuth認可により取得したリフレッシュトークン（失効しないため、手動で一度取得し設定する。取得手順はStrava公式のOAuth連携ドキュメントを参照）

`.env`はGit管理対象外（`.gitignore`）です。