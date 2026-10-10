// Shared pure CSV functions used by the browser review gallery and CI.
// Never approves exercise media; decisions are human review notes only.
export function encodeReviewCsvCell(value) {
  let content = String(value ?? "");
  // Prevent spreadsheet formula execution when reviewer notes are opened in
  // Excel/LibreOffice. The leading apostrophe is reversible on import.
  if (/^[=+\-@\t\r\n]/.test(content)) content = "'" + content;
  return '"' + content.replaceAll('"', '""') + '"';
}

export function parseReviewCsv(input) {
  if (typeof input !== "string" || input.length > 1024 * 1024) {
    throw new Error("ملف قرارات المراجعة كبير جدًا أو غير صالح.");
  }
  const text = input.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [], field = "", quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else field += c;
    } else if (c === ",") {
      row.push(field); field = ""; closed = false;
    } else if (c === "\r" || c === "\n") {
      row.push(field);
      rows.push(row);
      row = []; field = ""; closed = false;
      if (c === "\r" && text[i + 1] === "\n") i++;
    } else if (c === '"') {
      if (field || closed) throw new Error("خطأ في علامات الاقتباس داخل CSV.");
      quoted = true;
    } else {
      if (closed) throw new Error("صيغة CSV تحتوي نصًا بعد إغلاق علامات الاقتباس.");
      field += c;
    }
  }
  if (quoted) throw new Error("ملف CSV يحتوي خانة اقتباس غير مغلقة.");
  if (field || row.length || closed) {
    row.push(field); rows.push(row);
  }
  return rows;
}

export function validateImportedReviewCsv(input, columns, referenceRows) {
  const parsed = parseReviewCsv(input);
  const expectedHeader = JSON.stringify(columns);
  if (!parsed.length || JSON.stringify(parsed[0]) !== expectedHeader) {
    throw new Error("أعمدة الملف غير مطابقة لنسخة معرض المراجعة الحالية.");
  }
  const canonical = new Map(referenceRows.map(row => [row[1], row]));
  if (parsed.length - 1 > canonical.size) {
    throw new Error("عدد سجلات المراجعة أكبر من عدد التمارين المعروفة.");
  }
  const decisions = Object.create(null);
  const valid = new Set(["", "needs-evidence", "rejected", "recommended", "new-source"]);
  for (const row of parsed.slice(1)) {
    if (row.length !== columns.length) {
      throw new Error("عدد أعمدة CSV غير صحيح.");
    }
    const slug = row[1];
    const source = canonical.get(slug);
    if (!source || Object.hasOwn(decisions, slug)) {
      throw new Error("معرّف تمرين غير معروف أو مكرر: " + slug);
    }
    // Source identity, status, frame references and commit MUST be unchanged:
    // never trust a CSV whose source differs from the current pinned dataset.
    if ([...Array(12).keys(), 18].some(i => row[i] !== source[i])) {
      throw new Error("ملف قديم أو معدل المصدر لهذا التمرين: " + slug);
    }
    const decision = row[12], rawNotes = row[13];
    const notes = rawNotes.startsWith("'") && /^[=+\-@\t\r\n]/.test(rawNotes.slice(1))
      ? rawNotes.slice(1) : rawNotes;
    if (!valid.has(decision) || notes.length > 1200) {
      throw new Error("قرار أو ملاحظة غير صالحة للتمرين: " + slug);
    }
    const flags = row.slice(14, 18);
    if (flags.some(flag => flag !== "" && flag !== "1")) {
      throw new Error("قائمة التحقق تحتوي قيمة غير صالحة للتمرين: " + slug);
    }
    if ((decision === "recommended" || decision === "rejected") && !row[6]) {
      throw new Error("لا يمكن ترشيح أو رفض مرشح غير موجود: " + slug);
    }
    if (decision === "recommended" &&
      (flags.some(flag => flag !== "1") || notes.trim().length < 20)) {
      throw new Error("ترشيح غير موثق (4 فحوص + سبب 20 حرفًا) للتمرين: " + slug);
    }
    decisions[slug] = {
      decision, notes,
      checks: { movement: flags[0] === "1", equipment: flags[1] === "1",
        muscle: flags[2] === "1", frames: flags[3] === "1" },
    };
  }
  return decisions;
}

export function buildReviewCsv(columns, referenceRows, decisions) {
  const values = referenceRows.map(source => {
    const saved = Object.hasOwn(decisions, source[1]) ? decisions[source[1]] : {};
    const checks = saved?.checks ?? {};
    const row = source.slice();
    row[12] = saved?.decision ?? "";
    row[13] = saved?.notes ?? "";
    row[14] = checks.movement ? "1" : "";
    row[15] = checks.equipment ? "1" : "";
    row[16] = checks.muscle ? "1" : "";
    row[17] = checks.frames ? "1" : "";
    return row;
  });
  const result = "\uFEFF" + [columns, ...values].map(row =>
    row.map(encodeReviewCsvCell).join(",")).join("\r\n") + "\r\n";
  validateImportedReviewCsv(result, columns, referenceRows);
  return result;
}
