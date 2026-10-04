# Tester Hub

Aplicación web con Next.js, TypeScript, App Router y Supabase Auth.

## Arranque local

1. Copia `.env.example` a `.env.local` y configura la URL y la clave pública
   mostradas por `npx supabase status`.
2. Configura un cliente OAuth de Google y proporciona sus credenciales como
   `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` y
   `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` al ejecutar Supabase local.
   La URI de callback de Google es `http://127.0.0.1:54321/auth/v1/callback`.
3. Inicia Supabase y la aplicación:

```bash
npx supabase start
npm install
npm run dev
```

La aplicación acepta callbacks en `http://localhost:3000/auth/callback` y
`http://127.0.0.1:3000/auth/callback`. Usa la misma dirección para abrir la
aplicación que la configurada en las URLs de redirección OAuth.
