import { describe, expect, it } from 'vitest';
import { homeBackground } from '../view/home-theme';

describe('home theme', () => {
  it('uses the approved warm off-white HOME background', () => {
    expect(homeBackground).toBe(0xf7f3ea);
  });
});
