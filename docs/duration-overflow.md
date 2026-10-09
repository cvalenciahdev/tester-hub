# Protección técnica del cálculo de fechas

Android sigue sin máximo funcional/comercial de duración. No se cambian presets, Custom ni el máximo HTML existente del tipo integer; ningún número se presenta como regla de Google Play.

## Investigación y reproducción

`duration_days` es PostgreSQL integer (int4). El cálculo vigente está en confirm_installation: `installed_at + make_interval(days => duration_days)`, con ambos timestamps timestamptz. Las definiciones históricas anteriores están sustituidas por esa RPC final, no son caminos adicionales vigentes. Dashboard/My Tests/Tracking leen expected_end_at; dashboard calcula progreso con diferencias/extract(epoch), sin volver a sumar duration_days. El frontend valida/convierte expected_end_at mediante Date.parse y Date/Intl.

Reproducción local: fecha `2026-10-09 00:00:00+00`, duración `2147483647` (máximo int4). make_interval devuelve `2147483647 days` sin error: su campo days puede almacenar el valor. **La suma timestamptz + interval falla**, capturada como SQLSTATE **22008**, mensaje **timestamp out of range**, ubicación PostgreSQL `timestamptz_pl_interval_internal, timestamp.c:3291`. No se asumió interval overflow ni integer overflow como el fallo observado.

Existe además una frontera del formato actual de la aplicación: PostgreSQL JSON serializa el año 10000 como `10000-01-01T00:00:00+00:00`. Date.parse en Node actual devuelve NaN para ese formato sin signo de año extendido, mientras `9999-12-31T00:00:00+00:00` sí es válido. El frontend vigente no normaliza ISO de años extendidos. No basta con que PostgreSQL admita el timestamp.

## Estrategia

Nueva migration `20261009160000_safe_participation_duration.sql`, aplicada solamente a Supabase local, sin reset/backfill. Las migraciones históricas permanecen intactas.

Helper central privado: `public._safe_participation_end_at(timestamptz, integer)`, SECURITY INVOKER con search_path vacío. No lee ni modifica datos; devuelve la fecha calculada o un error estable.

1. Conserva INVALID_DURATION_DAYS para null/no positivo y rechaza ancla null/no finita.
2. Ejecuta exactamente la suma previa de días de calendario, preservando timezone y DST. Captura datetime_field_overflow, interval_field_overflow y numeric_value_out_of_range en un bloque limitado al cálculo y los traduce a **DURATION_OUT_OF_RANGE** (P0001).
3. Verifica resultado finito y la representación actual de años ISO de cuatro dígitos: intervalo UTC `[0001-01-01, 10000-01-01)`, y año local de la sesión 1–9999. Esto es una frontera técnica de serialización/consumo, no un máximo de días de negocio. El umbral de días depende del ancla y su zona; no se inventa ni muestra una constante de duración Android.

Puntos de uso:

- create_campaign: preflight después de los checks actuales de positividad/iOS y antes de insertar, usando now().
- update_campaign: después de structural locks/iOS, preflight de la duración efectiva si es editable sin participaciones. Preserva legacy bloqueado sin cambios y la llamada de autocierre anterior.
- confirm_installation: reemplaza la suma cruda por el helper usando el installed_at real, todavía dentro de locks campaña → participación. Revalida siempre, incluso legacy que evitó create/update o que quedó fuera de rango desde su preflight inicial.

Una fecha de instalación futura puede cambiar la representabilidad cerca del borde: por eso el preflight no sustituye la validación en instalación. No se truncaron ni actualizaron automáticamente campañas/participaciones existentes. Fallar en confirm no cambia status, installed_at/expected_end_at, campaña ni eventos.

No se duplica aritmética entre RPCs. Create/update/confirm conservan firmas, ownership, estados y ACLs existentes mediante CREATE OR REPLACE. El helper no queda invocable por roles API; solo lo utilizan las RPCs existentes bajo su propietario autorizado. No se cambian permisos de recursos ni reglas de negocio.

## Error visible

Mapeo técnico en guardar campaña y confirmar instalación:

- ES: “La duración seleccionada es demasiado grande para procesarse de forma segura.”
- EN: “The selected duration is too large to process safely.”

No se muestra stack, SQLSTATE interno ni rango numérico nuevo en UI. iOS mantiene 1–90 y el error IOS_DURATION_EXCEEDED anterior.

## Validación

- `duration_overflow_reproduction.sql`: captura el fallo crudo 22008 sin mutaciones; sigue ejecutable después del hardening.
- `safe_participation_duration.sql`: Android14, Android100000 (alto pero seguro), rechazo en create/update de 2147483647, confirm extrema legacy controlada/atómica, iOS90 confirmado y iOS91 rechazado; frontera de año10000, Infinity y conservación de DST. Fixtures con ROLLBACK.
- Suites SQL existentes `platform_duration`, `target_reduction_completion` y `country_eligibility`: regresión sobre Supabase local.
- Node: tests existentes más mapeo ES/EN, compatibilidad Date.parse y preservación exacta de las RPCs anteriores fuera de los nuevos puntos de uso.
- Browser: suites locales existentes country/duration, aisladas de Supabase. No se rediseña producto.
- Lint, TypeScript sin emit, build y git diff --check.

Los tests SQL usan PostgreSQL real local; no se consultó ni aplicó nada remoto. La base local ya estaba disponible y tenía la migration de duración anterior aplicada. No se hizo commit, reset ni actualización de dependencias.

## Archivos de este hardening

Modificados sobre el incremento anterior: campaign-form.tsx (mapeo del error), my-tests/actions.ts y participation-actions.tsx (error de confirmación), campaign-input.ts, i18n.tsx, tests/duration.test.cjs y docs/platform-duration.md.

Nuevos: la migration 20261009160000, duration_overflow_reproduction.sql, safe_participation_duration.sql y este documento. Componentes/presets/límite HTML de duración anteriores no se modificaron. Ninguna migration histórica se editó.

Resultados: PASS de las cinco suites SQL, 14 tests Node, los dos navegadores locales y validaciones técnicas. Los fixtures SQL se revirtieron con ROLLBACK; la nueva migration sí permanece aplicada únicamente en la base local.
