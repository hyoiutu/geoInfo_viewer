/// <reference types="vite/client" />

// biome-ignore lint/style/useConsistentTypeDefinitions: vite/clientのImportMetaEnvへ宣言をマージするためinterfaceが必須（typeでは不可）
interface ImportMetaEnv {
  /** バックエンドAPIの接続先ベースURL。未指定時はhttp://localhost:3000を使う（E2Eテストでポートを分離する用途） */
  readonly VITE_BACKEND_BASE_URL?: string;
}
