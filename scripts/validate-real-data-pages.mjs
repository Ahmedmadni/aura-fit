import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const fail = (message) => {
  console.error("Real-data page validation failed: " + message);
  process.exit(1);
};

const files = {
  coach: path.join(root, "src", "routes", "coach.tsx"),
  nutrition: path.join(root, "src", "routes", "nutrition.tsx"),
  dna: path.join(root, "src", "routes", "dna.tsx"),
};

for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) fail("missing " + name + " page");
}

const coach = fs.readFileSync(files.coach, "utf8");
const nutrition = fs.readFileSync(files.nutrition, "utf8");
const dna = fs.readFileSync(files.dna, "utf8");

for (const required of [
  "loadProfile",
  "loadHistory",
  "loadTodayReadiness",
  "generateWeeklyPlan",
]) {
  if (!coach.includes(required)) {
    fail("coach must derive guidance from real app data: " + required);
  }
}

for (const banned of [
  "أهلاً أحمد",
  "استشفاؤك اليوم ممتاز ٨٨٪",
  "خلال لحظات",
  "نمو قوة السحب ٢٣٪",
  "ذروتك الأدائية بعد ٥ ساعات",
]) {
  if (coach.includes(banned) || dna.includes(banned)) {
    fail("demo claim still present: " + banned);
  }
}

for (const banned of [
  "const meals =",
  "const macros =",
  "const consumed = 1940",
  "const target = 2400",
  "١.٨ / ٣.٠ لتر",
]) {
  if (nutrition.includes(banned)) {
    fail("nutrition demo data still present: " + banned);
  }
}

for (const required of [
  "profile.weightKg",
  "profile.heightCm",
  "profile.age",
  "profile.gender",
]) {
  if (!nutrition.includes(required)) {
    fail("nutrition estimate missing profile dependency: " + required);
  }
}

for (const banned of [
  "KINETIC · DNA V2",
  "خريطة خطر الإصابة",
  "AI SCAN",
  "const AXES",
  "const RISKS",
]) {
  if (dna.includes(banned)) {
    fail("DNA demo/risk claim still present: " + banned);
  }
}

for (const required of [
  "exerciseStrengthAnalyses",
  "currentStreak",
  "getWeeklyVolumeStatus",
  "لا يوجد تحليل DNA",
]) {
  if (!dna.includes(required)) {
    fail("training fingerprint is missing real-data marker: " + required);
  }
}

console.log(
  "Real-data pages PASS: coach, nutrition and training fingerprint contain no seeded demo metrics.",
);
