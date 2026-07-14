import { describe, expect, test } from 'vitest';
import { createGoalMarkerElement, createStartMarkerElement } from '../startGoalMarkerElement';

describe('startGoalMarkerElementに関するテスト', () => {
  test('createStartMarkerElementはSVGアイコンを含むdiv要素とReact rootを返す', () => {
    const { element, root } = createStartMarkerElement();

    expect(element.tagName).toBe('DIV');
    expect(element.querySelector('svg')).not.toBeNull();
    expect(typeof root.unmount).toBe('function');
  });

  test('createGoalMarkerElementはSVGアイコンを含むdiv要素とReact rootを返す', () => {
    const { element, root } = createGoalMarkerElement();

    expect(element.tagName).toBe('DIV');
    expect(element.querySelector('svg')).not.toBeNull();
    expect(typeof root.unmount).toBe('function');
  });

  test('スタートとゴールで異なるアイコンが使われる', () => {
    const { element: startElement } = createStartMarkerElement();
    const { element: goalElement } = createGoalMarkerElement();

    expect(startElement.innerHTML).not.toBe(goalElement.innerHTML);
  });

  test('rootをunmountすると要素の中身が空になる', () => {
    const { element, root } = createStartMarkerElement();

    root.unmount();

    expect(element.querySelector('svg')).toBeNull();
  });
});
