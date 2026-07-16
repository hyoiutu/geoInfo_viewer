import { BadRequestException } from '@nestjs/common';
import { describe, expect, test } from 'vitest';
import { assertMunicipalityEra, isMunicipalityEra, MUNICIPALITY_ERA_CURRENT, MUNICIPALITY_ERAS } from '../era.constants';

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
});

describe('assertMunicipalityEraに関するテスト', () => {
  test.each(MUNICIPALITY_ERAS)('%sのとき、そのまま返す', (era) => {
    expect(assertMunicipalityEra(era)).toBe(era);
  });

  test('MUNICIPALITY_ERASに含まれない値のとき、BadRequestExceptionを投げる', () => {
    expect(() => assertMunicipalityEra('1999-01-01')).toThrow(BadRequestException);
  });
});
