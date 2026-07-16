import {
  MUNICIPALITY_ERA_CURRENT,
  MUNICIPALITY_ERA_PRE_HEISEI_MERGER,
  MUNICIPALITY_ERA_PRE_SHOWA_MERGER,
  type MunicipalityEra
} from '../types/municipalityEra';

/** 年代選択プルダウンに表示する選択肢（表示順） */
export type MunicipalityEraOption = {
  /** 年代識別子 */
  value: MunicipalityEra;
  /** プルダウンに表示するラベル */
  label: string;
};

export const MUNICIPALITY_ERA_OPTIONS: MunicipalityEraOption[] = [
  { value: MUNICIPALITY_ERA_CURRENT, label: '現在' },
  { value: MUNICIPALITY_ERA_PRE_HEISEI_MERGER, label: '2000年(平成の大合併前)' },
  { value: MUNICIPALITY_ERA_PRE_SHOWA_MERGER, label: '1950年(昭和の大合併前)' }
];
