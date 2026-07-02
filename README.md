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

En el **SQL Editor** de tu proyecto Supabase, ejecuta en orden:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_seed_dev.sql   ← solo para desarrollo/demo
```

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
3. Vercel lee el `vercel.json` de la raíz, que define dos **Services**: `frontend/` (build estático Vite) y `backend/` (función Python con el `app` de FastAPI expuesto en `backend/app.py`). Un `rewrite` enruta `/api/*` al backend y el resto al frontend.
4. El frontend en producción hace fetch a `/api/v1/*` relativo → mismo dominio, sin problemas de CORS.

> ⚠️ No uses la propiedad legacy `builds`/`routes` en `vercel.json` — el pipeline `vercel build` de los deploys conectados a Git la ignora silenciosamente (deploy "exitoso" sin generar ningún archivo → 404 en todas las rutas). Usa siempre `services` + `rewrites`.

### Migraciones en producción

Ejecuta `001_initial_schema.sql` en el Supabase del proyecto de producción **antes** del primer deploy. El seed de desarrollo (`002_seed_dev.sql`) no debe ejecutarse en producción.

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
| `JWT_EXPIRE_HOURS` | Duración sesión (default: 72h) |

---

## Convenciones

- Commits en Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`
- PRs pequeños (≤400 líneas), CI verde antes de mergear
- Secrets en `.env` local — **nunca commitear**
