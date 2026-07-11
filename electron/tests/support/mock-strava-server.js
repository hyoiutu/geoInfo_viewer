// biome-ignore-all lint/style/useNamingConvention: Strava APIレスポンス形式(snake_case)に合わせている
// E2Eテスト用のStrava APIモックサーバー。
// 実Strava APIの代わりにこのサーバーを使うことで、テスト用Stravaアカウントを用意せずに
// バックエンドの自転車ログ機能（初期取り込み・sync）をE2Eで検証できるようにする。
// Node標準のhttpモジュールのみで実装し、新規の依存パッケージは追加していない。
const http = require('node:http');
const { URL } = require('node:url');

const PORT = Number(process.env.MOCK_STRAVA_PORT) || 4010;
const DEFAULT_PER_PAGE = 30;
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const HTTP_BAD_REQUEST = 400;
const MILLISECONDS_PER_SECOND = 1000;
const ACCESS_TOKEN_TTL_SECONDS = 6 * 60 * 60;

/** @type {Array<Record<string, unknown>>} */
let activities = [];

const readJsonBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });

const sendJson = (res, statusCode, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
};

const toSummary = (activity) => ({
  id: activity.id,
  name: activity.name,
  type: activity.type,
  distance: activity.distance,
  moving_time: activity.moving_time,
  start_date: activity.start_date,
  map: { summary_polyline: activity.map.summary_polyline }
});

const handleOauthToken = (_req, res) => {
  sendJson(res, HTTP_OK, {
    access_token: 'e2e-mock-access-token',
    expires_at: Math.floor(Date.now() / MILLISECONDS_PER_SECOND) + ACCESS_TOKEN_TTL_SECONDS
  });
};

const handleListActivities = (url, res) => {
  const page = Number(url.searchParams.get('page')) || 1;
  const perPage = Number(url.searchParams.get('per_page')) || DEFAULT_PER_PAGE;
  const after = url.searchParams.get('after');
  const afterEpochSeconds = after === null ? null : Number(after);

  const filtered =
    afterEpochSeconds === null
      ? activities
      : activities.filter(
          (activity) =>
            Math.floor(new Date(activity.start_date).getTime() / MILLISECONDS_PER_SECOND) > afterEpochSeconds
        );

  const start = (page - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);

  sendJson(res, HTTP_OK, pageItems.map(toSummary));
};

const handleGetActivityDetail = (activityId, res) => {
  const activity = activities.find((candidate) => String(candidate.id) === activityId);
  if (!activity) {
    sendJson(res, HTTP_NOT_FOUND, { message: 'Not Found' });
    return;
  }
  sendJson(res, HTTP_OK, activity);
};

const handleTestReset = (_req, res) => {
  activities = [];
  sendJson(res, HTTP_OK, { count: activities.length });
};

const handleTestAddActivities = async (req, res) => {
  const body = await readJsonBody(req);
  const toAdd = Array.isArray(body) ? body : [body];
  activities.push(...toAdd);
  sendJson(res, HTTP_OK, { count: activities.length });
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, HTTP_OK, { status: 'ok' });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/oauth/token') {
      handleOauthToken(req, res);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v3/athlete/activities') {
      handleListActivities(url, res);
      return;
    }
    const detailMatch = url.pathname.match(/^\/api\/v3\/activities\/(\d+)$/);
    if (req.method === 'GET' && detailMatch) {
      handleGetActivityDetail(detailMatch[1], res);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/__test__/reset') {
      handleTestReset(req, res);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/__test__/activities') {
      await handleTestAddActivities(req, res);
      return;
    }

    sendJson(res, HTTP_NOT_FOUND, { message: 'Not Found' });
  } catch (error) {
    sendJson(res, HTTP_BAD_REQUEST, { message: String(error) });
  }
});

server.listen(PORT, () => {
  console.log(`mock-strava-server listening on http://localhost:${PORT}`);
});
