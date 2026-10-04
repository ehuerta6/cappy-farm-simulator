import { describe, expect, it } from 'vitest';
import { applyAction, carrotCount, CappyError, createFarm, objectiveComplete, type Direction } from '../src/simulation';

describe('farm simulation', () => {
  it.each<[Direction, number, number]>([['up', 1, 2], ['down', 1, 4], ['left', 0, 3], ['right', 2, 3]])(
    'moves one tile %s without mutating the original state', (direction, x, y) => {
      const original = createFarm();
      expect(applyAction(original, { kind: 'move', direction }).cappy).toEqual({ x, y, direction });
      expect(original.cappy).toEqual({ x: 1, y: 3, direction: 'right' });
    },
  );
  it.each<[Direction, number, number]>([['up', 1, 0], ['down', 1, 5], ['left', 0, 3], ['right', 5, 3]])(
    'rejects the %s boundary', (direction, x, y) => {
      const state = createFarm();
      state.cappy = { x, y, direction };
      expect(() => applyAction(state, { kind: 'move', direction })).toThrow("can't leave the farm");
      expect(state.cappy).toEqual({ x, y, direction });
    },
  );
  it.each(['north', '', 'toString', '__proto__'])('rejects invalid direction %s', direction => {
    expect(() => applyAction(createFarm(), { kind: 'move', direction })).toThrow(CappyError);
  });
  it('plants only once on empty soil', () => {
    const original = createFarm();
    const state = applyAction(original, { kind: 'plant' });
    expect(state.tiles[3][1].planted).toBe(true);
    expect(carrotCount(original)).toBe(0);
    expect(() => applyAction(state, { kind: 'plant' })).toThrow('already has a carrot');
    expect(carrotCount(state)).toBe(1);
  });
  it('rejects planting on grass', () => {
    const state = applyAction(createFarm(), { kind: 'move', direction: 'down' });
    expect(() => applyAction(state, { kind: 'plant' })).toThrow("can't plant here");
    expect(carrotCount(state)).toBe(0);
  });
  it('completes the objective with the starter program', () => {
    let state = createFarm();
    for (let i = 0; i < 3; i++) {
      state = applyAction(state, { kind: 'plant' });
      expect(objectiveComplete(state)).toBe(i === 2);
      if (i < 2) state = applyAction(state, { kind: 'move', direction: 'right' });
    }
    expect(carrotCount(state)).toBe(3);
  });
  it('restores position, orientation, crops, and terrain with a fresh state', () => {
    let state = applyAction(createFarm(), { kind: 'plant' });
    state = applyAction(state, { kind: 'move', direction: 'up' });
    state = createFarm();
    expect(state.cappy).toEqual({ x: 1, y: 3, direction: 'right' });
    expect(carrotCount(state)).toBe(0);
    expect(objectiveComplete(state)).toBe(false);
    expect(state.tiles.flat().filter(tile => tile.terrain === 'soil')).toHaveLength(6);
  });
});
