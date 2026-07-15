import { Box, Button, Flex, Text } from '@chakra-ui/react';
import type { BackfillStatus } from '../api/activitiesApi';

const SECONDS_PER_MINUTE = 60;

/** BackfillProgressFooterのprops */
type BackfillProgressFooterProps = {
  /** フッターを表示するかどうか */
  isVisible: boolean;
  /** 現在の初期取り込み進捗状況。未取得の間はnull */
  backfillStatus: BackfillStatus | null;
  /** 閉じるボタンが押されたときに呼ばれるコールバック（実行中は表示されない） */
  onDismiss: () => void;
};

/**
 * 初期取り込み(バックフィル)・強制再取得の進捗を表示する、地図下部のフッター。
 * 実行中は進捗（%・件数・残り時間）を表示し、完了後は閉じるボタンを押すまで完了状態を表示し続ける
 */
export const BackfillProgressFooter = ({ isVisible, backfillStatus, onDismiss }: BackfillProgressFooterProps) => {
  if (!isVisible || backfillStatus === null) {
    return null;
  }

  return (
    <Flex borderTop="1px solid" borderColor="border" padding="3" justifyContent="space-between" alignItems="center">
      {backfillStatus.isRunning ? (
        <Box>
          <Text fontSize="sm">
            取得中... {backfillStatus.progressPercent}%（{backfillStatus.completedCount} / {backfillStatus.totalCount}）
          </Text>
          {backfillStatus.estimatedRemainingSeconds !== null && (
            <Text fontSize="sm">
              残り約{Math.ceil(backfillStatus.estimatedRemainingSeconds / SECONDS_PER_MINUTE)}分
            </Text>
          )}
        </Box>
      ) : (
        <Text fontSize="sm">取得が完了しました</Text>
      )}
      {!backfillStatus.isRunning && (
        <Button onClick={onDismiss} aria-label="閉じる" variant="ghost" size="sm">
          ×
        </Button>
      )}
    </Flex>
  );
};
