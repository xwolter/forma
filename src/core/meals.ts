import { stamp } from "./catalog";
import type { FoodEntry, Recipe } from "./types";

/** Ingredient snapshots stay independent of later edits to products or the recipe. */
export function expandRecipe(
  recipe: Recipe,
  amounts: number[],
  date: string,
  meal: string,
  status: FoodEntry["status"],
): FoodEntry[] {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw new Error("Wybierz poprawny dzień.");
  if (
    amounts.length !== recipe.ingredients.length ||
    !amounts.length ||
    amounts.some((n) => !Number.isFinite(n) || n < 0 || n > 20000)
  )
    throw new Error("Sprawdź ilości składników. 0 pomija składnik.");
  if (
    !meal.trim() ||
    meal.length > 100 ||
    !["consumed", "planned"].includes(status)
  )
    throw new Error("Sprawdź posiłek i status.");
  const entries = recipe.ingredients.flatMap((i, index) =>
    amounts[index] === 0
      ? []
      : [
          {
            ...stamp(),
            date,
            meal: meal.trim(),
            name: i.name,
            brand: `${recipe.name} · v${recipe.version}`,
            productId: i.productId,
            recipeVersion: null,
            grams: amounts[index],
            unit: i.unit,
            nutrients: { ...i.nutrients },
            status,
            quick: false,
          } satisfies FoodEntry,
        ],
  );
  if (!entries.length)
    throw new Error("Podaj ilość co najmniej jednego składnika.");
  return entries;
}
