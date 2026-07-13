import { Box, Button, Flex, Text } from '@chakra-ui/react';
import type { CyclingActivity, PassedMunicipality } from '../api/activitiesApi';
import { usePassedMunicipalities } from '../hooks/usePassedMunicipalities';
import { layout } from '../theme';
import { toActivityDetailView } from '../utils/activityDetailView';

const NO_ACTIVITIES = 0;
const NO_MUNICIPALITIES = 0;
const INDEX_OFFSET = 1;
const BACK_BUTTON_LABEL = '戻る';
const MUNICIPALITIES_LOADING_LABEL = '通過自治体を取得中...';
const MUNICIPALITIES_EMPTY_LABEL = '該当する自治体はありません';

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

/** ActivityListのprops */
type ActivityListProps = {
  /** 選択中のアクティビティ一覧（クリックした順。selectedIdsと1:1で対応する） */
  activities: CyclingActivity[];
  /** 一覧の項目がクリックされたときに呼ばれるコールバック */
  onFocus: (index: number) => void;
  /** 一覧画面の戻るボタンが押されたときに呼ばれるコールバック */
  onBackFromList: () => void;
};

/** 走行開始日時一覧（一覧画面）を表示する */
const ActivityList = ({ activities, onFocus, onBackFromList }: ActivityListProps) => (
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

/** PassedMunicipalitiesListのprops */
type PassedMunicipalitiesListProps = {
  /** 通過した自治体一覧 */
  municipalities: PassedMunicipality[];
  /** 取得中かどうか */
  isLoading: boolean;
};

/** 通過自治体一覧を、取得中・0件・複数件の状態に応じて表示する */
const PassedMunicipalitiesList = ({ municipalities, isLoading }: PassedMunicipalitiesListProps) => {
  if (isLoading) {
    return <Text>{MUNICIPALITIES_LOADING_LABEL}</Text>;
  }
  if (municipalities.length === NO_MUNICIPALITIES) {
    return <Text>{MUNICIPALITIES_EMPTY_LABEL}</Text>;
  }
  return (
    <Flex direction="column">
      {municipalities.map((municipality) => (
        <Text key={`${municipality.prefectureName}-${municipality.municipalityName}`}>
          {`${municipality.prefectureName}${municipality.municipalityName}`}
        </Text>
      ))}
    </Flex>
  );
};

/** ActivityDetailのprops */
type ActivityDetailProps = {
  /** フォーカス中のアクティビティ */
  activity: CyclingActivity;
  /** 詳細画面の戻るボタンが押されたときに呼ばれるコールバック */
  onBackFromDetail: () => void;
};

/** フォーカス中のアクティビティの詳細（詳細画面）を表示する。フォーカス中のアクティビティが変わるたびに通過自治体を取得する */
const ActivityDetail = ({ activity, onBackFromDetail }: ActivityDetailProps) => {
  const view = toActivityDetailView(activity);
  const { municipalities, isLoading } = usePassedMunicipalities(activity.id);

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
      <Text fontWeight="bold">通過自治体</Text>
      <PassedMunicipalitiesList municipalities={municipalities} isLoading={isLoading} />
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
