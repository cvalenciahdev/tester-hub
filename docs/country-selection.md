# Selección y elegibilidad por país

Este incremento conserva `profiles.country_code` (varchar(2)) y `campaign_countries.country_code` (varchar(2)), sin renombrar columnas ni guardar nombres localizados.

## Catálogo y UI

`src/lib/countries.json` es el catálogo local de 249 códigos ISO 3166-1 alpha-2 asignados, incluidos territorios. Cada entrada contiene `code` y `names.es/names.en`. Los nombres están fijados en el archivo para evitar diferencias entre las versiones Intl del servidor y navegador. No hay una dependencia nueva ni se aceptan códigos reservados/no asignados como ZZ, UK o XK.

`src/lib/countries.ts` comparte membresía, normalización, nombres, orden y búsqueda sin acentos. `CountrySelect` y `CountryMultiSelect` comparten CountryPicker: búsqueda por nombre/código, selección controlada, labels, lista seleccionable, flechas/Home/End, Enter/Space, Escape y cierre al salir del campo. El texto de búsqueda no tiene name y nunca se persiste. Un select nativo mantiene los valores ISO de FormData y required validation; el botón, búsqueda y opciones visibles proporcionan la interacción accesible. Solo se abre el primer campo inválido del formulario.

- Onboarding/perfil: selección única obligatoria; México → MX, Argentina → AR.
- Crear/editar campaña: radios Todos los países/Países específicos; `all_countries=true` no requiere lista, y específicos requiere al menos un código válido. Multiselect sin duplicados y chips removibles.
- Edición: país/all_countries deshabilitados con participaciones, campañas terminales o app archivada. La server action mantiene su lectura actual y omite campos estructurales cuando corresponde; SQL conserva STRUCTURAL_FIELDS_LOCKED.
- Explore/detalle/dashboard: nombres para 1–3 países, resumen N países para más; todos muestra Todos los países. Tracking muestra el nombre del país actual del perfil, sin crear snapshot.

## Backend y migración

Nueva migration: `supabase/migrations/20261008120000_country_eligibility.sql`. No se editaron migraciones anteriores ni se ejecutó la nueva contra una base.

1. Añade `is_valid_country_code(text)`, SQL IMMUTABLE STRICT SECURITY INVOKER con search_path vacío. Solo compara con un snapshot del catálogo; no lee datos privados. EXECUTE para authenticated/service_role, sin PUBLIC/anon.
2. Añade CHECKs de membresía ISO a profiles y campaign_countries, NOT VALID para conservar filas legacy. Nuevas escrituras se validan incluso si el cliente omite las server actions. Profiles permite NULL mientras el usuario aún no completa onboarding, como el schema original.
3. Reemplaza join_campaign conservando auth, lock de campaña, estados recruiting/testing, app activa, owner excluido, email requerido, duplicados, capacidad, waiting_access y evento joined. Después de cargar el perfil/email y antes de insertar, exige país del catálogo incluso para all_countries; para específicos exige la fila de país de esa campaña. Falla con **COUNTRY_NOT_ELIGIBLE** si el país falta, es inválido o no es elegible. No depende de Explore ni Next.
4. Reemplaza las definiciones actuales de discovery, detalle y dashboard solo para reforzar el guard de país del perfil con la misma membresía ISO. Mantiene payloads, límites y comparaciones de códigos normalizados.
5. Reemplaza create_campaign/update_campaign para exigir al menos un país en disponibilidad específica también por RPC directa. El error es CAMPAIGN_COUNTRIES_REQUIRED; en update el check ocurre después de los structural locks para conservar su precedencia. No cambia target, duración ni autocierre.

Frontend valida membership en onboarding, profile y campaign inputs. Los guards de onboarding/perfil rechazan países legacy inválidos. Las RPCs de perfil/campaña siguen normalizando códigos y quedan protegidas por los nuevos CHECKs; una llamada con un código de dos letras no ISO falla con check_violation, mientras join usa el error estable anterior. No se cambió email, dispositivos, lifecycle, feedback, auth/OAuth, instalación, rate limits ni máximo de duración.

La lista SQL es un snapshot de migration y no se importa desde TS en runtime. La prueba local comprueba igualdad exacta con el catálogo para impedir drift en este incremento. Una ampliación futura exige actualizar catálogo y añadir otra migration, no editar esta después de aplicarla.

## Datos existentes y ejecución local pendiente

No se pudo inspeccionar la base: Docker local no tiene daemon disponible. No se consultó remoto y no se hizo db reset. Las constraints anteriores solo exigían dos letras A–Z; nombres libres no caben en varchar(2), pero pueden existir códigos no ISO. No se hizo mapping, borrado o recreación de datos.

NOT VALID evita rechazar la migration por filas antiguas. Nuevos INSERT/UPDATE de una fila con país inválido fallan hasta corregirla; un perfil inválido debe escoger un país válido en onboarding. La UI no presenta un código desconocido como país elegible. Una campaña bloqueada con países inválidos requiere revisar sus datos en un entorno local; no se eluden locks para arreglarla.

En una base local de desarrollo, ejecutar primero migraciones y revisar sin imprimir emails:

```sql
select id, country_code from public.profiles
where country_code is not null and not public.is_valid_country_code(country_code);
select campaign_id, country_code from public.campaign_countries
where not public.is_valid_country_code(country_code);
```

Corregir datos de prueba explícitamente o recrear una base descartable si corresponde. No inferir país a partir de un nombre ni ejecutar reset sobre datos compartidos. Cuando no haya inválidos:

```sql
alter table public.profiles validate constraint profiles_country_code_iso;
alter table public.campaign_countries validate constraint campaign_countries_code_iso;
```

## Validación

- `node --test tests/countries.test.cjs`: seis tests, catálogo, nombres ES/EN, códigos inválidos, inputs, multiselect/dedupe, campos bloqueados, render de selects y displays. Verifica que el cuerpo de join anterior permanece intacto al quitar el bloque añadido de país.
- `node tests/country-ui-browser.cjs`: navegador Edge local aislado, sin .env ni Supabase; required validation, búsqueda sin acentos, teclado, envío ISO, chips, locks disabled, ES/EN y anchos 1440/768/375. Usa React y webpack ya instalados; archivos de fixture temporales dentro de .next, eliminados al terminar. No ejecutar simultáneamente con next build.
- Validaciones requeridas: `npm.cmd run lint`, `npx.cmd tsc --noEmit`, `npm.cmd run build`, `git diff --check`.
- Resultado local: PASS de lint, TypeScript, build, seis tests Node y prueba de navegador aislada. La validación completa de persistencia/RPC real queda pendiente de DB; no se afirma un PASS de integración PostgreSQL.
- Pendiente DB: `supabase/tests/country_eligibility.sql`, contra una base local descartable tras `npx.cmd supabase db reset --local`. Ejecutar con psql y ON_ERROR_STOP=1 o mediante psql del contenedor local. El script usa fixtures transaccionales, roles/JWT, RPCs reales y ROLLBACK; no es un script de despliegue.

El SQL cubre MX en MX/AR, DE rechazado por RPC directa, DE permitido en all_countries, país NULL/legacy ZZ rechazado incluso en all, discovery/detail excluidos para DE, guards inválidos, persistencia AR por profile RPC, countries dedupe, all sin filas, escrituras no ISO rechazadas, owner excluido, duplicado, evento inicial, structural lock y loaders dashboard/my tests/tracking. Simula ZZ previo a la migration retirando/restaurando transaccionalmente el CHECK dentro del fixture local; todo se revierte.

Verificación de integración manual pendiente en DB: onboarding México persiste MX; perfil MX→AR; creación/edición carga y guarda selecciones; todos→específicos y viceversa; intentos de modificar structural fields con participaciones; recorrer Explore, Dashboard, My Tests y Tracking con sus sesiones reales. Pruebas UI aisladas y revisión SQL no sustituyen persistencia real ni un E2E autenticado.

El autocierre al reducir target sigue pendiente tal como se solicitó; este ticket no lo corrige. No remoto, commit ni actualización de dependencias.

## Archivos del incremento

- Catálogo/utilidades: `src/lib/countries.json`, `src/lib/countries.ts`.
- Componentes: `src/components/country-select.tsx`, `country-select.module.css`, `country-display.tsx`; ajuste de nombres en `src/components/ui.tsx`.
- Formularios: onboarding/onboarding-form.tsx, workspace/profile/profile-form.tsx, workspace/campaigns/campaign-form.tsx; estilos acotados en globals.css.
- Validación: onboarding/actions.ts, lib/profile-input.ts, lib/campaign-input.ts, lib/auth.ts, lib/profile.ts.
- Displays/error: workspace/explore/explore-campaign-card.tsx, explore/[id]/page.tsx, explore/[id]/actions.ts, explore/[id]/join-campaign-button.tsx, dashboard/dashboard-campaign-card.tsx, campaigns/[id]/tracking/page.tsx; traducciones en lib/i18n.tsx.
- DB/tests/docs: migration nueva, supabase/tests/country_eligibility.sql, tests/countries.test.cjs, tests/country-ui-browser.cjs y este documento. El informe de auditoría previo se conserva sin modificaciones.
