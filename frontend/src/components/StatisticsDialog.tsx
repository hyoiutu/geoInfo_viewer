import { Heading, Stack, Text } from '@chakra-ui/react';
import type { CyclingActivity } from '../api/activitiesApi';
import { toActivityStatisticsView } from '../utils/activityStatistics';
import { AppDialog } from './AppDialog';

/** StatisticsDialogのprops */
type StatisticsDialogProps = {
  /** ダイアログが開いているかどうか */
  isOpen: boolean;
  /** 集計対象の全アクティビティ一覧 */
  activities: CyclingActivity[];
  /** ダイアログを閉じるときに呼ばれるコールバック */
  onClose: () => void;
};

/** 全アクティビティの統計データ（件数・総走行距離）を表示するダイアログ */
export const StatisticsDialog = ({ isOpen, activities, onClose }: StatisticsDialogProps) => {
  const { totalCount, totalDistanceKm } = toActivityStatisticsView(activities);

  return (
    <AppDialog isOpen={isOpen} onClose={onClose} title="統計データ">
      <Stack gap="2">
        <Heading size="sm">アクティビティ統計</Heading>
        <Text>全アクティビティ数: {totalCount}件</Text>
        <Text>総走行距離数: {totalDistanceKm}</Text>
      </Stack>
    </AppDialog>
  );
};
