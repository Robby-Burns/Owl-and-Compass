// HTML Entity Escaper to strictly prevent stored XSS attacks
export function escapeHtml(str: any): string {
  if (str === null || str === undefined) return "";
  const s = typeof str === "string" ? str : String(str);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .replace(/=/g, "&#x3D;");
}

// Input sanitization rule to prevent script injection or database syntax exploits
export function sanitizeString(str: any, maxLength: number): string {
  if (str === null || str === undefined) return "";
  let s: string;
  if (Array.isArray(str)) {
    s = str.map(item => typeof item === "string" ? item : String(item)).join(", ");
  } else {
    s = typeof str === "string" ? str : String(str);
  }
  if (!s) return "";
  // Strip common SQL comment sequences first
  let clean = s.replace(/--/g, "").replace(/;/g, "");
  // Escape HTML entities to neutralize all tag rendering entirely
  clean = escapeHtml(clean);
  // Limit character length to prevent buffer overloads
  if (clean.length > maxLength) {
    clean = clean.substring(0, maxLength);
  }
  return clean.trim();
}
