import { describe, expect, it } from 'vitest';
import { foodSearchScore } from './foodDiscovery';
import { POPULAR_MEALS } from './popularMeals';

describe('one food search', () => {
  const toast = POPULAR_MEALS.find(item => item.name === 'Tosty z szynką i serem')!;

  it('offers the named meal with an explicit portion calculated from its ingredients', () => {
    expect(toast.servingGrams).toBe(125);
    expect(Math.round(toast.kcal * toast.servingGrams! / 100)).toBe(355);
    expect(toast.originalName).toContain('Szynka 30 g');
    expect(toast.originalName).toContain('Ser · Cheddar 30 g');
  });

  it('finds a meal despite missing diacritics and a typo', () => {
    expect(foodSearchScore(toast, 'tosty z szynka i serem')?.approximate).toBe(false);
    expect(foodSearchScore(toast, 'tossty z szynka i serem')?.approximate).toBe(true);
    expect(foodSearchScore(toast, 'szynak ser')?.approximate).toBe(true);
  });

  it('does not suggest an unrelated meal for a multiword query', () => {
    expect(foodSearchScore(toast, 'makaron z kurczakiem')).toBeNull();
  });
});
