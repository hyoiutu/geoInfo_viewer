import { Box, Button, Flex, Text } from '@chakra-ui/react';
import type { CyclingActivity } from '../api/activitiesApi';
import { layout } from '../theme';
import { toActivityDetailView } from '../utils/activityDetailView';

const NO_ACTIVITIES = 0;
const INDEX_OFFSET = 1;
const BACK_BUTTON_LABEL = '戻る';

/** ActivityDetailSidebarのprops */
type ActivityDetailSidebarProps = {
  /** 選択中のアクティビティ一覧（クリックした順。selectedIdsと1:1で対応する） */
  activities: CyclingActivity[];
  /** フォーカス中のアクティビティを指す、activities内のインデックス。未フォーカスの場合はnull */
  focusedIndex: number | null;
  /** 一覧の項目がクリックされたときに呼ばれるコールバック */
  onFocus: (index: number) => void;
  /** 詳細画面の戻るボタンが押されたときに呼ばれるコールバック */
  onBackFromDetail: () => void;
  /** 一覧画面の戻るボタンが押されたときに呼ばれるコールバック */
  onBackFromList: () => void;
};

/** 走行開始日時一覧（一覧画面）を表示する */
const ActivityList = ({
  activities,
  onFocus,
  onBackFromList
}: Pick<ActivityDetailSidebarProps, 'activities' | 'onFocus' | 'onBackFromList'>) => (
  <Flex direction="column" gap="3">
    <Button onClick={onBackFromList} size="sm" variant="ghost" alignSelf="flex-start">
      {BACK_BUTTON_LABEL}
    </Button>
    {activities.map((activity, index) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: 選択順に重複IDを許容するリストのため、インデックス以外に一意なキーが無い
      <Text key={index} onClick={() => onFocus(index)} cursor="pointer">
        {`${index + INDEX_OFFSET}. ${toActivityDetailView(activity).startDate}`}
      </Text>
    ))}
  </Flex>
);

/** フォーカス中のアクティビティの詳細（詳細画面）を表示する */
const ActivityDetail = ({
  activity,
  onBackFromDetail
}: {
  activity: CyclingActivity;
  onBackFromDetail: () => void;
}) => {
  const view = toActivityDetailView(activity);

  return (
    <Flex direction="column" gap="2">
      <Button onClick={onBackFromDetail} size="sm" variant="ghost" alignSelf="flex-start">
        {BACK_BUTTON_LABEL}
      </Button>
      <Text fontWeight="bold">{view.name}</Text>
      <Text>{`走行距離: ${view.distanceKm}`}</Text>
      <Text>{`獲得標高: ${view.elevationGainMeters}`}</Text>
      <Text>{`走行開始日時: ${view.startDate}`}</Text>
      <Text>{`走行終了日時: ${view.endDate}`}</Text>
      <Text>{`平均時速: ${view.averageSpeedKmh}`}</Text>
    </Flex>
  );
};

/**
 * 選択・フォーカスされたアクティビティを表示する右サイドバー。
 * 未フォーカスの場合は選択中アクティビティの走行開始日時一覧、フォーカス中の場合はその詳細を表示する。
 * 選択が1件も無い場合は何も表示しない
 */
export const ActivityDetailSidebar = ({
  activities,
  focusedIndex,
  onFocus,
  onBackFromDetail,
  onBackFromList
}: ActivityDetailSidebarProps) => {
  if (activities.length === NO_ACTIVITIES) {
    return null;
  }

  const focusedActivity = focusedIndex === null ? null : activities[focusedIndex];

  return (
    <Box
      width={layout.sidebarWidth}
      flexShrink={0}
      height="100vh"
      minHeight={0}
      overflowY="auto"
      borderLeft="1px solid"
      borderColor="border"
      padding="4"
    >
      {focusedActivity ? (
        <ActivityDetail activity={focusedActivity} onBackFromDetail={onBackFromDetail} />
      ) : (
        <ActivityList activities={activities} onFocus={onFocus} onBackFromList={onBackFromList} />
      )}
    </Box>
  );
};
