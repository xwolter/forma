export function restingEnergy(
  weight: number,
  height: number,
  age: number,
  variant: "female" | "male",
) {
  if (
    ![weight, height, age].every(Number.isFinite) ||
    weight < 30 ||
    weight > 350 ||
    height < 100 ||
    height > 250 ||
    age < 19 ||
    age > 78
  )
    return null;
  return (
    9.99 * weight + 6.25 * height - 4.92 * age + (variant === "male" ? 5 : -161)
  );
}
export function remainingCarbs(kcal: number, protein: number, fat: number) {
  if (![kcal, protein, fat].every((n) => Number.isFinite(n) && n >= 0))
    return null;
  const remaining = kcal - protein * 4 - fat * 9;
  return remaining >= 0 ? remaining / 4 : null;
}
export function plateInventory(
  target: number,
  bar: number,
  inventory: { kg: number; pairs: number }[],
) {
  if (
    ![target, bar].every((n) => Number.isFinite(n) && n >= 0 && n <= 1000) ||
    target < bar
  )
    return null;
  const limit = Math.floor(((target - bar) / 2) * 100 + 0.0001);
  const options = inventory.filter(
    (p) =>
      Number.isFinite(p.kg) &&
      p.kg > 0 &&
      p.kg <= 100 &&
      Number.isInteger(p.pairs) &&
      p.pairs >= 0 &&
      p.pairs <= 20,
  );
  const dp = new Map<number, number[]>([[0, []]]);
  for (const p of options)
    for (let i = 0; i < p.pairs; i++) {
      for (const [total, list] of [...dp.entries()].sort(
        (a, b) => b[0] - a[0],
      )) {
        const next = total + Math.round(p.kg * 100);
        if (
          next <= limit &&
          (!dp.has(next) || dp.get(next)!.length > list.length + 1)
        )
          dp.set(next, [...list, p.kg]);
      }
    }
  const best = Math.max(...dp.keys());
  return {
    plates: dp.get(best)!.sort((a, b) => b - a),
    actual: bar + best / 50,
    exact: Math.abs(bar + best / 50 - target) < 0.001,
  };
}
