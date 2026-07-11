// biome-ignore-all lint/style/useNamingConvention: Strava APIレスポンス形式(snake_case)に合わせたテストフィクスチャ
// E2Eテスト用のダミーアクティビティ（Strava API形式）を生成するヘルパー。
// mock-strava-server.js（CommonJS, requireで読み込み）とPlaywrightの*.spec.ts（importで読み込み）の両方から使う。

// Googleのポリラインアルゴリズム(標準アルゴリズム)によるエンコード。
// バックエンドが使う@mapbox/polylineのdecode()と互換の形式を生成する。
function encodeNumber(num) {
  let output = '';
  let value = num;
  while (value >= 0x20) {
    output += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
    value >>= 5;
  }
  output += String.fromCharCode(value + 63);
  return output;
}

function encodeSignedNumber(num) {
  let signedNum = num << 1;
  if (num < 0) {
    signedNum = ~signedNum;
  }
  return encodeNumber(signedNum);
}

// points: [lat, lng][]
function encodePolyline(points) {
  let output = '';
  let prevLat = 0;
  let prevLng = 0;
  for (const [lat, lng] of points) {
    const lat5 = Math.round(lat * 1e5);
    const lng5 = Math.round(lng * 1e5);
    output += encodeSignedNumber(lat5 - prevLat);
    output += encodeSignedNumber(lng5 - prevLng);
    prevLat = lat5;
    prevLng = lng5;
  }
  return output;
}

// MapView.tsxのデフォルト地図中心 [139.1798829, 35.2756364] ([lng, lat]) 付近の短いルート。
const ROUTE_NEAR_DEFAULT_CENTER = [
  [35.2756364, 139.1798829],
  [35.278, 139.183],
  [35.281, 139.187],
  [35.284, 139.191],
  [35.287, 139.195]
];

// sync()の新規アクティビティ検出シナリオ用に、初期フィクスチャとは視覚的に区別できる別ルート
// （同じデフォルト中心付近だが逆方向・オフセット済み）。
const ROUTE_NEW_UPLOAD = [
  [35.2756364, 139.1798829],
  [35.273, 139.177],
  [35.27, 139.173],
  [35.267, 139.169],
  [35.264, 139.165]
];

const ENCODED_ROUTE = encodePolyline(ROUTE_NEAR_DEFAULT_CENTER);
const ENCODED_ROUTE_NEW_UPLOAD = encodePolyline(ROUTE_NEW_UPLOAD);

// id: number, name: string, startDate: string(ISO8601), encodedRoute?: string を渡してフィクスチャ1件分を作る。
function createFixtureActivity({ id, name, startDate, encodedRoute = ENCODED_ROUTE }) {
  return {
    id,
    name,
    type: 'Ride',
    distance: 12345.6,
    moving_time: 3600,
    start_date: startDate,
    map: {
      summary_polyline: encodedRoute,
      polyline: encodedRoute
    }
  };
}

// バックフィル(初期取り込み)シナリオ用の初期フィクスチャ3件。
function createInitialFixtures() {
  return [
    createFixtureActivity({ id: 900000001, name: 'E2Eテストライド1', startDate: '2026-01-01T00:00:00Z' }),
    createFixtureActivity({ id: 900000002, name: 'E2Eテストライド2', startDate: '2026-01-02T00:00:00Z' }),
    createFixtureActivity({ id: 900000003, name: 'E2Eテストライド3', startDate: '2026-01-03T00:00:00Z' })
  ];
}

const NEW_UPLOAD_FUTURE_MARGIN_MS = 60_000;

// sync()が新規アクティビティを検出できるかのシナリオ用の1件を作る。
// sync()は「前回同期時刻(実時刻)より後のstart_date」を新規判定に使う（afterはepoch秒に丸められるため、
// 単なる現在時刻だと前回同期時刻と同じ秒に丸められ「新規」と判定されないことがある）。
// 固定の過去日時にすると、テスト実行時の前回同期時刻より前になり確実に新規と判定されなくなるため、
// 呼び出し時点より十分先の未来時刻を使う。視覚的に初期フィクスチャと区別できるよう別ルートも使う。
function createNewUploadFixture() {
  return createFixtureActivity({
    id: 900000004,
    name: 'E2E新規アップロードライド',
    startDate: new Date(Date.now() + NEW_UPLOAD_FUTURE_MARGIN_MS).toISOString(),
    encodedRoute: ENCODED_ROUTE_NEW_UPLOAD
  });
}

module.exports = {
  encodePolyline,
  createFixtureActivity,
  createInitialFixtures,
  createNewUploadFixture
};
