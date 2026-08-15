import type {Database} from 'bun:sqlite';

export interface DeploymentConfig {
  appUrl: string;
  adminEmail: string;
  adminName: string;
  adminPassword: string;
}

function required(env: Record<string, string | undefined>, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} muss gesetzt sein.`);
  return value;
}

export function deploymentConfig(env: Record<string, string | undefined>): DeploymentConfig {
  const appUrl = required(env, 'APP_URL').replace(/\/$/, '');
  const adminEmail = required(env, 'ADMIN_EMAIL').toLowerCase();
  const adminName = required(env, 'ADMIN_NAME');
  const adminPassword = required(env, 'ADMIN_PASSWORD');
  let parsed: URL;
  try {
    parsed = new URL(appUrl);
  } catch {
    throw new Error('APP_URL ist keine gültige URL.');
  }
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && parsed.hostname === 'localhost')) {
    throw new Error('APP_URL muss HTTPS verwenden; nur localhost darf HTTP verwenden.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) throw new Error('ADMIN_EMAIL ist ungültig.');
  if (adminPassword.length < 12 || !/[A-Za-zÄÖÜäöüß]/.test(adminPassword) || !/\d/.test(adminPassword)) {
    throw new Error('ADMIN_PASSWORD braucht mindestens 12 Zeichen, einen Buchstaben und eine Zahl.');
  }
  return {appUrl, adminEmail, adminName, adminPassword};
}

export async function bootstrapAdmin(db: Database, config: DeploymentConfig): Promise<boolean> {
  if (db.query<{count: number}, []>('SELECT COUNT(*) count FROM users').get()!.count > 0) return false;
  const hash = await Bun.password.hash(config.adminPassword);
  return db.transaction(() => {
    if (db.query<{count: number}, []>('SELECT COUNT(*) count FROM users').get()!.count > 0) return false;
    db.query(
      `INSERT INTO users (email, password_hash, name, role, weekly_minutes, must_change_password)
       VALUES (?, ?, ?, 'verwaltung', 2400, 1)`,
    ).run(config.adminEmail, hash, config.adminName);
    return true;
  })();
}
