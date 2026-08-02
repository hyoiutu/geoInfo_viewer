import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { useGlobalInputBlocker } from '../useGlobalInputBlocker';

type TestComponentProps = {
  isActive: boolean;
  onButtonClick: () => void;
  onButtonKeyDown: () => void;
};

const TestComponent = ({ isActive, onButtonClick, onButtonKeyDown }: TestComponentProps) => {
  useGlobalInputBlocker(isActive);
  return (
    <button type="button" onClick={onButtonClick} onKeyDown={onButtonKeyDown}>
      対象ボタン
    </button>
  );
};

describe('useGlobalInputBlockerに関するテスト（PR #110レビュー対応）', () => {
  test('isActiveがtrueの間、ネストした要素へのクリックイベントが遮断される', () => {
    const onButtonClick = vi.fn();
    render(<TestComponent isActive onButtonClick={onButtonClick} onButtonKeyDown={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '対象ボタン' }));

    expect(onButtonClick).not.toHaveBeenCalled();
  });

  test('isActiveがfalseの場合、クリックイベントは通常通り届く', () => {
    const onButtonClick = vi.fn();
    render(<TestComponent isActive={false} onButtonClick={onButtonClick} onButtonKeyDown={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '対象ボタン' }));

    expect(onButtonClick).toHaveBeenCalledTimes(1);
  });

  test('isActiveがtrueの間、ネストした要素へのkeydownイベントが遮断される（Escapeキーによるダイアログクローズ等を防ぐ）', () => {
    const onButtonKeyDown = vi.fn();
    render(<TestComponent isActive onButtonClick={vi.fn()} onButtonKeyDown={onButtonKeyDown} />);

    fireEvent.keyDown(screen.getByRole('button', { name: '対象ボタン' }), { key: 'Escape' });

    expect(onButtonKeyDown).not.toHaveBeenCalled();
  });

  test('isActiveがtrueからfalseに変化すると、以降のイベントは届くようになる', () => {
    const onButtonClick = vi.fn();
    const { rerender } = render(<TestComponent isActive onButtonClick={onButtonClick} onButtonKeyDown={vi.fn()} />);

    rerender(<TestComponent isActive={false} onButtonClick={onButtonClick} onButtonKeyDown={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '対象ボタン' }));

    expect(onButtonClick).toHaveBeenCalledTimes(1);
  });

  test('アンマウント後はイベントリスナーが解除され、他のイベント処理に影響しない', () => {
    const onButtonClick = vi.fn();
    const { unmount } = render(<TestComponent isActive onButtonClick={onButtonClick} onButtonKeyDown={vi.fn()} />);
    unmount();

    const otherListener = vi.fn();
    window.addEventListener('click', otherListener);
    fireEvent.click(window);
    window.removeEventListener('click', otherListener);

    expect(otherListener).toHaveBeenCalledTimes(1);
  });
});
