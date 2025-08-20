export function calcCaloriesFromMacros(proteinG, fatG, carbsG) {
  const p = Number.parseInt(proteinG || 0, 10) || 0;
  const f = Number.parseInt(fatG || 0, 10) || 0;
  const c = Number.parseInt(carbsG || 0, 10) || 0;
  return p * 4 + f * 9 + c * 4;
}

export function normalizeLog({ name, protein, fat, carbohydrates }) {
  const p = Number.parseInt(protein || 0, 10) || 0;
  const f = Number.parseInt(fat || 0, 10) || 0;
  const c = Number.parseInt(carbohydrates || 0, 10) || 0;
  const computed = calcCaloriesFromMacros(p, f, c);
  return {
    name: (name || "").trim(),
    ccal: Number.parseInt(computed, 10) || 0,
    protein: p,
    fat: f,
    carbohydrates: c,
  };
}