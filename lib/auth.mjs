import { existsSync, readFileSync } from 'node:fs';

const readEnvValue = (content, key) => {
  const line = content.split('\n').find((row) => row.startsWith(`${key}=`));
  if (!line) return undefined;
  const raw = line.slice(key.length + 1).trim();
  const quoted = raw.match(/^"([^"]*)"/) ?? raw.match(/^'([^']*)'/);
  if (quoted) return quoted[1];
  return raw.replace(/\s+#.*$/, '').trim() || undefined;
};

/**
 * Basic auth for both sides of the run. VD_BASIC_AUTH_* env vars win over the
 * BASIC_AUTH_* values in the app's .env.local. Undefined when neither has both.
 */
export const readBasicAuth = (envFilePath, env = process.env) => {
  const content = existsSync(envFilePath) ? readFileSync(envFilePath, 'utf8') : '';
  const username = env.VD_BASIC_AUTH_USERNAME ?? readEnvValue(content, 'BASIC_AUTH_USERNAME');
  const password = env.VD_BASIC_AUTH_PASSWORD ?? readEnvValue(content, 'BASIC_AUTH_PASSWORD');
  return username && password ? { username, password } : undefined;
};
