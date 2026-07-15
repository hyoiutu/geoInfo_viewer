import { expect } from 'vitest';
import { AppException } from '../common/errors/app.exception';

/**
 * errorがAppExceptionのインスタンスであることをアサーションし、以降errorの型をAppExceptionへ絞り込む。
 * 期待に反する場合はexpect().toBeInstanceOf()自体が例外を投げてテストを失敗させるため、
 * 絞り込みに失敗した場合の処理を呼び出し側で個別に書く必要は無い
 * @param error 検証対象のエラー（catch節のerror等、型がunknownの値）
 */
export function assertIsAppException(error: unknown): asserts error is AppException {
  expect(error).toBeInstanceOf(AppException);
}
