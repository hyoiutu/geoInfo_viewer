import { useAtomValue } from 'jotai';
import { errorsAtom } from '../atoms/errorsAtom';

/** グローバルなエラースタック（errorsAtom）の現在値をテストから検証できるよう、テキストとして描画するテスト専用コンポーネント */
export const ErrorsProbe = () => {
  const errors = useAtomValue(errorsAtom);
  return <div data-testid="errors-probe">{JSON.stringify(errors)}</div>;
};
