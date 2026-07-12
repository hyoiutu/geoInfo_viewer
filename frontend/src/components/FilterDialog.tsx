import { Button, Dialog, Flex, HStack, Input, NativeSelect, Portal, Text } from '@chakra-ui/react';
import type { ActivityFilter } from '../types/activityFilter';
import { isActivityFilterValid } from '../utils/filterActivities';

const MIN_YEAR = 1980;
const JANUARY = 1;
const DECEMBER = 12;
const MONTHS = Array.from({ length: DECEMBER }, (_unused, index) => index + JANUARY);
const UNSELECTED_OPTION_VALUE = '';
const VALIDATION_ERROR_MESSAGE = '年月を範囲指定する場合、年も入力してください（月のみの指定はできません）';

/**
 * 1〜現在の年までの選択肢配列を生成する
 * @returns MIN_YEARから現在の年までの配列（昇順）
 */
const buildYearOptions = (): number[] => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: currentYear - MIN_YEAR + 1 }, (_unused, index) => MIN_YEAR + index);
};

/** YearMonthFieldのprops */
type YearMonthFieldProps = {
  /** フィールドの見出し（例: 「検索範囲始まり」） */
  label: string;
  /** 選択中の年。未選択の場合はnull */
  year: number | null;
  /** 選択中の月。未選択の場合はnull */
  month: number | null;
  /** 年が変更されたときに呼ばれるコールバック */
  onChangeYear: (year: number | null) => void;
  /** 月が変更されたときに呼ばれるコールバック */
  onChangeMonth: (month: number | null) => void;
};

/** 年・月のプルダウンを横並びで表示する、年月範囲フィルタの片側（始まり/終わり）分のフィールド */
const YearMonthField = ({ label, year, month, onChangeYear, onChangeMonth }: YearMonthFieldProps) => (
  <Flex direction="column" gap="1">
    <Text fontSize="sm">{label}</Text>
    <HStack>
      <NativeSelect.Root size="sm" width="auto">
        <NativeSelect.Field
          aria-label={`${label}の年`}
          value={year === null ? UNSELECTED_OPTION_VALUE : String(year)}
          onChange={(event) =>
            onChangeYear(event.target.value === UNSELECTED_OPTION_VALUE ? null : Number(event.target.value))
          }
        >
          <option value={UNSELECTED_OPTION_VALUE}>未選択</option>
          {buildYearOptions().map((yearOption) => (
            <option key={yearOption} value={yearOption}>
              {yearOption}年
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
      <NativeSelect.Root size="sm" width="auto">
        <NativeSelect.Field
          aria-label={`${label}の月`}
          value={month === null ? UNSELECTED_OPTION_VALUE : String(month)}
          onChange={(event) =>
            onChangeMonth(event.target.value === UNSELECTED_OPTION_VALUE ? null : Number(event.target.value))
          }
        >
          <option value={UNSELECTED_OPTION_VALUE}>未選択</option>
          {MONTHS.map((monthOption) => (
            <option key={monthOption} value={monthOption}>
              {monthOption}月
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    </HStack>
  </Flex>
);

/** NumberFilterFieldのprops */
type NumberFilterFieldProps = {
  /** フィールドの見出し（例: 「獲得標高」） */
  label: string;
  /** 単位の表示（例: 「m」「km/h」） */
  unit: string;
  /** 入力値の刻み幅 */
  step: number;
  /** 現在の入力値。未入力の場合はnull */
  value: number | null;
  /** 値が変更されたときに呼ばれるコールバック */
  onChange: (value: number | null) => void;
};

/** 「〇〇以上」の数値条件を1件入力するフィールド（テキスト入力+単位表示） */
const NumberFilterField = ({ label, unit, step, value, onChange }: NumberFilterFieldProps) => (
  <Flex direction="column" gap="1">
    <Text fontSize="sm">{`${label}（${unit}以上）`}</Text>
    <Input
      aria-label={label}
      type="number"
      step={step}
      size="sm"
      width="32"
      value={value === null ? UNSELECTED_OPTION_VALUE : String(value)}
      onChange={(event) => onChange(event.target.value === UNSELECTED_OPTION_VALUE ? null : Number(event.target.value))}
    />
  </Flex>
);

/** FilterDialogのprops */
type FilterDialogProps = {
  /** ダイアログが開いているかどうか */
  isOpen: boolean;
  /** ダイアログ内の入力中（未確定）のフィルタ条件 */
  draftFilter: ActivityFilter;
  /** 入力中のフィルタ条件の一部が変更されたときに呼ばれるコールバック */
  onUpdateDraft: (partial: Partial<ActivityFilter>) => void;
  /** リセットボタンが押されたときに呼ばれるコールバック */
  onReset: () => void;
  /** 実行ボタンが押されたときに呼ばれるコールバック */
  onApply: () => void;
  /** ダイアログを閉じる（閉じるボタン押下・背景クリック等）ときに呼ばれるコールバック */
  onClose: () => void;
};

/**
 * 自転車ログの表示絞り込み条件（年月範囲・獲得標高・平均時速・走行距離）を入力するダイアログ。
 * 入力内容は「実行」を押したときのみ確定し、閉じるボタン等で閉じた場合は破棄される
 */
export const FilterDialog = ({ isOpen, draftFilter, onUpdateDraft, onReset, onApply, onClose }: FilterDialogProps) => {
  const isValid = isActivityFilterValid(draftFilter);

  const handleOpenChange = (details: { open: boolean }) => {
    if (!details.open) {
      onClose();
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>自転車ログのフィルタ</Dialog.Title>
              <Button
                onClick={onClose}
                aria-label="閉じる"
                variant="ghost"
                size="sm"
                position="absolute"
                top="2"
                right="2"
              >
                ×
              </Button>
            </Dialog.Header>
            <Dialog.Body>
              <Flex direction="column" gap="4">
                <YearMonthField
                  label="検索範囲始まり"
                  year={draftFilter.startYear}
                  month={draftFilter.startMonth}
                  onChangeYear={(year) => onUpdateDraft({ startYear: year })}
                  onChangeMonth={(month) => onUpdateDraft({ startMonth: month })}
                />
                <YearMonthField
                  label="検索範囲終わり"
                  year={draftFilter.endYear}
                  month={draftFilter.endMonth}
                  onChangeYear={(year) => onUpdateDraft({ endYear: year })}
                  onChangeMonth={(month) => onUpdateDraft({ endMonth: month })}
                />
                {!isValid && (
                  <Text fontSize="sm" color="fg.error">
                    {VALIDATION_ERROR_MESSAGE}
                  </Text>
                )}
                <NumberFilterField
                  label="獲得標高"
                  unit="m"
                  step={1}
                  value={draftFilter.minElevationGainMeters}
                  onChange={(value) => onUpdateDraft({ minElevationGainMeters: value })}
                />
                <NumberFilterField
                  label="平均時速"
                  unit="km/h"
                  step={0.1}
                  value={draftFilter.minAverageSpeedKmh}
                  onChange={(value) => onUpdateDraft({ minAverageSpeedKmh: value })}
                />
                <NumberFilterField
                  label="走行距離"
                  unit="km"
                  step={0.1}
                  value={draftFilter.minDistanceKm}
                  onChange={(value) => onUpdateDraft({ minDistanceKm: value })}
                />
              </Flex>
            </Dialog.Body>
            <Dialog.Footer>
              <Button onClick={onReset} variant="ghost" size="sm">
                リセット
              </Button>
              <Button onClick={onApply} disabled={!isValid} size="sm">
                実行
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
