# Hogar Compartido — Gestor de Gastos Compartidos

App móvil para hogares compartidos: registra cuentas (luz, agua, internet…), define los días que cada persona estuvo en casa cada mes y calcula el reparto proporcional automáticamente.

## Stack

| Capa | Tecnología |
|------|------------|
| Backend | Python 3.11 · FastAPI · Poetry |
| Frontend | TypeScript · Vite (SPA vanilla) |
| Base de datos | Supabase (Postgres) |
| Deploy | Vercel (frontend estático + Python serverless) |

---

## Setup local

### Requisitos

- Python 3.11+
- Poetry
- Node.js 20+
- npm
- Cuenta Supabase (proyecto creado)

### 1. Clonar y configurar variables

```bash
git clone https://github.com/anibalvasq2024/coinco_rep.git
cd coinco_rep
cp .env.example backend/.env
# Editar backend/.env con tus credenciales Supabase y JWT_SECRET
```

### 2. Crear esquema en Supabase

En el **SQL Editor** de tu proyecto Supabase, ejecuta en orden las migraciones de `supabase/migrations/` (incluye `006_people_google.sql` para Sign in with Google y `007_push_subscriptions.sql` para notificaciones push). El seed `002_seed_dev.sql` es solo para desarrollo/demo.

El seed imprime el `HOUSEHOLD_ID` generado con `RAISE NOTICE`. Cópialo en `backend/.env`.

### 3. Backend

```bash
cd backend
poetry install
poetry run uvicorn coinco_rep.main:app --reload --port 8000
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
# Abre http://localhost:5173
```

El Vite dev server redirige `/api/*` al backend en `:8000`.

### 5. Login de prueba

Con el seed activo, las personas son **Juan** y **Valentina**, PIN `1234` para ambas.

### 6. Sign in with Google (opcional)

1. En [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials, crea un cliente OAuth **Web application**.
2. En **Authorized JavaScript origins** agrega `http://localhost:5173` y tu URL de Vercel.
3. Copia el Client ID en `GOOGLE_CLIENT_ID` (`backend/.env` y variables de Vercel).
4. En la app, edita cada persona y pon su **mismo Gmail** en el campo email.
5. En el login aparece **Continuar con Google**; el PIN sigue disponible.

Sin `GOOGLE_CLIENT_ID`, la app sigue solo con PIN.

---

## Tests

```bash
cd backend
poetry run pytest tests/ -v
```

20 tests cubren: lógica de reparto proporcional, fallback igual, redondeo CLP, hash/verify PIN y ciclo JWT.

---

## Deploy en Vercel

1. Conecta el repo en [vercel.com](https://vercel.com).
2. Agrega las variables de entorno en Vercel Dashboard → Settings → Environment Variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET`
   - `HOUSEHOLD_ID`
   - `CORS_ORIGINS` (p.ej. `https://coinco-rep.vercel.app`)
  - `GOOGLE_CLIENT_ID` (opcional — Sign in with Google)
  - `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` (opcional — notificaciones push)
3. Vercel lee el `vercel.json` de la raíz, que define dos **Services**: `frontend/` (build estático Vite) y `backend/` (función Python con el `app` de FastAPI expuesto en `backend/app.py`). Un `rewrite` enruta `/api/*` al backend y el resto al frontend.
4. El frontend en producción hace fetch a `/api/v1/*` relativo → mismo dominio, sin problemas de CORS.

> ⚠️ No uses la propiedad legacy `builds`/`routes` en `vercel.json` — el pipeline `vercel build` de los deploys conectados a Git la ignora silenciosamente (deploy "exitoso" sin generar ningún archivo → 404 en todas las rutas). Usa siempre `services` + `rewrites`.

### Migraciones en producción

Ejecuta `001_initial_schema.sql` en el Supabase del proyecto de producción **antes** del primer deploy. El seed de desarrollo (`002_seed_dev.sql`) no debe ejecutarse en producción.

---

## iOS y PWA

La app puede instalarse en iPhone de dos formas:

1. **PWA** — Safari → Agregar a pantalla de inicio (sin App Store). En Android/Chrome/Edge aparece "Instalar app". El service worker (`vite-plugin-pwa`) cachea la app para que abra sin conexión; las llamadas a `/api` siempre van a la red.
2. **App Store** — Capacitor + Xcode (requiere Mac y cuenta Apple Developer)

Guía completa: **[docs/ios.md](docs/ios.md)**

```bash
cd frontend
cp .env.mobile.example .env.mobile   # configurar VITE_API_BASE_URL
npm run cap:ios                      # build + sync (en Mac: npx cap open ios)
```

### Notificaciones push (PWA)

- **Gasto nuevo:** cuando alguien agrega un gasto, las demás personas del hogar reciben *"Juan agregó un gasto · Luz · $45.000"*.
- **Cierre de mes:** el último día del mes (cron `/api/v1/cron/monthly`), cada persona recibe **su propio monto**: *"Cierre de octubre 2026 · Tu parte: $60.000"*.

Configuración:

1. Ejecuta `supabase/migrations/007_push_subscriptions.sql`.
2. Genera las claves una sola vez (si las cambias, todos tendrán que reactivar las notificaciones):
   ```bash
   cd backend
   poetry run python scripts/generate_vapid_keys.py
   ```
3. Copia `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` a `backend/.env` y a las variables de Vercel.
4. En la app: avatar → **Activar notificaciones** → aceptar el permiso → **Enviar prueba**.

Compatibilidad: Android y escritorio (Chrome, Edge, Firefox). En iPhone requiere iOS 16.4+ y la app **instalada en la pantalla de inicio**; en una pestaña de Safari el menú muestra cómo instalarla. No funciona dentro de la app nativa de Capacitor. Al cerrar sesión, el dispositivo deja de recibir notificaciones.

---

## Estructura del proyecto

```
coinco_rep/
├── backend/
│   ├── app.py                  Entrypoint Vercel (Python Service, re-exporta `app`)
│   ├── src/coinco_rep/
│   │   ├── main.py             FastAPI app
│   │   ├── config.py           Settings (pydantic-settings)
│   │   ├── auth/               PIN verify, JWT, depends
│   │   ├── domain/             split.py, formatting.py
│   │   ├── repositories/       Supabase queries
│   │   └── api/routes/         auth, people, categories, bills, stays, split, dashboard, history
│   └── tests/                  20 tests pytest
├── frontend/
│   └── src/
│       ├── api/client.ts       Fetch wrapper + tipos
│       ├── styles/tokens.css   Design tokens del handoff
│       ├── views/              6 pantallas (login, dashboard, bills, people, split, history)
│       └── components/         billModal, personModal, icons
├── supabase/migrations/        001 schema · 002 seed dev
├── .github/workflows/ci.yml   CI: pytest + ruff + build frontend
├── vercel.json
└── .env.example
```

---

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (solo backend) |
| `JWT_SECRET` | Secret para firmar tokens JWT (≥32 chars) |
| `HOUSEHOLD_ID` | UUID del hogar seed |
| `CORS_ORIGINS` | Orígenes permitidos, comma-separated |
| `COOKIE_SECURE` | `true` en prod con app iOS bundled |
| `COOKIE_SAMESITE` | `none` para app iOS bundled (con `COOKIE_SECURE=true`) |
| `JWT_EXPIRE_HOURS` | Duración sesión (default: 72h) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Claves Web Push (`scripts/generate_vapid_keys.py`); sin ellas no hay notificaciones |
| `VAPID_SUBJECT` | Contacto para los servicios push, `mailto:` o `https:` (opcional) |

---

## Convenciones

- Commits en Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`
- PRs pequeños (≤400 líneas), CI verde antes de mergear
- Secrets en `.env` local — **nunca commitear**
