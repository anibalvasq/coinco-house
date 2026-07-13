# CoinCo House — iOS (y PWA)

Guía para publicar la app en iPhone usando **Capacitor** + el backend que ya corre en **Vercel**.

---

## Qué ya está preparado en el repo

| Pieza | Ubicación |
|-------|-----------|
| PWA (manifest + iconos) | `frontend/public/manifest.webmanifest` |
| Capacitor config | `frontend/capacitor.config.ts` |
| API URL para móvil | `VITE_API_BASE_URL` en build |
| Scripts npm | `build:mobile`, `cap:ios`, `cap:open:ios` |
| Cookies configurables | `COOKIE_SECURE`, `COOKIE_SAMESITE` en backend |

---

## Opción A — PWA (sin App Store, 5 minutos)

1. Despliega en Vercel (ya lo tienes).
2. En iPhone → Safari → abre tu URL.
3. Compartir → **Agregar a pantalla de inicio**.

Listo. No necesitas Mac ni cuenta de desarrollador.

---

## Opción B — App en App Store (Capacitor)

### Requisitos

- **Mac** con **Xcode** (obligatorio para compilar y subir)
- **Apple Developer Program** — $99 USD/año
- URL de producción en Vercel (ej. `https://coinco-house-xxx.vercel.app`)

### Modo recomendado para empezar: **Remote URL**

La app nativa abre tu sitio de Vercel dentro del WebView. Auth, cookies y deploys funcionan igual que en Safari.

```bash
cd frontend
export CAPACITOR_SERVER_URL=https://TU-APP.vercel.app   # Mac/Linux
# PowerShell: $env:CAPACITOR_SERVER_URL="https://TU-APP.vercel.app"
npx cap sync ios
npx cap open ios
```

En Xcode: selecciona tu Team → Product → Archive → Distribute → App Store Connect.

### Modo bundled (app offline con assets locales)

La UI va empaquetada en el `.ipa` y la API apunta a Vercel.

**1. Configura variables en Vercel** (Settings → Environment Variables):

```
COOKIE_SECURE=true
COOKIE_SAMESITE=none
CORS_ORIGINS=https://TU-APP.vercel.app,capacitor://localhost,ionic://localhost
```

**2. Build móvil local:**

```bash
cd frontend
cp .env.mobile.example .env.mobile
# Edita .env.mobile:
# VITE_API_BASE_URL=https://TU-APP.vercel.app/api/v1

npm run cap:ios
npx cap open ios
```

**3. En Xcode** — firma, Archive, sube a TestFlight.

---

## Scripts útiles

```bash
cd frontend

npm run build:mobile      # Build con .env.mobile
npm run cap:sync          # Copia dist/ al proyecto nativo
npm run cap:ios           # build:mobile + sync ios
npm run cap:open:ios      # Abre Xcode
npm run icons             # Regenera PNG desde icon.svg (requiere Pillow)
```

---

## TestFlight (probar antes de publicar)

1. App Store Connect → crea la app con bundle ID `com.coinco.house`
2. Sube el build desde Xcode
3. Invita testers por email en TestFlight
4. Anibal y Macarena instalan sin pasar por revisión pública

---

## Checklist App Store

- [ ] Icono 1024×1024 (exportar desde `public/icons/icon-512.png` escalado)
- [ ] Screenshots iPhone (6.7" y 5.5" mínimo)
- [ ] Política de privacidad (URL pública — puede ser una página simple)
- [ ] Descripción en español
- [ ] Categoría: Finanzas o Utilidades

---

## Problemas frecuentes

| Síntoma | Solución |
|---------|----------|
| Login no persiste en app bundled | `COOKIE_SECURE=true`, `COOKIE_SAMESITE=none`, CORS con `capacitor://localhost` |
| API 404 en iOS | Revisa `VITE_API_BASE_URL` termina en `/api/v1` |
| Pantalla blanca | Corre `npm run cap:ios` después de cada cambio de frontend |
| No tengo Mac | Usa PWA (Opción A) o Mac cloud (MacStadium, GitHub Actions macOS runner) |

---

## Estructura generada (no commitear)

```
frontend/ios/          ← generado por `npx cap add ios` (en .gitignore)
```

Cada dev con Mac corre `npm run cap:ios` para regenerar el proyecto nativo.
