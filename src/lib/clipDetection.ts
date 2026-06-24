import type { ClipCategory } from "../types";

const URL_PATTERN = /^(https?:\/\/|www\.)[^\s]+$/i;

const URL_INSIDE_TEXT_PATTERN = /\b(https?:\/\/|www\.)[^\s]+/i;

const CODE_PATTERNS: RegExp[] = [
  /\b(function|const|let|var|return|import|export|interface|type|class)\b/,
  /\b(if|else|for|while|switch|case|try|catch|async|await)\b/,
  /<\/?[a-z][\s\S]*>/i,
  /\{[\s\S]*\}/,
  /\bSELECT\b[\s\S]+\bFROM\b/i,
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\b[\s\S]+\bSET\b/i,
  /\bDELETE\s+FROM\b/i,
  /^\s*(pnpm|npm|yarn|cargo|git|docker|supabase|npx)\s+/i,
  /^\s*(cd|ls|mkdir|touch|rm|cp|mv|cat|grep|find)\s+/i,
];

function looksLikeUrl(value: string): boolean {
  const text = value.trim();

  return URL_PATTERN.test(text) || URL_INSIDE_TEXT_PATTERN.test(text);
}

function looksLikeCode(value: string): boolean {
  const text = value.trim();

  if (text.length < 12) return false;

  const lineCount = text.split("\n").length;
  const hasCodePattern = CODE_PATTERNS.some((pattern) => pattern.test(text));

  const symbolScore = [
    text.includes("{"),
    text.includes("}"),
    text.includes(";"),
    text.includes("=>"),
    text.includes("()"),
    text.includes("</"),
    text.includes("#!"),
  ].filter(Boolean).length;

  return hasCodePattern || (lineCount >= 3 && symbolScore >= 2);
}

export function detectClipCategory(content: string): ClipCategory {
  const text = content.trim();

  if (looksLikeUrl(text)) return "url";
  if (looksLikeCode(text)) return "code";

  return "text";
}
