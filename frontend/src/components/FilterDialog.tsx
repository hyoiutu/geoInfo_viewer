import { Button, Flex, HStack, Input, NativeSelect, Text } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { type ActivityFilter, DEFAULT_ACTIVITY_FILTER } from '../types/activityFilter';
import { isActivityFilterValid } from '../utils/filterActivities';
import { AppDialog } from './AppDialog';

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
  /** 現在適用中(地図に反映済み)のフィルタ条件。ダイアログを開くたびに入力中の内容の初期値として使う */
  appliedFilter: ActivityFilter;
  /** 実行ボタンが押されたときに、入力中のフィルタ条件を渡して呼ばれるコールバック */
  onApply: (filter: ActivityFilter) => void;
  /** ダイアログを閉じる（閉じるボタン押下・背景クリック等）ときに呼ばれるコールバック */
  onClose: () => void;
};

/**
 * 自転車ログの表示絞り込み条件（年月範囲・獲得標高・平均時速・走行距離）を入力するダイアログ。
 * 入力中(draft)のフィルタ条件はこのコンポーネント内部で保持し、「実行」を押したときのみonApplyで確定値を通知する。
 * 閉じるボタン等で閉じた場合、入力中の内容は破棄される（Issue #53）
 */
export const FilterDialog = ({ isOpen, appliedFilter, onApply, onClose }: FilterDialogProps) => {
  const [draftFilter, setDraftFilter] = useState(appliedFilter);
  const isValid = isActivityFilterValid(draftFilter);

  // ダイアログを開くたびに、入力中の内容を現在適用中の内容へリセットする
  useEffect(() => {
    if (isOpen) {
      setDraftFilter(appliedFilter);
    }
  }, [isOpen, appliedFilter]);

  const updateDraft = (partial: Partial<ActivityFilter>) => {
    setDraftFilter((current) => ({ ...current, ...partial }));
  };

  const handleReset = () => {
    setDraftFilter(DEFAULT_ACTIVITY_FILTER);
  };

  const handleApply = () => {
    onApply(draftFilter);
  };

  return (
    <AppDialog
      isOpen={isOpen}
      onClose={onClose}
      title="自転車ログのフィルタ"
      footer={
        <>
          <Button onClick={handleReset} variant="ghost" size="sm">
            リセット
          </Button>
          <Button onClick={handleApply} disabled={!isValid} size="sm">
            実行
          </Button>
        </>
      }
    >
      <Flex direction="column" gap="4">
        <YearMonthField
          label="検索範囲始まり"
          year={draftFilter.startYear}
          month={draftFilter.startMonth}
          onChangeYear={(year) => updateDraft({ startYear: year })}
          onChangeMonth={(month) => updateDraft({ startMonth: month })}
        />
        <YearMonthField
          label="検索範囲終わり"
          year={draftFilter.endYear}
          month={draftFilter.endMonth}
          onChangeYear={(year) => updateDraft({ endYear: year })}
          onChangeMonth={(month) => updateDraft({ endMonth: month })}
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
          onChange={(value) => updateDraft({ minElevationGainMeters: value })}
        />
        <NumberFilterField
          label="平均時速"
          unit="km/h"
          step={0.1}
          value={draftFilter.minAverageSpeedKmh}
          onChange={(value) => updateDraft({ minAverageSpeedKmh: value })}
        />
        <NumberFilterField
          label="走行距離"
          unit="km"
          step={0.1}
          value={draftFilter.minDistanceKm}
          onChange={(value) => updateDraft({ minDistanceKm: value })}
        />
      </Flex>
    </AppDialog>
  );
};
