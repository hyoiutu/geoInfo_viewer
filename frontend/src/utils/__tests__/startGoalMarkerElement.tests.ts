import { describe, expect, test } from 'vitest';
import { createGoalMarkerElement, createStartMarkerElement } from '../startGoalMarkerElement';

describe('startGoalMarkerElementに関するテスト', () => {
  test('createStartMarkerElementはSVGアイコンを含むdiv要素を返す', () => {
    const element = createStartMarkerElement();

    expect(element.tagName).toBe('DIV');
    expect(element.querySelector('svg')).not.toBeNull();
  });

  test('createGoalMarkerElementはSVGアイコンを含むdiv要素を返す', () => {
    const element = createGoalMarkerElement();

    expect(element.tagName).toBe('DIV');
    expect(element.querySelector('svg')).not.toBeNull();
  });

  test('スタートとゴールで異なるアイコンが使われる', () => {
    const startElement = createStartMarkerElement();
    const goalElement = createGoalMarkerElement();

    expect(startElement.innerHTML).not.toBe(goalElement.innerHTML);
  });
});
