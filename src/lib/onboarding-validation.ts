/**
 * Device-local validation for optional onboarding measurements.
 * Prevents Infinity, 0 and malformed values from silently becoming null
 * or corrupting training/nutrition estimates. No network dependency.
 */
export type MeasurementField = "age" | "heightCm" | "weightKg";
export type MeasurementResult = { value?: number; error?: string };

const RULES: Record<MeasurementField, {
  label: string; min: number; max: number; integer: boolean; unit: string;
}> = {
  age: { label: "العمر", min: 13, max: 110, integer: true, unit: "سنة" },
  heightCm: { label: "الطول", min: 80, max: 250, integer: false, unit: "سم" },
  weightKg: { label: "الوزن", min: 20, max: 400, integer: false, unit: "كجم" },
};

function normalizeDigits(raw: string) {
  return raw.trim()
    .replace(/[٠-٩]/g, (char) => String(char.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (char) => String(char.charCodeAt(0) - 0x6f0))
    .replace(/[٫،]/g, ".");
}

export function parseOptionalMeasurement(
  raw: string,
  field: MeasurementField,
): MeasurementResult {
  const rule = RULES[field];
  const normalized = normalizeDigits(raw);
  if (!normalized) return {};
  const pattern = rule.integer ? /^\d{1,3}$/ : /^\d{1,3}(?:\.\d{1,2})?$/;
  const value = Number(normalized);
  if (!pattern.test(normalized) || !Number.isFinite(value) ||
      value < rule.min || value > rule.max) {
    return { error: `أدخل ${rule.label} صحيحًا بين ${rule.min} و${rule.max} ${rule.unit}، أو اتركه فارغًا.` };
  }
  return { value };
}

export function validateOnboardingMeasurements(input: {
  age: string; height: string; weight: string;
}) {
  const age = parseOptionalMeasurement(input.age, "age");
  const height = parseOptionalMeasurement(input.height, "heightCm");
  const weight = parseOptionalMeasurement(input.weight, "weightKg");
  return {
    age: age.value,
    heightCm: height.value,
    weightKg: weight.value,
    errors: { age: age.error, height: height.error, weight: weight.error },
  };
}
