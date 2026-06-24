export interface PrivacyPattern {
  name: string;
  pattern: RegExp;
  category: "token" | "credential" | "private_key" | "connection_string";
  description: string;
}

export const TOKEN_PATTERNS: PrivacyPattern[] = [
  {
    name: "private_key",
    category: "private_key",
    description: "Private key block",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  },
  {
    name: "jwt_token",
    category: "token",
    description: "JSON Web Token",
    pattern: /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
  },
  {
    name: "github_token",
    category: "token",
    description: "GitHub personal access token",
    pattern: /^(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}$/,
  },
  {
    name: "openai_style_key",
    category: "token",
    description: "OpenAI-style API key",
    pattern: /^sk-[A-Za-z0-9_-]{20,}$/,
  },
  {
    name: "stripe_key",
    category: "token",
    description: "Stripe publishable or secret key",
    pattern: /^(sk|pk)_(test|live)_[A-Za-z0-9]{20,}$/,
  },
  {
    name: "aws_access_key",
    category: "token",
    description: "AWS access key ID",
    pattern: /AKIA[0-9A-Z]{16}/,
  },
  {
    name: "bearer_token",
    category: "token",
    description: "Bearer authorization token",
    pattern: /^Bearer\s+[A-Za-z0-9._~+/=-]{20,}$/i,
  },
  {
    name: "database_url",
    category: "connection_string",
    description: "Database connection URL",
    pattern: /\b(postgres|postgresql|mysql|mongodb|redis):\/\/[^\s]+/i,
  },
  {
    name: "env_secret",
    category: "credential",
    description: "Environment-style secret assignment",
    pattern:
      /\b(api[_-]?key|secret|token|password|passwd|pwd)\s*[:=]\s*['"]?[^'"\s]{8,}/i,
  },
];
