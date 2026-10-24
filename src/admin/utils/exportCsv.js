export function exportCsv(filename, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row || {})))];
  const escape = (value) => {
    const text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  };
  const csv = [columns.map(escape).join(","), ...rows.map((row) => columns.map((column) => escape(row?.[column])).join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}
