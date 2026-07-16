import type { MunicipalityEra } from '../types/municipalityEra';

/** 年代選択プルダウンに表示する選択肢（表示順） */
export type MunicipalityEraOption = {
  /** 年代識別子 */
  value: MunicipalityEra;
  /** プルダウンに表示するラベル */
  label: string;
};

export const MUNICIPALITY_ERA_OPTIONS: MunicipalityEraOption[] = [
  { value: 'current', label: '現在' },
  { value: '2000-10-01', label: '2000年(平成の大合併前)' }
];
