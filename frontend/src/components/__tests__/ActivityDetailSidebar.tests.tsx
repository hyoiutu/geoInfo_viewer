import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { CyclingActivity, Photo } from '../../api/activitiesApi';
import { fetchPassedMunicipalities } from '../../api/activitiesApi';
import { resolvePhotoImageUrl, resolvePhotoThumbnailUrl } from '../../api/photosApi';
import { ErrorsProbe } from '../../test-utils/ErrorsProbe';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { ActivityDetailSidebar } from '../ActivityDetailSidebar';

vi.mock('../../api/activitiesApi', () => ({
  fetchPassedMunicipalities: vi.fn()
}));

const createActivity = (overrides: Partial<CyclingActivity>): CyclingActivity => ({
  id: '1',
  name: 'テストライド',
  distanceMeters: 12345,
  movingTimeSeconds: 3600,
  elapsedTimeSeconds: 3900,
  elevationGainMeters: 250.5,
  startDate: '2026-07-01T01:00:00.000Z',
  path: null,
  summaryPath: null,
  ...overrides
});

/** 写真関連のprops（photos/isPhotosLoading）はIssue #107でMapWorkspace側へ持ち上げたため、テストでは既定値を明示的に渡す */
const DEFAULT_PHOTOS_PROPS = { photos: [] as Photo[], isPhotosLoading: false };

describe('ActivityDetailSidebarに関するテスト', () => {
  beforeEach(() => {
    vi.mocked(fetchPassedMunicipalities).mockResolvedValue([]);
  });

  test('activitiesが空の場合、何も表示しない', () => {
    const { container } = renderWithChakra(
      <ActivityDetailSidebar
        activities={[]}
        focusedActivity={null}
        onFocus={vi.fn()}
        onBackFromDetail={vi.fn()}
        onBackFromList={vi.fn()}
        onMunicipalityFocus={vi.fn()}
        {...DEFAULT_PHOTOS_PROPS}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  test('未フォーカスの場合、選択中アクティビティの走行開始日時一覧を通し番号付きで表示する', () => {
    const activities = [
      createActivity({ id: '1', startDate: '2026-07-01T01:00:00.000Z' }),
      createActivity({ id: '2', startDate: '2026-07-02T01:00:00.000Z' })
    ];

    renderWithChakra(
      <ActivityDetailSidebar
        activities={activities}
        focusedActivity={null}
        onFocus={vi.fn()}
        onBackFromDetail={vi.fn()}
        onBackFromList={vi.fn()}
        onMunicipalityFocus={vi.fn()}
        {...DEFAULT_PHOTOS_PROPS}
      />
    );

    expect(screen.getByText(`1. ${new Date('2026-07-01T01:00:00.000Z').toLocaleString('ja-JP')}`)).toBeInTheDocument();
    expect(screen.getByText(`2. ${new Date('2026-07-02T01:00:00.000Z').toLocaleString('ja-JP')}`)).toBeInTheDocument();
  });

  test('一覧の項目をクリックすると、そのインデックスでonFocusが呼ばれる', () => {
    const onFocus = vi.fn();
    const activities = [createActivity({ id: '1' }), createActivity({ id: '2' })];

    renderWithChakra(
      <ActivityDetailSidebar
        activities={activities}
        focusedActivity={null}
        onFocus={onFocus}
        onBackFromDetail={vi.fn()}
        onBackFromList={vi.fn()}
        onMunicipalityFocus={vi.fn()}
        {...DEFAULT_PHOTOS_PROPS}
      />
    );
    fireEvent.click(screen.getByText(`2. ${new Date('2026-07-01T01:00:00.000Z').toLocaleString('ja-JP')}`));

    expect(onFocus).toHaveBeenCalledWith(1);
  });

  test('一覧画面の戻るボタンを押すと、onBackFromListが呼ばれる', () => {
    const onBackFromList = vi.fn();

    renderWithChakra(
      <ActivityDetailSidebar
        activities={[createActivity({})]}
        focusedActivity={null}
        onFocus={vi.fn()}
        onBackFromDetail={vi.fn()}
        onBackFromList={onBackFromList}
        onMunicipalityFocus={vi.fn()}
        {...DEFAULT_PHOTOS_PROPS}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '戻る' }));

    expect(onBackFromList).toHaveBeenCalledTimes(1);
  });

  test('フォーカス中の場合、アクティビティの詳細（名前・距離・獲得標高・開始/終了日時・平均時速）を表示する', () => {
    const activity = createActivity({
      name: '朝ライド',
      distanceMeters: 36000,
      movingTimeSeconds: 3600,
      elapsedTimeSeconds: 3900,
      elevationGainMeters: 250.5,
      startDate: '2026-07-01T01:00:00.000Z'
    });

    renderWithChakra(
      <ActivityDetailSidebar
        activities={[activity]}
        focusedActivity={activity}
        onFocus={vi.fn()}
        onBackFromDetail={vi.fn()}
        onBackFromList={vi.fn()}
        onMunicipalityFocus={vi.fn()}
        {...DEFAULT_PHOTOS_PROPS}
      />
    );

    expect(screen.getByText('朝ライド')).toBeInTheDocument();
    expect(screen.getByText('走行距離: 36.0 km')).toBeInTheDocument();
    expect(screen.getByText('獲得標高: 251 m')).toBeInTheDocument();
    expect(screen.getByText('平均時速: 36.0 km/h')).toBeInTheDocument();
  });

  test('詳細画面の戻るボタンを押すと、onBackFromDetailが呼ばれる', () => {
    const onBackFromDetail = vi.fn();
    const activity = createActivity({});

    renderWithChakra(
      <ActivityDetailSidebar
        activities={[activity]}
        focusedActivity={activity}
        onFocus={vi.fn()}
        onBackFromDetail={onBackFromDetail}
        onBackFromList={vi.fn()}
        onMunicipalityFocus={vi.fn()}
        {...DEFAULT_PHOTOS_PROPS}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '戻る' }));

    expect(onBackFromDetail).toHaveBeenCalledTimes(1);
  });

  test('通過自治体の項目をクリックすると、その自治体でonMunicipalityFocusが呼ばれる', async () => {
    vi.mocked(fetchPassedMunicipalities).mockResolvedValue([
      { prefectureName: '東京都', municipalityName: '千代田区' },
      { prefectureName: '神奈川県', municipalityName: '横浜市中区' }
    ]);
    const onMunicipalityFocus = vi.fn();
    const activity = createActivity({ id: '42' });

    renderWithChakra(
      <ActivityDetailSidebar
        activities={[activity]}
        focusedActivity={activity}
        onFocus={vi.fn()}
        onBackFromDetail={vi.fn()}
        onBackFromList={vi.fn()}
        onMunicipalityFocus={onMunicipalityFocus}
        {...DEFAULT_PHOTOS_PROPS}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('神奈川県横浜市中区')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('神奈川県横浜市中区'));

    expect(onMunicipalityFocus).toHaveBeenCalledWith({ prefectureName: '神奈川県', municipalityName: '横浜市中区' });
  });

  test('フォーカス中の場合、対象アクティビティのIDで通過自治体を取得し一覧表示する', async () => {
    vi.mocked(fetchPassedMunicipalities).mockResolvedValue([
      { prefectureName: '東京都', municipalityName: '千代田区' },
      { prefectureName: '神奈川県', municipalityName: '横浜市中区' }
    ]);
    const activity = createActivity({ id: '42' });

    renderWithChakra(
      <ActivityDetailSidebar
        activities={[activity]}
        focusedActivity={activity}
        onFocus={vi.fn()}
        onBackFromDetail={vi.fn()}
        onBackFromList={vi.fn()}
        onMunicipalityFocus={vi.fn()}
        {...DEFAULT_PHOTOS_PROPS}
      />
    );

    expect(fetchPassedMunicipalities).toHaveBeenCalledWith('42', 'current');
    await waitFor(() => {
      expect(screen.getByText('東京都千代田区')).toBeInTheDocument();
    });
    expect(screen.getByText('神奈川県横浜市中区')).toBeInTheDocument();
  });

  test('adminBoundaryEraを指定した場合、その年代で通過自治体を取得する', () => {
    const activity = createActivity({ id: '42' });

    renderWithChakra(
      <ActivityDetailSidebar
        activities={[activity]}
        focusedActivity={activity}
        onFocus={vi.fn()}
        onBackFromDetail={vi.fn()}
        onBackFromList={vi.fn()}
        onMunicipalityFocus={vi.fn()}
        adminBoundaryEra="2000-10-01"
        {...DEFAULT_PHOTOS_PROPS}
      />
    );

    expect(fetchPassedMunicipalities).toHaveBeenCalledWith('42', '2000-10-01');
  });

  test('通過自治体が無い場合、その旨を表示する', async () => {
    vi.mocked(fetchPassedMunicipalities).mockResolvedValue([]);
    const activity = createActivity({});

    renderWithChakra(
      <ActivityDetailSidebar
        activities={[activity]}
        focusedActivity={activity}
        onFocus={vi.fn()}
        onBackFromDetail={vi.fn()}
        onBackFromList={vi.fn()}
        onMunicipalityFocus={vi.fn()}
        {...DEFAULT_PHOTOS_PROPS}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('該当する自治体はありません')).toBeInTheDocument();
    });
  });

  test('通過自治体の取得に失敗した場合、グローバルなエラースタックに追加される', async () => {
    vi.mocked(fetchPassedMunicipalities).mockRejectedValue(new Error('fetch failed'));
    const activity = createActivity({});

    renderWithChakra(
      <>
        <ActivityDetailSidebar
          activities={[activity]}
          focusedActivity={activity}
          onFocus={vi.fn()}
          onBackFromDetail={vi.fn()}
          onBackFromList={vi.fn()}
          onMunicipalityFocus={vi.fn()}
          {...DEFAULT_PHOTOS_PROPS}
        />
        <ErrorsProbe />
      </>
    );

    await waitFor(() => {
      expect(screen.getByTestId('errors-probe').textContent).toContain('fetch failed');
    });
  });

  test('isPhotosLoadingがtrueの場合、「写真を取得中...」を表示する', () => {
    const activity = createActivity({ id: '42' });

    renderWithChakra(
      <ActivityDetailSidebar
        activities={[activity]}
        focusedActivity={activity}
        onFocus={vi.fn()}
        onBackFromDetail={vi.fn()}
        onBackFromList={vi.fn()}
        onMunicipalityFocus={vi.fn()}
        photos={[]}
        isPhotosLoading={true}
      />
    );

    expect(screen.getByText('写真を取得中...')).toBeInTheDocument();
  });

  test('photosが渡された場合、サムネイルURLでグリッド表示する（Issue #105/#107）', () => {
    const photos: Photo[] = [
      { id: 1, fileName: 'a.jpg', takenAt: '2026-07-01T00:30:00.000Z', location: null },
      { id: 2, fileName: 'b.jpg', takenAt: '2026-07-01T00:40:00.000Z', location: null }
    ];
    const activity = createActivity({ id: '42' });

    renderWithChakra(
      <ActivityDetailSidebar
        activities={[activity]}
        focusedActivity={activity}
        onFocus={vi.fn()}
        onBackFromDetail={vi.fn()}
        onBackFromList={vi.fn()}
        onMunicipalityFocus={vi.fn()}
        photos={photos}
        isPhotosLoading={false}
      />
    );

    expect(screen.getByAltText('a.jpg')).toHaveAttribute('src', resolvePhotoThumbnailUrl(1));
    expect(screen.getByAltText('b.jpg')).toHaveAttribute('src', resolvePhotoThumbnailUrl(2));
  });

  test('サムネイルの読み込みに失敗した場合、フルサイズ画像のURLへフォールバックする（Issue #105）', async () => {
    const photos: Photo[] = [{ id: 1, fileName: 'a.jpg', takenAt: '2026-07-01T00:30:00.000Z', location: null }];
    const activity = createActivity({ id: '42' });

    renderWithChakra(
      <ActivityDetailSidebar
        activities={[activity]}
        focusedActivity={activity}
        onFocus={vi.fn()}
        onBackFromDetail={vi.fn()}
        onBackFromList={vi.fn()}
        onMunicipalityFocus={vi.fn()}
        photos={photos}
        isPhotosLoading={false}
      />
    );

    expect(screen.getByAltText('a.jpg')).toHaveAttribute('src', resolvePhotoThumbnailUrl(1));

    fireEvent.error(screen.getByAltText('a.jpg'));

    await waitFor(() => {
      expect(screen.getByAltText('a.jpg')).toHaveAttribute('src', resolvePhotoImageUrl(1));
    });
  });

  test('サムネイル・フルサイズ画像のいずれの読み込みにも失敗した場合、ローディング表示を消して諦める（Issue #105）', async () => {
    const photos: Photo[] = [{ id: 1, fileName: 'a.jpg', takenAt: '2026-07-01T00:30:00.000Z', location: null }];
    const activity = createActivity({ id: '42' });

    renderWithChakra(
      <ActivityDetailSidebar
        activities={[activity]}
        focusedActivity={activity}
        onFocus={vi.fn()}
        onBackFromDetail={vi.fn()}
        onBackFromList={vi.fn()}
        onMunicipalityFocus={vi.fn()}
        photos={photos}
        isPhotosLoading={false}
      />
    );

    expect(screen.getByText('a.jpg')).toBeInTheDocument();

    fireEvent.error(screen.getByAltText('a.jpg'));
    await waitFor(() => {
      expect(screen.getByAltText('a.jpg')).toHaveAttribute('src', resolvePhotoImageUrl(1));
    });
    fireEvent.error(screen.getByAltText('a.jpg'));

    await waitFor(() => {
      expect(screen.queryByText('a.jpg')).not.toBeInTheDocument();
    });
  });

  test('写真表示直後は各写真にファイル名とローディングアイコンを表示し、画像の読み込み完了後に消える', () => {
    const photos: Photo[] = [{ id: 1, fileName: 'a.jpg', takenAt: '2026-07-01T00:30:00.000Z', location: null }];
    const activity = createActivity({ id: '42' });

    renderWithChakra(
      <ActivityDetailSidebar
        activities={[activity]}
        focusedActivity={activity}
        onFocus={vi.fn()}
        onBackFromDetail={vi.fn()}
        onBackFromList={vi.fn()}
        onMunicipalityFocus={vi.fn()}
        photos={photos}
        isPhotosLoading={false}
      />
    );

    expect(screen.getByAltText('a.jpg')).toBeInTheDocument();
    expect(screen.getByText('a.jpg')).toBeInTheDocument();

    fireEvent.load(screen.getByAltText('a.jpg'));

    expect(screen.queryByText('a.jpg')).not.toBeInTheDocument();
  });

  test('写真が無い場合、その旨を表示する', () => {
    const activity = createActivity({});

    renderWithChakra(
      <ActivityDetailSidebar
        activities={[activity]}
        focusedActivity={activity}
        onFocus={vi.fn()}
        onBackFromDetail={vi.fn()}
        onBackFromList={vi.fn()}
        onMunicipalityFocus={vi.fn()}
        {...DEFAULT_PHOTOS_PROPS}
      />
    );

    expect(screen.getByText('該当する写真はありません')).toBeInTheDocument();
  });
});
