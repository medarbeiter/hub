# Coolify-/Docker-Betrieb Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den MedArbeiter Hub als einzelne, persistente und gesundheitsgeprüfte Docker-Compose-Anwendung in Coolify installierbar machen.

**Architecture:** Ein mehrstufiges Bun-Dockerfile baut Next.js als Standalone-Ausgabe. Ein kurzer, getesteter Bootstrap initialisiert vor dem Webserver genau einmal das Verwaltungskonto; Coolify liest Variablen, Volume, Port und Healthcheck aus `docker-compose.yml` und übernimmt die Traefik-/TLS-Konfiguration.

**Tech Stack:** Bun 1.3.13, Next.js 16.3, `bun:sqlite`, Docker/Compose, Coolify/Traefik

**Spec:** `docs/superpowers/specs/2026-08-14-coolify-docker-design.md`

## Global Constraints

- Bun only: alle JavaScript-/TypeScript-Befehle laufen mit `bun`, `bun run` oder `bunx`.
- Die vorhandenen Migrationen in `lib/db.ts` bleiben append-only und werden nicht verändert.
- Persistiert wird der vollständige Pfad `/app/data`; die Anwendung bleibt bei einer Replik.
- Die normale Coolify-Compose-Bereitstellung übernimmt Traefik; keine Host-Ports, eigenen Netze oder `traefik.*`-Labels.
- `ADMIN_PASSWORD` erscheint nie in Logs, Fehlermeldungen oder Testsnapshots.
- Vorhandene, nicht zu diesem Vorhaben gehörende Änderungen bleiben erhalten und werden nicht gestaged.

---

### Task 1: Getesteter Erststart-Bootstrap

**Files:**
- Create: `lib/bootstrap.ts`
- Create: `scripts/bootstrap-admin.ts`
- Create: `tests/bootstrap.test.ts`

**Interfaces:**
- Produces: `deploymentConfig(env: Record<string, string | undefined>): DeploymentConfig`
- Produces: `bootstrapAdmin(db: Database, config: DeploymentConfig): Promise<boolean>`; `true` bedeutet neu angelegt, `false` bedeutet vorhandene Benutzer unverändert gelassen.
- Consumes: `createDb()`/`getDb()` aus `lib/db.ts` und das bestehende `users`-Schema.

- [ ] **Step 1: Write failing validation and bootstrap tests**

```ts
import {describe, expect, test} from 'bun:test';
import {createDb} from '../lib/db';
import {bootstrapAdmin, deploymentConfig} from '../lib/bootstrap';

const valid = {
  APP_URL: 'https://hub.example.de',
  ADMIN_EMAIL: 'admin@example.de',
  ADMIN_NAME: 'Erste Verwaltung',
  ADMIN_PASSWORD: 'SicheresPasswort2026',
};

describe('Deployment-Konfiguration', () => {
  test('verlangt alle vier Pflichtwerte', () => {
    for (const key of Object.keys(valid)) {
      expect(() => deploymentConfig({...valid, [key]: ''})).toThrow();
    }
  });

  test('erlaubt HTTPS und lokales HTTP, aber kein öffentliches HTTP', () => {
    expect(deploymentConfig(valid).appUrl).toBe('https://hub.example.de');
    expect(deploymentConfig({...valid, APP_URL: 'http://localhost:3000'}).appUrl)
      .toBe('http://localhost:3000');
    expect(() => deploymentConfig({...valid, APP_URL: 'http://hub.example.de'})).toThrow();
  });

  test('prüft E-Mail, Namen und die bestehenden Passwortregeln', () => {
    expect(() => deploymentConfig({...valid, ADMIN_EMAIL: 'keine-mail'})).toThrow();
    expect(() => deploymentConfig({...valid, ADMIN_NAME: '  '})).toThrow();
    expect(() => deploymentConfig({...valid, ADMIN_PASSWORD: 'nur-buchstaben'})).toThrow();
    expect(() => deploymentConfig({...valid, ADMIN_PASSWORD: '123456789012'})).toThrow();
  });
});

describe('Verwaltungs-Bootstrap', () => {
  test('legt genau ein Konto mit wechselpflichtigem Startpasswort an', async () => {
    const db = createDb(':memory:');
    const config = deploymentConfig(valid);
    expect(await bootstrapAdmin(db, config)).toBe(true);
    const row = db.query<{
      email: string; name: string; role: string; weekly_minutes: number;
      must_change_password: number; password_hash: string;
    }, []>('SELECT email, name, role, weekly_minutes, must_change_password, password_hash FROM users').get()!;
    expect(row).toMatchObject({
      email: 'admin@example.de', name: 'Erste Verwaltung', role: 'verwaltung',
      weekly_minutes: 2400, must_change_password: 1,
    });
    expect(await Bun.password.verify(valid.ADMIN_PASSWORD, row.password_hash)).toBe(true);
  });

  test('verändert ein bestehendes Konto bei erneutem Start nicht', async () => {
    const db = createDb(':memory:');
    await bootstrapAdmin(db, deploymentConfig(valid));
    const vorher = db.query<{email: string; password_hash: string}, []>(
      'SELECT email, password_hash FROM users',
    ).get()!;
    expect(await bootstrapAdmin(db, deploymentConfig({
      ...valid,
      ADMIN_EMAIL: 'anders@example.de',
      ADMIN_PASSWORD: 'AnderesPasswort2026',
    }))).toBe(false);
    expect(db.query('SELECT email, password_hash FROM users').get()).toEqual(vorher);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `bun test tests/bootstrap.test.ts`

Expected: FAIL because `../lib/bootstrap` does not exist.

- [ ] **Step 3: Implement minimal validation and transactional bootstrap**

```ts
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
  try { parsed = new URL(appUrl); } catch { throw new Error('APP_URL ist keine gültige URL.'); }
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
```

Create `scripts/bootstrap-admin.ts` as the process boundary:

```ts
import {bootstrapAdmin, deploymentConfig} from '../lib/bootstrap';
import {getDb} from '../lib/db';

try {
  const created = await bootstrapAdmin(getDb(), deploymentConfig(process.env));
  console.log(created ? 'Verwaltungskonto wurde angelegt.' : 'Datenbank ist bereits eingerichtet.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Die Einrichtung ist fehlgeschlagen.');
  process.exit(1);
}
```

- [ ] **Step 4: Run bootstrap tests and the related database/onboarding tests**

Run: `bun test tests/bootstrap.test.ts tests/db.test.ts tests/onboarding.test.ts`

Expected: all tests PASS.

- [ ] **Step 5: Commit only the new bootstrap files**

```bash
git add lib/bootstrap.ts scripts/bootstrap-admin.ts tests/bootstrap.test.ts
git commit -m "feat: bootstrap Coolify administrator"
```

### Task 2: Datenbankgestützter Healthcheck

**Files:**
- Create: `app/api/health/route.ts`
- Create: `tests/health.test.ts`

**Interfaces:**
- Produces: `GET(): Promise<Response> | Response` for `GET /api/health`
- Produces: `healthResponse(check?: () => void): Response` for deterministic tests.
- Consumes: `getDb()` and a read-only `SELECT 1` query.

- [ ] **Step 1: Write failing success/failure response tests**

```ts
import {describe, expect, test} from 'bun:test';
import {healthResponse} from '../app/api/health/route';

describe('Healthcheck', () => {
  test('meldet eine erreichbare Datenbank als bereit', async () => {
    const response = healthResponse(() => {});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({status: 'ok'});
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  test('gibt bei Datenbankfehlern nur eine generische 503-Antwort aus', async () => {
    const response = healthResponse(() => { throw new Error('/app/data/medarbeiter.db: geheim'); });
    const body = await response.text();
    expect(response.status).toBe(503);
    expect(JSON.parse(body)).toEqual({status: 'nicht_bereit'});
    expect(body).not.toContain('medarbeiter.db');
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `bun test tests/health.test.ts`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement the uncached health response**

```ts
import {getDb} from '@/lib/db';

export function healthResponse(check = () => {
  getDb().query('SELECT 1').get();
}): Response {
  try {
    check();
    return Response.json({status: 'ok'}, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) {
    console.error('Healthcheck fehlgeschlagen:', error);
    return Response.json(
      {status: 'nicht_bereit'},
      {status: 503, headers: {'Cache-Control': 'no-store'}},
    );
  }
}

export function GET(): Response {
  return healthResponse();
}
```

- [ ] **Step 4: Run the health test and full API-adjacent tests**

Run: `bun test tests/health.test.ts tests/db.test.ts`

Expected: all tests PASS; the intentional failure may log once but reveals no response detail.

- [ ] **Step 5: Commit the health endpoint**

```bash
git add app/api/health/route.ts tests/health.test.ts
git commit -m "feat: add deployment health check"
```

### Task 3: Standalone Bun Container

**Files:**
- Create: `next.config.ts`
- Create: `Dockerfile`
- Create: `.dockerignore`

**Interfaces:**
- Consumes: `scripts/bootstrap-admin.ts`, `bun.lock`, Next.js standalone output.
- Produces: image listening on `0.0.0.0:3000`, running as user `bun`, with `/app/data` prepared as writable storage.

- [ ] **Step 1: Add and verify standalone Next.js configuration**

```ts
import type {NextConfig} from 'next';

const nextConfig = {
  output: 'standalone',
} satisfies NextConfig;

export default nextConfig;
```

Run: `bun run build`

Expected: PASS and `.next/standalone/server.js` exists.

- [ ] **Step 2: Add a minimal multi-stage Dockerfile**

```dockerfile
FROM oven/bun:1.3.13 AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.3.13 AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN bun run build
RUN bun build scripts/bootstrap-admin.ts --target=bun --outfile=dist/bootstrap-admin.js

FROM oven/bun:1.3.13 AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=bun:bun /app/.next/standalone ./
COPY --from=build --chown=bun:bun /app/.next/static ./.next/static
COPY --from=build --chown=bun:bun /app/public ./public
COPY --from=build --chown=bun:bun /app/dist/bootstrap-admin.js ./bootstrap-admin.js
RUN mkdir -p /app/data && chown bun:bun /app/data
USER bun
EXPOSE 3000
CMD ["sh", "-c", "bun /app/bootstrap-admin.js && exec bun /app/server.js"]
```

- [ ] **Step 3: Exclude local and secret material from the image context**

```dockerignore
.git
.next
node_modules
data
.env
.env.*
!.env.example
coverage
docs
.claude
.codex
.serena
.impeccable
```

- [ ] **Step 4: Verify configuration and image when Docker is available**

Run: `bun run build`

Expected: PASS.

Run when available: `docker build -t medarbeiter-hub:test .`

Expected: image builds successfully. If Docker is unavailable, record that exact limitation and continue with non-Docker verification.

- [ ] **Step 5: Commit container build files**

```bash
git add next.config.ts Dockerfile .dockerignore
git commit -m "build: add production Bun container"
```

### Task 4: Coolify Compose Contract and Installation Docs

**Files:**
- Create: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Consumes: image port 3000, `/api/health`, and the four bootstrap variables.
- Produces: Coolify-discoverable required/optional variables and named `medarbeiter-data` storage at `/app/data`.

- [ ] **Step 1: Add the single-service Compose stack**

```yaml
services:
  hub:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      NODE_ENV: production
      HOSTNAME: 0.0.0.0
      PORT: 3000
      APP_URL: ${APP_URL:?APP_URL muss gesetzt sein}
      ADMIN_EMAIL: ${ADMIN_EMAIL:?ADMIN_EMAIL muss gesetzt sein}
      ADMIN_NAME: ${ADMIN_NAME:?ADMIN_NAME muss gesetzt sein}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:?ADMIN_PASSWORD muss gesetzt sein}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:-}
      RESEND_API_KEY: ${RESEND_API_KEY:-}
    expose:
      - "3000"
    volumes:
      - medarbeiter-data:/app/data
    healthcheck:
      test: ["CMD", "bun", "-e", "const r=await fetch('http://127.0.0.1:3000/api/health');process.exit(r.ok?0:1)"]
      start_period: 30s
      interval: 30s
      timeout: 5s
      retries: 3
    stop_grace_period: 30s

volumes:
  medarbeiter-data:
```

Do not add `ports`, `container_name`, `networks`, replicas, or Traefik labels.

- [ ] **Step 2: Extend `.env.example` with safe local Compose values**

Add:

```dotenv
# Docker Compose / Coolify
APP_URL=http://localhost:3000
ADMIN_EMAIL=verwaltung@example.de
ADMIN_NAME=Erste Verwaltung
ADMIN_PASSWORD=BitteSicherAendern2026
```

Keep the existing Google/Resend documentation. Add a comment that production uses the exact Coolify HTTPS domain and that passwords containing `$` must be marked “Literal” in Coolify.

- [ ] **Step 3: Add concise German Coolify instructions to README**

Document exactly:

1. Create a Docker Compose resource from the repository and select `/docker-compose.yml`.
2. Keep Raw Compose disabled.
3. Set `APP_URL`, `ADMIN_EMAIL`, `ADMIN_NAME`, and secret/literal `ADMIN_PASSWORD`; Google and Resend remain optional.
4. Assign the service domain to container port 3000 and make `APP_URL` match it.
5. Deploy, wait for healthy state, log in, and change the initial password.
6. Back up the full `medarbeiter-data` volume; restore only with one application replica stopped/running as documented by Coolify.

Also state: Coolify owns Traefik and TLS, no host port is published, and this SQLite deployment must remain at one replica.

- [ ] **Step 4: Validate Compose expansion without exposing secrets**

Run when Docker is available:

```bash
APP_URL=http://localhost:3000 \
ADMIN_EMAIL=verwaltung@example.de \
ADMIN_NAME='Erste Verwaltung' \
ADMIN_PASSWORD='BitteSicherAendern2026' \
docker compose config --quiet
```

Expected: exit 0. Then inspect `docker compose config` only with non-secret sample values and confirm there is no host `ports` entry, custom network, or Traefik label.

- [ ] **Step 5: Stage safely**

`docker-compose.yml` is new and may be committed independently. Because `README.md` and `.env.example` already contain user changes, review their diffs and do not stage their unrelated contents automatically.

```bash
git add docker-compose.yml
git commit -m "build: add Coolify Compose stack"
git diff -- README.md .env.example
```

Leave the documentation files unstaged unless their full current contents are explicitly approved for the same commit.

### Task 5: End-to-End Verification and Handoff

**Files:**
- Modify only if verification exposes a defect in files from Tasks 1–4.

**Interfaces:**
- Consumes all prior deliverables.
- Produces evidence that source, build, bootstrap, health, and persistence contracts work.

- [ ] **Step 1: Run the complete Bun test suite**

Run: `bun test`

Expected: all tests PASS.

- [ ] **Step 2: Run the production Next.js build**

Run: `bun run build`

Expected: PASS; route table includes `/api/health`; `.next/standalone/server.js` exists.

- [ ] **Step 3: Run container checks if Docker exists**

Use a unique temporary Compose project name and the non-secret sample environment. Build and start the service, wait for healthy state, then assert:

```bash
docker compose -p medarbeiter-check up -d --build
docker compose -p medarbeiter-check ps
docker compose -p medarbeiter-check exec -T hub id -u
docker compose -p medarbeiter-check exec -T hub bun -e "const r=await fetch('http://127.0.0.1:3000/api/health'); console.log(r.status, await r.text())"
```

Expected: service healthy, UID is non-zero, health returns `200 {"status":"ok"}`.

- [ ] **Step 4: Verify bootstrap and persistence across recreation**

Query the database inside the container with a Bun one-liner, record one admin, recreate the service without deleting volumes, and query again:

```bash
docker compose -p medarbeiter-check exec -T hub bun -e "const {Database}=require('bun:sqlite'); const db=new Database('/app/data/medarbeiter.db'); console.log(db.query('SELECT email, role, must_change_password FROM users').all())"
docker compose -p medarbeiter-check up -d --force-recreate
docker compose -p medarbeiter-check exec -T hub bun -e "const {Database}=require('bun:sqlite'); const db=new Database('/app/data/medarbeiter.db'); console.log(db.query('SELECT COUNT(*) count FROM users').get())"
```

Expected: original email/role remain and count is still exactly 1.

- [ ] **Step 5: Clean up only the temporary verification stack**

Run: `docker compose -p medarbeiter-check down --volumes`

Expected: only the explicitly named temporary containers/network/volume are removed. Never run this against the production project name.

- [ ] **Step 6: Review final scope and status**

Run:

```bash
git diff --check
git status --short
git diff -- Dockerfile docker-compose.yml .dockerignore next.config.ts lib/bootstrap.ts scripts/bootstrap-admin.ts app/api/health/route.ts tests/bootstrap.test.ts tests/health.test.ts README.md .env.example
```

Confirm no secret, local database, receipt, AU file, host port mapping, custom network, or Traefik label entered the change. Report Docker checks as unavailable rather than passing if Docker is not installed.
