# geo_info_viewer 仕様書 概要
あらゆる位置情報を統合して一つの地図で見られるようにするアプリケーション

# 技術スタック
### 共通基盤
- Electron
  - デスクトップアプリケーションの実行基盤。メインプロセスでNestJSバックエンドを起動し、レンダラープロセスでReactフロントエンドを表示する構成とする

### フロントエンド
- 使用言語
  - TypeScript
- フレームワーク
  - React
- UIコンポーネント
  - ChakraUI
- 地図描画
  - MapBox（mapbox-gl-js）
- テスト
  - vite + vitest
  - testinglibrary
  - playwright
  - husky
  - biome
- パッケージマネージャー
  - pnpm

### バックエンド
- 使用言語
  - TypeScript
- フレームワーク
  - NestJS
- DB
  - PostgreSQL
  - PostGIS
- テスト
  - vite + vitest
  - husky
  - biome
- パッケージマネージャー
  - pnpm

## ディレクトリ構造
- root
  - backend
    - src
      - ...
    - ...
  - frontend 
    - src
      - ...
    - ...
  - README.md
  - その他ドキュメントなど

# 機能
## 地図表示・操作機能
- Electron上のアプリケーションで地図を表示することができる
- 地図はドラッグ操作で移動することができる
- 地図はスクロール操作で拡大・縮小することができる
- 地図にはベクタタイル画像を用いてズームレベルに応じて適切なタイルで地図表示する
- デフォルトで表示するタイルはOSM

## 自転車ログ表示機能
WIP

## 位置情報付きメディア表示機能
WIP