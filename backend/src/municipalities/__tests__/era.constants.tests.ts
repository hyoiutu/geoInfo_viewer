import { BadRequestException } from '@nestjs/common';
import { describe, expect, test } from 'vitest';
import {
  assertMunicipalityEra,
  isMunicipalityEra,
  MUNICIPALITY_ERA_CURRENT,
  MUNICIPALITY_ERA_PRE_HEISEI_MERGER,
  MUNICIPALITY_ERA_PRE_SHOWA_MERGER,
  MUNICIPALITY_ERAS
} from '../era.constants';

describe('isMunicipalityEraに関するテスト', () => {
  test.each(MUNICIPALITY_ERAS)('%sのとき、trueを返す', (era) => {
    expect(isMunicipalityEra(era)).toBe(true);
  });

  test('MUNICIPALITY_ERASに含まれない値のとき、falseを返す', () => {
    expect(isMunicipalityEra('1999-01-01')).toBe(false);
  });

  test('MUNICIPALITY_ERA_CURRENTはMUNICIPALITY_ERASの先頭要素である', () => {
    expect(MUNICIPALITY_ERAS[0]).toBe(MUNICIPALITY_ERA_CURRENT);
  });

  test('MUNICIPALITY_ERA_PRE_HEISEI_MERGERは平成の大合併前(2000-10-01)を表し、MUNICIPALITY_ERASに含まれる', () => {
    expect(MUNICIPALITY_ERA_PRE_HEISEI_MERGER).toBe('2000-10-01');
    expect(MUNICIPALITY_ERAS).toContain(MUNICIPALITY_ERA_PRE_HEISEI_MERGER);
  });

  test('MUNICIPALITY_ERA_PRE_SHOWA_MERGERは昭和の大合併前(1950-10-01)を表し、MUNICIPALITY_ERASに含まれる', () => {
    expect(MUNICIPALITY_ERA_PRE_SHOWA_MERGER).toBe('1950-10-01');
    expect(MUNICIPALITY_ERAS).toContain(MUNICIPALITY_ERA_PRE_SHOWA_MERGER);
  });
});

describe('assertMunicipalityEraに関するテスト', () => {
  test.each(MUNICIPALITY_ERAS)('%sのとき、そのまま返す', (era) => {
    expect(assertMunicipalityEra(era)).toBe(era);
  });

  test('MUNICIPALITY_ERASに含まれない値のとき、BadRequestExceptionを投げる', () => {
    expect(() => assertMunicipalityEra('1999-01-01')).toThrow(BadRequestException);
  });
});
