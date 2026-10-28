export const FOOD_STORES = [
  { name: "Biedronka", bit: 1 }, { name: "Lidl", bit: 2 },
  { name: "Żabka", bit: 4 }, { name: "Dino", bit: 8 },
  { name: "Aldi", bit: 16 }, { name: "Auchan", bit: 32 },
  { name: "Carrefour", bit: 64 }, { name: "Kaufland", bit: 128 },
  { name: "Netto", bit: 256 }, { name: "Lewiatan", bit: 512 },
] as const;
export type FoodStoreBit = 0 | (typeof FOOD_STORES)[number]["bit"];
