/** 自転車ログのフィルタ条件。各項目はnullの場合その条件によるフィルタリングを行わない */
export type ActivityFilter = {
  /** 検索範囲の開始年。未入力の場合はnull */
  startYear: number | null;
  /** 検索範囲の開始月（1〜12）。startYearがnullでない場合に、これがnullなら1月とみなす */
  startMonth: number | null;
  /** 検索範囲の終了年。未入力の場合はnull */
  endYear: number | null;
  /** 検索範囲の終了月（1〜12）。endYearがnullでない場合に、これがnullなら12月とみなす */
  endMonth: number | null;
  /** 獲得標高の下限（メートル、この値以上のアクティビティのみ表示）。未入力の場合はnull */
  minElevationGainMeters: number | null;
  /** 平均時速の下限（km/h、この値以上のアクティビティのみ表示）。未入力の場合はnull */
  minAverageSpeedKmh: number | null;
  /** 走行距離の下限（km、この値以上のアクティビティのみ表示）。未入力の場合はnull */
  minDistanceKm: number | null;
};

/** 全項目が未入力（フィルタリングを一切行わない）状態のActivityFilter */
export const DEFAULT_ACTIVITY_FILTER: ActivityFilter = {
  startYear: null,
  startMonth: null,
  endYear: null,
  endMonth: null,
  minElevationGainMeters: null,
  minAverageSpeedKmh: null,
  minDistanceKm: null
};
