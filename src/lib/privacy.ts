import type { AppSettings } from "../types";
import { TOKEN_PATTERNS } from "./privacyPatterns";

export type SensitivityLevel = "safe" | "maybe_sensitive" | "sensitive";

export interface PrivacyScanResult {
  shouldSave: boolean;
  sensitivity: SensitivityLevel;
  reason?: string;
  matches: string[];
}

function hasWhitespace(value: string): boolean {
  return /\s/.test(value);
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function countCharacterCategories(value: string): number {
  let count = 0;

  if (/[a-z]/.test(value)) count++;
  if (/[A-Z]/.test(value)) count++;
  if (/[0-9]/.test(value)) count++;
  if (/[^a-zA-Z0-9]/.test(value)) count++;

  return count;
}

function uniqueCharacterRatio(value: string): number {
  if (value.length === 0) return 0;

  return new Set(value.split("")).size / value.length;
}

function looksLikePassword(value: string): boolean {
  const text = value.trim();

  if (text.length < 8 || text.length > 80) return false;
  if (hasWhitespace(text)) return false;
  if (looksLikeUrl(text)) return false;
  if (looksLikeEmail(text)) return false;

  const categories = countCharacterCategories(text);
  const uniqueness = uniqueCharacterRatio(text);

  return categories >= 3 && uniqueness >= 0.45;
}

function findTokenMatches(value: string): string[] {
  return TOKEN_PATTERNS.filter((item) => item.pattern.test(value)).map(
    (item) => item.name
  );
}

export function scanClipPrivacy(
  content: string,
  settings: AppSettings
): PrivacyScanResult {
  const text = content.trim();

  if (!text) {
    return {
      shouldSave: false,
      sensitivity: "safe",
      reason: "empty_clip",
      matches: [],
    };
  }

  if (text.length < settings.minClipLength) {
    return {
      shouldSave: false,
      sensitivity: "safe",
      reason: "below_minimum_length",
      matches: ["min_clip_length"],
    };
  }

  if (settings.maxClipLength > 0 && text.length > settings.maxClipLength) {
    return {
      shouldSave: false,
      sensitivity: "safe",
      reason: "above_maximum_length",
      matches: ["max_clip_length"],
    };
  }

  const tokenMatches = findTokenMatches(text);

  if (settings.ignoreLikelyApiKeys && tokenMatches.length > 0) {
    return {
      shouldSave: false,
      sensitivity: "sensitive",
      reason: "likely_api_key_or_token",
      matches: tokenMatches,
    };
  }

  if (settings.ignoreLikelyPasswords && looksLikePassword(text)) {
    return {
      shouldSave: false,
      sensitivity: "maybe_sensitive",
      reason: "likely_password",
      matches: ["password_heuristic"],
    };
  }

  if (settings.ignoreSensitiveClips && tokenMatches.length > 0) {
    return {
      shouldSave: false,
      sensitivity: "sensitive",
      reason: "sensitive_content",
      matches: tokenMatches,
    };
  }

  return {
    shouldSave: true,
    sensitivity: "safe",
    matches: [],
  };
}

export function isClipboardTemporarilyPaused(settings: AppSettings): boolean {
  return Boolean(settings.pauseUntil && settings.pauseUntil > Date.now());
}

export function isClipboardCaptureActive(settings: AppSettings): boolean {
  if (!settings.watchClipboard) return false;
  if (settings.privateMode) return false;
  if (isClipboardTemporarilyPaused(settings)) return false;

  return true;
}