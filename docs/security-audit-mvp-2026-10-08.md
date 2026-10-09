# Auditoría de seguridad y permisos — Tester Hub MVP

Fecha: 2026-10-08 (America/Cancun). Dictamen general: **FAIL para aprobar el release** por H1. El aislamiento entre usuarios pasa la revisión estática, con las limitaciones descritas abajo.

## 1. Resumen ejecutivo y alcance

Se revisaron las 18 migraciones locales en orden, utilizando la última definición de cada función; las ocho tablas del alcance; los clientes Supabase; loaders, rutas dinámicas y server actions; configuración OAuth y entorno; dependencias instaladas y documentación del Next.js instalado (16.3.8).

La principal brecha es que `join_campaign` puede invocarse directamente por cualquier usuario autenticado y no aplica el filtro de país que sí aplica Explore. Ocultar la campaña o comprobarla en la server action no cierra la API de Supabase. También se encontraron rutas de escritura con validaciones desiguales, límites de abuso ausentes y un defecto de autocierre de campaña.

No se encontró evidencia estática de lectura arbitraria de perfiles, dispositivos o feedback de otros usuarios, modificación de campañas ajenas, intercambio de acciones entre tester y owner, secretos privados en el cliente, XSS ejecutable ni SQL dinámico.

**Límite de evidencia:** esta es una auditoría de código y del estado reconstruible de migraciones, no una certificación de políticas desplegadas. No se consultó Supabase remoto ni se ejecutaron mutaciones de negocio. Docker local no está disponible (no existe el pipe `docker_engine`), y no se dispone de `psql`. No se ejecutaron pruebas de actores ni sesiones concurrentes sobre PostgreSQL. ACLs heredadas, propietarios efectivos, BYPASSRLS, privilegios CREATE/TEMP y drift de esquema quedan pendientes de comprobar en un entorno autorizado. Los PASS de SQL significan PASS estático, no una prueba de explotación negativa.

No se modificaron aplicación, schema, migraciones, RLS, RPCs, UX, copy, rutas ni dependencias. Solo se añadió este informe. No hubo commit, push, consulta a base remota ni despliegue. Las únicas consultas externas fueron al registro npm para los audits expresamente solicitados.

## 2. Hallazgos por severidad

### CRITICAL

Ninguno identificado en el alcance local. Esto no certifica la ausencia de vulnerabilidades en el despliegue.

### H1 — HIGH — Join directo omite la restricción de país

- **Ubicación:** `supabase/migrations/20261003204415_join_campaign.sql:18`, especialmente el bloque de perfil en 105–116 y el INSERT en 161–178. Contraste: `20261004035653_campaign_discovery.sql:127` y `src/app/(workspace)/explore/[id]/actions.ts:17`.
- **Atacante:** usuario autenticado ajeno a la app, con testing email no vacío, fuera del país permitido; también un usuario sin onboarding completo.
- **Vector:** llamar directamente `rpc('join_campaign', {p_campaign_id: UUID_CONOCIDO})` usando su propia sesión. El EXECUTE está concedido a `authenticated`; no hace falta pasar por Next.
- **Impacto:** ocupa cupos de una campaña excluida de su discovery y altera la audiencia que autorizó el owner. Puede agotar plazas con cuentas distintas. No concede acceso a perfiles o feedback ajenos; el enlace de instalación sigue requiriendo habilitación del owner.
- **Evidencia:** comprueba auth, campaña abierta, app no archivada, owner distinto, email no vacío, duplicado y capacidad. No consulta `campaign_countries` ni exige país válido. La server action reconoce expresamente esta ausencia y aplica discovery antes de llamar; ese filtro no protege la RPC directa.
- **Reproducción propuesta, NO ejecutada:** campaña recruiting con países `[MX]`, tester con perfil `US`, sesión de ese tester y UUID compartido por un tester elegible. Discovery debe excluirla; la RPC actual puede insertar la participación si hay cupo.
- **Corrección propuesta:** migration que reemplace `join_campaign` y compruebe país del perfil contra `all_countries/campaign_countries` dentro de su transacción, manteniendo el bloqueo de campaña, validaciones y retorno actuales. Añadir prueba directa de RPC con país permitido, excluido y nulo. No introducir matching de SO/dispositivo: está expresamente fuera del contrato actual.
- **Bloquea release:** sí, antes de staging con usuarios de prueba externos y antes de producción. No impide usar un sandbox privado para reproducir y corregir.

### M1 — MEDIUM — Autocierre no se reevalúa al reducir target

- **Ubicación:** `20261003215920_participation_closures.sql:89,170,250`; `20261004033650_campaign_create_and_update.sql:147`; helper `20261003221616_campaign_lifecycle.sql:8`; último completion `20261005120000_complete_participation_feedback.sql:92`.
- **Actor/vector:** owner reduce target en una campaña testing; también una acción legítima sin intención maliciosa.
- **Impacto:** campaña puede permanecer `testing` aunque ya cumpla el criterio documentado de completados >= target y ninguna participación abierta. Estado, métricas y descubrimiento quedan desactualizados.
- **Evidencia:** solo `complete_participation` llama al helper. Reproducción propuesta: campaña testing con completados=2, target=3, sin abiertos; reducir target a 2 está permitido porque target >= cubiertos, pero no evalúa cierre. No ejecutada contra DB.
- **Corrección propuesta:** migration que reevalúe después del cambio de target, reutilizando el lock de campaña y manteniendo terminales. Abandon/incompatible/cancel tampoco llaman al helper, pero con el invariante cubiertos <= target no puede coexistir completados >= target con una participación abierta: esa ausencia no demuestra otro escenario alcanzable. Si se amplía la evaluación a cierres en el futuro, primero unificar locks campaña → participación; no anexar un lock C después de retener P.
- **Bloquea release:** no staging privado; recomendado resolver antes de producción para cumplir el ciclo de vida anunciado. Es un defecto de integridad/disponibilidad, no escalación de permisos.

### M2 — MEDIUM — Escrituras públicas sin cuotas y lecturas agregadas sin límite

- **Ubicación:** `20261005110000_participation_feedback.sql:32`; `20261004033650_campaign_create_and_update.sql:14`; `src/app/(workspace)/apps/actions.ts:16`; `20261005130000_participation_feedback_reads.sql:2,57`; loaders `src/lib/apps.ts:29` y `src/lib/app-rounds.ts:31`.
- **Atacante/vector:** autenticado crea muchas apps/campañas o muchos feedbacks en una participación activa; invoca RPCs repetidamente. Un join por cuenta/campaña limita duplicados, pero no cuentas ni campañas distintas.
- **Impacto:** almacenamiento y consultas crecientes, respuestas JSON grandes, carga en tracking del owner y contención de locks de campaña. El límite de cuerpo de Next no limita la cantidad acumulada de registros ni la API directa.
- **Evidencia:** no hay cuota o rate limit de negocio; feedback admite múltiples entradas sin límite; `jsonb_agg` devuelve toda la historia; los loaders paginan la API pero recorren todas las páginas. Los límites de Auth en config solo protegen endpoints de Auth.
- **Corrección propuesta:** acordar cuotas por actor/recurso y presupuestos de texto/filas, aplicarlos en la base para RPC directa y paginar historia; considerar controles de frecuencia en el borde. No se implementó rate limiting.
- **Bloquea release:** no para MVP cerrado con participantes conocidos; antes de apertura pública requiere mitigación o aceptación explícita de presupuesto/riesgo. No se clasifica como CRITICAL.

### M3 — MEDIUM — Duración válida para el schema puede desbordar el intervalo

- **Ubicación:** `src/lib/campaign-input.ts:30`; `20261004033650_campaign_create_and_update.sql:67,253`; `20261003221616_campaign_lifecycle.sql:336`.
- **Atacante/vector:** owner publica campaña con duración extremadamente alta, aceptada como integer positivo (hasta 2147483647), luego el tester confirma instalación.
- **Impacto:** `make_interval(days => duration_days)`/suma al timestamp puede desbordar y abortar confirmación; otros valores excesivos mantienen la prueba abierta durante un plazo irrazonable. Afecta esa campaña, no demuestra caída global.
- **Evidencia:** solo se comprueba positividad y rango integer, sin un máximo útil; confirmación convierte los días a intervalo y fecha. La condición exacta de overflow queda pendiente de prueba PostgreSQL.
- **Corrección propuesta:** definir máximo de duración acorde al producto y aplicarlo a RPCs y constraint/input; validar datos existentes antes de una migration.
- **Bloquea release:** no staging privado; resolver antes de producción o aceptar explícitamente el riesgo acotado.

### L1 — LOW — Archivado de app solo es readonly en la server action

- **Ubicación:** `20261003070042_core_schema.sql:553`; `src/app/(workspace)/apps/actions.ts:39`.
- **Atacante/vector:** owner hace UPDATE directo de su app archivada, incluso `archived_at = null`.
- **Impacto:** el contrato readonly de archivado puede omitirse y la app puede volver a estar disponible. No permite cambiar ownership a otro usuario ni editar apps ajenas.
- **Evidencia:** RLS USING/WITH CHECK solo exige `owner_id = auth.uid()`; no restringe columnas o estado. El filtro `.is('archived_at', null)` existe únicamente en Next. La creación/actualización/publicación/join de campañas sí comprueba el archivado, pero usa la situación actual de la app.
- **Corrección propuesta:** aclarar si restaurar es una operación autorizada; si readonly es obligatorio, centralizar modificación/restauración con permisos de columna o RPC/trigger que preserve el contrato. No cambiar reglas de negocio sin aprobación.
- **Bloquea release:** no; decisión del producto antes de afirmar que archivado es irreversible o inmutable.

### L2 — LOW — Validación de perfil/dispositivos difiere según vía

- **Ubicación:** `20261003070042_core_schema.sql:40,70,476,501`; `20261004044423_complete_onboarding.sql:34`; `20261004140000_update_my_profile.sql:27`.
- **Atacante/vector:** usuario modifica su perfil/dispositivos directamente o vuelve a llamar onboarding por RPC. Onboarding solo exige email no vacío; UPDATE de perfil no exige ni formato ni trim de email. CRUD directo de dispositivos omite las reglas RPC de 1–2 dispositivos y plataforma única.
- **Impacto:** datos propios inconsistentes; email inválido copiado a snapshot del owner; duplicados de plataforma; bypass del guard de onboarding por datos suficientes aunque inválidos. No hay acceso a otros perfiles/dispositivos ni escalación por `initial_intent`.
- **Evidencia:** constraints validan país y versiones no negativas, pero no equivalencia con todas las reglas RPC. `getOnboardingStatus` exige campos no nulos y algún dispositivo, no email válido. `complete_onboarding` no comprueba que onboarding ya esté completo, aunque la server action sí lo comprueba.
- **Corrección propuesta:** unificar invariantes mínimas en DB y establecer si CRUD directo es parte del contrato; validar email en onboarding y preservar serialización por perfil. El email de testing es declarado por el usuario: su propiedad no está verificada por ese campo.
- **Bloquea release:** no; endurecimiento de integridad. La ausencia de verificación de ese email es un riesgo aceptable solo si no se usa como identidad de autorización.

### L3 — LOW — Validación de URLs se aplica al consumo, no al almacenamiento

- **Ubicación:** `20261004033650_campaign_create_and_update.sql:105,310`; `src/lib/campaign-input.ts:21`; protección en `src/lib/my-tests.ts:49`.
- **Atacante/vector:** owner guarda `javascript:`, `data:`, URL malformada o URL HTTP con credenciales en campos de enlace.
- **Impacto:** datos inválidos y enlace de instalación ausente; riesgo para futuros consumidores que rendericen el valor crudo. No hay XSS demostrado en el flujo actual: `installationUrl` solo deja pasar http/https antes del href.
- **Evidencia:** SQL/input solo trim; `opt_in_url` puede escribirse por RPC pero no se usa en el flujo UI revisado; store URL sí se filtra al leer. React escapa los textos.
- **Corrección propuesta:** aceptar explícitamente http/https en escrituras, definir si se permiten credenciales/HTTP y límites de longitud, conservar validación al consumir. No imponer whitelist de dominios sin requisito del producto.
- **Bloquea release:** no.

### L4 — LOW, condicional — Callback confía en el origen de request

- **Ubicación:** `src/app/auth/callback/route.ts:10,17,23,28`.
- **Atacante/vector:** cabecera Host/origen manipulable a través de un despliegue que no valide hosts. Los destinos relativos fijos se resuelven contra `request.url`.
- **Impacto:** Location a un host inesperado si la infraestructura admite ese host. No se encontró parámetro next/returnTo que habilite open redirect por sí solo ni evidencia de robo de tokens en Location.
- **Evidencia:** `new URL('/ruta-fija', request.url)`; no hay origen canónico ni allowlist de hosts en el repo. No se inspeccionó proxy de producción.
- **Corrección propuesta:** origen canónico por entorno o validar host/origen y configurar proxy que rechace hosts inesperados. Probar Host y X-Forwarded-Host en staging autorizado.
- **Bloquea release:** no es explotación confirmada; validación del despliegue requerida antes de producción.

### L5 — LOW, condicional — Configuración local desactiva nonce de Google

- **Ubicación:** `supabase/config.toml:337` (`skip_nonce_check = true`).
- **Atacante/vector:** relevante a flujos OIDC que dependen del nonce; no se demostró ataque al authorization-code flow actual con PKCE.
- **Impacto:** protección OIDC reducida si esta configuración se reutiliza en un flujo/entorno que necesita esa validación.
- **Evidencia:** config local; cliente SSR usa `flowType: 'pkce'` por defecto y callback intercambia el code. No se obtuvo config remota de Google/Supabase.
- **Corrección propuesta:** revisar necesidad local y mantener nonce activo en producción cuando el flujo lo requiera; documentar excepciones por entorno. No asumir que este TOML describe el hosted project.
- **Bloquea release:** no staging local; revisar configuración efectiva antes de producción.

### D1 — HIGH en npm; LOW de riesgo actual del producto — DoS de braces en tooling

- **Ubicación:** `package-lock.json`, `node_modules/braces@3.0.3`; cadena detallada en sección 11.
- **Atacante/vector:** entrada de patrones de glob profundamente anidados durante ejecución de tooling con entradas controladas por atacante. No se identificó endpoint que pase user input a esta librería.
- **Impacto:** agotamiento de pila/DoS en herramienta de desarrollo. No demuestra vulnerabilidad runtime en la web.
- **Evidencia:** audit informa [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), CVSS 7.5. Cinco paquetes afectados por una misma cadena, no cinco ataques independientes.
- **Corrección propuesta:** actualizar tooling/transitiva en trabajo separado, con compatibilidad comprobada. No aplicar automáticamente el downgrade mayor a eslint-config-next 14.2.35 sugerido por npm.
- **Bloquea release:** no con el uso revisado; CI que procese patrones no confiables debe evaluar su exposición.

### INFO — Permisos efectivos y propietarios no verificables por migraciones

Ubicación: todas las migraciones y entorno local. Actor potencial: rol de despliegue con privilegios excesivos. Vector/impacto: ACL heredadas o propietario/BYPASSRLS diferente del esperado podrían cambiar las conclusiones. Evidencia: siete tablas no declaran grants explícitos; no hay ALTER OWNER ni FORCE RLS. Esto no demuestra una vulnerabilidad: los owners de tablas y roles con BYPASSRLS eluden RLS por diseño. Propuesta: inspección de catálogo de policies, relrowsecurity, roles, proowner/proacl, grants de schema/tablas/columnas y default privileges en base de pruebas. Es una brecha de verificación que bloquea una certificación definitiva, no un ataque confirmado.

## 3. RLS tabla por tabla

Las políticas son `TO authenticated`. Sin política aplicable, RLS niega filas/mutaciones aunque exista grant. Los grants por sí solos no anulan RLS. Excepto feedback, los permisos de tabla dependen de defaults del entorno y deben comprobarse: la siguiente tabla representa operaciones autorizadas por políticas, sujetas a los ACL efectivos.

| Tabla | SELECT | INSERT | UPDATE | DELETE | Hallazgos / ownership |
| --- | --- | --- | --- | --- | --- |
| profiles | Solo `id = auth.uid()` | Sin policy; trigger crea | Solo propio, mismo id tras cambio | Sin policy | No perfiles arbitrarios ni email ajeno. L2: columnas/invariantes amplias; tracking accede mediante definer acotado. |
| user_devices | Solo `user_id = auth.uid()` | Solo propio | Solo propio antes/después | Solo propio | No transferencia a otro owner. IDs ajenos rechazados por RPC. L2: CRUD omite tamaño/unique-platform de colección. |
| apps | Solo owner | Solo owner actual | Owner propio antes/después | Sin policy | No modificación/transferencia ajena por app_id. L1: no lock de archivado en DB. |
| test_campaigns | Owner de app | Sin policy; RPC | Sin policy; RPC | Sin policy | Tester accede solo a proyección discovery/my tests; owner ajeno rechazado. Terminales bloqueados en RPC. |
| campaign_countries | Owner de app de campaña | Sin policy; RPC | Sin policy | Sin policy; RPC puede reemplazar | Joins con campaigns/apps preservan ownership. H1: no se consulta para join directo. |
| test_participations | Tester de fila O owner de campaña | Sin policy; join RPC | Sin policy; transiciones RPC | Sin policy | Snapshot de email visible solo al tester propio y owner de campaña. Unique campaign/tester. |
| participation_events | Tester de participación O owner de campaña | Sin policy; RPC | Sin policy | Sin policy | Historial/metadata no públicos. Metadata actual contiene razones/source/campaign ID, sin credenciales. |
| test_participation_feedback | Tester de participación O owner de campaña | Policy tester/author propio activo, pero SIN grant de escritura | Policy author/tester propio activo, pero SIN grant de escritura | Sin policy/grant | `grant select authenticated` únicamente. Escrituras por RPC; owner de campaña readonly. M2: no cuota de filas/texto. |

Las subconsultas y joins de RLS son evaluados con los permisos del usuario; un join ordinario no habilita columnas/filas de perfiles ajenos. Los bypass legítimos están en SECURITY DEFINER y se auditan por scope manual. No hay views materializadas o vistas security-definer adicionales declaradas en el repo. No se encontró policy para anonymous en ninguna tabla del alcance.

## 4. Matriz de autorización por actor

`R/C/U/D`: read/create/update/delete. `Acción`: RPC autorizada. Los actores owner son relaciones con el recurso, no roles JWT independientes. `initial_intent` (tester/developer/both) es una preferencia y no se usa como permiso; cualquier authenticated puede crear sus propias apps y participar en apps ajenas.

| Actor | profiles | devices | apps | campaigns | participations | feedback |
| --- | --- | --- | --- | --- | --- | --- |
| anonymous | — | — | — | — | — | — |
| tester autenticado | R/U propio | R/C/U/D propios | R/C/U propias si crea app | R proyección elegible | Join; R propio | — salvo participación propia |
| developer autenticado | R/U propio | R/C/U/D propios | R/C/U propias | C en app propia; R/U/publicar/cancelar propias | Ninguna acción ajena; puede ser tester de otra app | — salvo relación owner/tester |
| campaign owner | No R de perfiles arbitrarios; nombre/país de participantes por tracking | Solo propios | R/U app propia | R/C/U; publicar/cancelar según estado | R de campaña; enable/cancel de campaña | R de campaña; nunca C/U/D por ser owner |
| participation owner | R/U propio | R/C/U/D propios | Solo propias | R discovery o proyección de prueba propia | R; confirmar/completar/incompatible/abandonar | R; C/U como author solo active; nunca D |

No hay DELETE directo autorizado para apps/campaigns/participations/feedback. Profiles son creados por trigger y dispositivos/países pueden ser reemplazados por RPC propia. Todas las operaciones de otro owner quedan prohibidas, excepto las proyecciones de discovery y los datos de sus testers que necesita tracking. H1 permite join de país excluido y debe corregirse para que la matriz deseada coincida con la superficie efectiva.

## 5. SECURITY DEFINER y RPC audit

Inventario final: **22 funciones SECURITY DEFINER** distintas: 20 RPCs usadas por la app, un helper privado y un trigger de Auth. Las sustituciones anteriores de confirm_installation, complete_participation, list_my_participations, get_campaign_tracking y get_dashboard_data no se contabilizan como RPCs adicionales.

Todas tienen `SET search_path = public` explícito y tablas/tipos de negocio calificados con `public`, más `auth.uid()`. No se encontró SQL dinámico ni construcción de identificadores desde input. No se demostró secuestro por search_path en este código. Para endurecer: `search_path` vacío con nombres calificados y retirar CREATE en schemas de confianza a actores no confiables. `pg_temp` implícito no sirve para sustituir las tablas aquí, ya calificadas. Los propietarios efectivos no están fijados en SQL y no pudieron inspeccionarse; deben ser roles confiables con privilegios mínimos.

Las 20 RPCs de usuario revocan PUBLIC, anon y service_role y conceden EXECUTE a authenticated. Cada una comprueba `auth.uid()`. Revocar a service_role no impide que el propietario/superusuario invoque una función, ni elimina posibles grants heredados externos al repo.

| Función / definición final | Actor y entradas | Auth / ownership / estado / inputs | Retorno y resultado |
| --- | --- | --- | --- |
| handle_new_user — core:405 | Trigger INSERT auth.users; NEW.id y metadata | Sin auth.uid por diseño; NEW deriva del evento; nombre no confiable solo texto | trigger NEW; no RPC normal. No revoke explícito de EXECUTE; retorno trigger no invocable como función ordinaria. No escalación encontrada. |
| _evaluate_campaign_completion — lifecycle:8 | Solo llamadas internas, campaign UUID | Sin auth/ownership por diseño; EXECUTE revocado a public/anon/authenticated/service_role; lock C; solo testing, target y sin abiertos | void; no datos. M1: cobertura incompleta de invocaciones. |
| join_campaign — join:18 | Auth ajeno a app; campaign UUID | Auth sí; owner no puede unirse; campaign abierta, archive no; email no vacío; unique/capacidad | Fila completa de participación propia, incluido email snapshot propio. H1, L2; país ausente. |
| enable_access — access:14 | Owner de campaña; participation UUID | Auth y owner sí; waiting_access; lock P; no check explícito estado C | Fila participación de su campaña. Snapshot autorizado para owner. |
| confirm_installation — lifecycle:265 | Tester propio; participation UUID | Auth/owner sí; locks C→P; access_enabled; duración deriva C; no check explícito estado C | Fila propia; active y fechas. M3. |
| complete_participation — feedback completion:1 | Tester propio; participation UUID | Auth/owner sí; C→P; active, periodo finalizado, feedback no whitespace | Fila propia; completion helper. Sin retorno de feedback ajeno. |
| mark_incompatible — closures:89 | Tester propio; UUID + razón requerida | Auth/owner sí; lock P; waiting/access/active; razón trim no vacía | Fila propia; evento. M2. |
| abandon_participation — closures:170 | Tester propio; UUID + razón opcional | Auth/owner sí; lock P; waiting/access/active; razón trim | Fila propia; evento. M2. |
| cancel_participation — closures:250 | Owner campaña; UUID + razón opcional | Auth/owner sí; lock P; waiting/access/active; no lock/check estado C | Fila autorizada; evento. M2. |
| publish_campaign — lifecycle:62 | Owner; campaign UUID | Auth/owner sí; lock C; solo draft, no archive, países cuando no all | Fila completa propia; no emails. Doble publish rechazado. |
| cancel_campaign — lifecycle:150 | Owner; UUID + razón opcional | Auth/owner sí; lock C; draft/recruiting/testing; cierra abiertos en transacción | Fila completa propia; no reabre terminal. |
| create_campaign — create/update:14 | Owner app; UUID, enum plataforma, target/duración, país/all, mínimos OS, URLs, instrucciones | Auth/owner sí; lock app, no archive; positivos, OS coherente, países formato; URLs sin protocolo | Fila completa propia; estado draft forzado. M2/M3/L3. |
| update_campaign — create/update:147 | Owner; campaign UUID + campos opcionales/flags OS | Auth/owner sí; lock C, no archive/terminal; structural locks con cualquier participación; target >= cubiertos | Fila propia; app_id no editable. M1/M3/L3. |
| list_available_campaigns — discovery:14 | Auth con país; plataforma opcional, limit 1–48, offset >=0 | Auth sí; proyección no owner, abiertas/no archive; país; no matching SO por contrato | App name/description, specs, países, IDs y counts; NO emails/enlaces/feedback/instrucciones. |
| get_campaign_detail — discovery:186 | Auth con país; campaign UUID | Auth sí; mismo scope discovery; own participation join con tester_id=auth.uid | Specs + instrucciones + estado/fechas de participación propia; NO enlaces/emails/feedback. |
| complete_onboarding — onboarding:1 | Auth; país, email, intent enum, devices JSON | Propio auth.uid; 1–2 devices/plataformas únicas; tipos/versiones; no check ya completado; email solo no vacío | void; reemplaza devices propios. L2. |
| update_my_profile — profile:1 | Auth; display name, país/email/intent, devices JSON con IDs opcionales | Auth sí; lock perfil; device IDs con owner; regex email/país y 1–2/plataformas únicas | void; solo propios; no retorno amplio. L2 existe por vías alternativas. |
| get_dashboard_data — perspectives:1 | Auth con país; sin inputs | Auth sí; cada bloque tester_id/owner_id o discovery por país; abiertos no archive en recomendaciones | Métricas propias, 3 tests, 3 eventos por perspectiva, 3 campañas discovery; NO email/link/feedback/perfil ajeno. |
| list_my_participations — feedback reads:2 | Auth; sin inputs | Auth sí; solo tester_id=auth.uid; feedback author propio; enlace condicionado a access_enabled/active | JSON propio; link en estados permitidos; sin email snapshot. M2 por tamaño. |
| get_campaign_tracking — feedback reads:57 | Owner; campaign UUID | Auth sí; SELECT inicial combina UUID y owner; participaciones de esa campaña; histórico aun archived/terminal | JSON con nombre/país actuales, snapshot, estados, razones, feedback. Scope correcto, readonly. M2 por tamaño. |
| add_participation_feedback — feedback:32 | Tester propio; participation UUID + texto | Auth/tester sí antes y después lock; C→P; active; trim whitespace y texto requerido | JSON id/texto/fechas; author_id no aceptado del cliente. M2. |
| update_participation_feedback — feedback:56 | Author/tester propio; feedback UUID + texto | Auth/author/tester sí; C→P→F; active; recheck author; texto requerido | JSON id/texto/fechas; participación/author no reasignables. M2. |

`set_updated_at` es el único helper trigger adicional: **SECURITY INVOKER**, sin search_path explícito, solo asigna `NEW.updated_at = now()` y devuelve NEW. No lo confundimos con SECURITY DEFINER ni RPC de usuario. No se encontró escalación por ese trigger.

Las filas completas que retornan las RPCs de participación son más amplias que el `.select('id')` usado en algunas server actions. Un consumidor directo puede pedir la fila autorizada completa, pero no filas ajenas. No se identificó dato sensible indebido en esos retornos según ownership actual. Considerar DTO mínimo para futuros cambios de schema.

## 6. Privacidad

| Dato | Explore / detalle | My Tests | Tracking / owner | SELECT directo / otras RPCs |
| --- | --- | --- | --- | --- |
| testing_email | Ausente | Ausente | No email actual; usa snapshot | profiles solo propio; onboarding/profile escriben propio |
| testing_email_snapshot | Ausente | Ausente | Solo campaña propia, todos los estados | participación propia o de campaña propia; mutation row autorizada |
| display_name / country | Solo país de campaña; no perfiles de testers | Ausentes | Nombre/país actuales de sus participantes | profiles arbitrarios inaccesibles; own shell/profile sí |
| installation link / store_url | Ausente incluso RPC directa detail | Solo access_enabled/active; http/https al render | No aparece en payload tracking; owner sí puede leer campaña propia | campaigns solo owner; dashboard no link |
| opt_in_url | Ausente | Ausente | No payload tracking | Campaña propia y RPCs owner; no consumidor UI actual |
| feedback | Ausente | Solo propio | Solo campaña propia, readonly | SELECT RLS tester/owner; UPDATE RPC solo author/tester activo |
| instructions | Ausentes de listado; presentes en detalle elegible | No payload actual | Owner puede leer campaña propia | No son privadas a participantes bajo contrato actual |
| otros profile/device data | Ausentes | Ausentes | No devices/model/intent/email actual | Solo propios |

PASS estático para separación Explore/My Tests/Tracking. El detalle de Explore expone instrucciones deliberadamente a usuarios elegibles; si se necesita contenido privado poshabilitación, debe definirse otro contrato. Instrucciones pueden contener PII/enlaces pegados por el owner: no existe clasificación automática del contenido libre. No afirmar que el sistema impide al propio owner publicar voluntariamente esos datos.

Tracking conserva snapshots incluso después del cierre y usa nombre/país actuales del perfil. Es acceso autorizado, no fuga cruzada; acordar retención/minimización antes de producción. La UI readonly de feedback coincide con permisos DB, no es la única defensa.

## 7. IDOR, auth, redirects, OAuth y CSRF

| Ruta/acción | Barrera efectiva y resultado estático |
| --- | --- |
| /apps/[id] | UUID validado; getUser; consulta id+owner; RLS; ajena → null/notFound |
| /apps/[id]/campaigns | getOwnApp; lecturas app+owner y RLS; ajena → notFound |
| /apps/[id]/campaigns/new | getOwnApp; archived sin form; create RPC revalida owner/archive |
| /campaigns/[id]/edit | getOwnCampaign con apps!inner owner; RLS; mutations y RPC revalidan owner/estado |
| /campaigns/[id]/tracking | RPC get_campaign_tracking limita UUID+owner antes de leer profiles/feedback; ajena → unavailable/notFound |
| Tracking enable/cancel | participationId ligado a campaignId+owner en action; RPC verifica owner de campaña real |
| /explore/[id] | RPC country/status/archive/no owner; solo propia participación en join de lectura; H1 en RPC join directa |
| /my-tests y sus acciones | RPC tester_id/auth.uid; confirmar/completar/incompatible/abandonar exigen tester propio |
| Feedback | UUID no es autorización; author y tester propio comprobados en SQL; owner de campaña no puede editar |
| Profile/onboarding | Usuario derivado de sesión; RPC no recibe user_id; device IDs comprobados por owner |

No se ejecutaron requests con UUIDs manipulados; se rastrearon barreras hasta DB. La visibilidad de UI no se usó como prueba de seguridad.

- Browser/server/proxy usan únicamente URL y clave pública. La clave local en `NEXT_PUBLIC_SUPABASE_ANON_KEY` es de tipo **publishable**, confirmado sin imprimir valor; no service_role/secret key. `server.ts` y loaders de datos llevan `server-only`.
- Proxy refresca/verifica claims; no se usa como única autorización. `getCurrentUser` usa `auth.getUser()` server-side; workspace/login/onboarding y actions verifican sesión. Las RPCs y RLS siguen verificando auth cuando se omite Next. Logout es server action que llama signOut y redirige a ruta fija.
- Workspace exige onboarding para render; las acciones de negocio no todas repiten ese guard y API directa no lo aplica. No es permiso de rol: los RPCs aceptan authenticated según sus checks. H1/L2 documentan diferencias concretas.
- `@supabase/ssr` instalado usa PKCE por defecto. Cookies por defecto: path `/`, SameSite=Lax, HttpOnly=false para acceso del cliente; el repo no fuerza Secure. HttpOnly=false es parte de la arquitectura con browser client, no una vulnerabilidad por sí solo. HTTPS, Secure y cabeceras del despliegue deben comprobarse antes de producción; no se capturaron Set-Cookie reales.
- Login/callback/logout usan destinos fijos; no existe next/returnTo/redirect arbitrario. OAuth redirectTo deriva de `window.location.origin` y depende de allowlist de Supabase. L4 cubre la confianza en request.url del callback.
- Config local: site_url 127.0.0.1:3000; callbacks exactos localhost/127.0.0.1:3000/auth/callback; README distingue callback del proveedor (Supabase puerto 54321) y callback final de app. No hay dominios comodín declarados. Una entrada HTTPS de loopback no es por sí sola open redirect. No se validaron consola Google ni allowlist hosted.
- No se encontraron mutations de negocio GET; callback GET es el intercambio OAuth esperado. Next protege server actions por POST y comparación Origin/Host según sus docs instalados; allowedOrigins no ampliado. La guía de esta versión aclara que solicitudes sin Origin pueden pasar con warning: no se infiere un CSRF explotable sin un vector de navegador, cookies y transporte real. API Supabase usa JWT del cliente; no se encontró una ruta propia de mutación GET sin protección.
- Reverse proxy debe controlar Host/X-Forwarded-Host; el código no permite certificarlos. No se añade un token CSRF redundante ni se inventa una vulnerabilidad del framework.

## 8. Concurrencia y terminales

| Carrera | Mecanismo actual / resultado |
| --- | --- |
| Último slot: joins simultáneos | FOR UPDATE campaña serializa count+insert; no sobrecupo estático bajo aislamiento habitual READ COMMITTED |
| Duplicate participation | Unique(campaign_id,tester_id) + check dentro de lock C; incluye terminales, no permite rejoin de misma cuenta |
| Doble publish | Lock C + solo draft; segunda transacción rechaza estado |
| Doble confirm | C→P y recheck access_enabled; una activa, segunda falla |
| Doble complete | C→P y recheck active/fecha/feedback; segunda falla |
| Cancel participación vs complete | Ambas bloquean P; la ganadora cambia estado y la otra rechaza; cancel individual no adquiere C |
| Cancel campaña vs confirm/complete/feedback | Todas C→P; cancel campaña actualiza C y abiertos atómicamente; siguiente acción ve P cancelled y falla |
| Cancel campaña vs enable/incompatible/abandon/cancel individual | Estas bloquean solo P. Si cierran primero, quedan terminales y cancel campaña no los reescribe; si cancel gana, rechazan. Puede haber espera; no se demuestra deadlock porque ellas no esperan luego C |
| Feedback edit/add vs complete | C→P→F (edit) o C→P (add); serialización evita escritura poscierre y lectura inestable del requisito |
| Update estructural vs join | Ambas lock C; si join gana, update ve participación y aplica locks; si update gana, join usa estructura nueva |
| Target update vs complete | Lock C serializa; piso target cubierto preservado; M1: update no evalúa autocierre |
| Autocompletion concurrente | Completion C→P y helper reusa C; conteos protegidos respecto a otros complete/join; M1 para cambio de target |
| Archive vs join/update/publish | App se lee sin lock en esas RPCs; owner puede archivar mientras otra acción usa snapshot anterior. TOCTOU de semántica de archivado, sin acceso a apps ajenas; relacionado con L1 |
| Profile collection concurrente | update_my_profile lock perfil; onboarding UPDATE perfil toma lock antes de borrar devices; transacción rollback si inválido. CRUD directo devices no comparte lock perfil y puede dejar colección distinta (L2) |

No se identificó un ciclo de locks confirmado en las definiciones actuales. No se afirma ausencia global de deadlocks sin pruebas DB, triggers externos y ACL efectivos. Al corregir M1, es esencial unificar C→P y no anexar helper C a funciones que ya retienen P.

Campaign completed/cancelled: update rechaza; publish solo draft; cancel solo draft/recruiting/testing; helper solo testing. Participation completed/incompatible/abandoned/cancelled: ninguna RPC actual permite salir de ellos. Confirm/complete/feedback no comprueban explícitamente estado C, pero bajo las transiciones actuales cancel cierra abiertos atómicamente y completed exige cero abiertos: no se encontró reapertura ni bypass alcanzable. Defense-in-depth: comprobar estado C cuando se unifiquen locks, sin tratar su ausencia como explotación ya probada.

Crear y publicar usan RPCs/transacciones separadas en Next: puede quedar draft si publish falla, y el cliente informa resultado para evitar retry ciego. Es riesgo aceptable MVP, no una atomicidad falsamente garantizada.

## 9. Inputs, XSS e injection

| Input | Validación actual | Evaluación |
| --- | --- | --- |
| UUIDs | Regex en loaders/actions; tipo uuid DB; ownership real en RLS/RPC | PASS; UUID válido no equivale a permiso |
| Emails | Trim + regex en actions/profile RPC; onboarding DB solo no vacío; tabla sin formato | L2; no verificación de propiedad de testing email |
| País | Upper/trim + dos letras; constraint A–Z | No garantiza ISO real; país autodeclarado es riesgo MVP, H1 sigue siendo bypass adicional |
| Platform/intent | Enums SQL y allowlists | PASS; intent no otorga rol |
| Target | Integer >0; update >= waiting+enabled+active+completed | Sin máximo práctico/cuota M2; no negativos |
| Duration | Integer >0 | M3; sin máximo práctico |
| Min OS | Smallint >=0; minor requiere major | PASS; devices sentinel 24 no se compara para matching según docs |
| Device collection | RPCs 1–2, platform única, tipos, IDs propios | L2 en CRUD directo; versión unknown preserva contrato |
| Display/app name, description, instructions, model | Trim en varias escrituras; nombre app no vacío; sin máximo de longitud | M2; metadata de auth nombre no confiable pero render escapado |
| Feedback | Trim whitespace en SQL; regex exige algún no whitespace; active y author | PASS de contenido requerido y ownership; M2 tamaño/cantidad |
| Reasons | Trim; incompatible requerido; demás opcionales | Sin máximo; M2 |
| URLs | Trim al escribir; http/https al consumir installation | L3; no SSRF pues no fetch server del enlace |

No hay `dangerouslySetInnerHTML`, HTML crudo desde usuarios, eval, raw SQL de la app ni EXECUTE dinámico SQL en migraciones. Feedback e instrucciones se renderizan como texto escapado por React. El enlace externo actual usa `target="_blank" rel="noopener noreferrer"` y pasa por installationUrl. No se propone sanitización HTML innecesaria para texto escapado. URLs http/https aún pueden apuntar a sitios de phishing: el enlace es elegido por el owner, no un dominio verificado por el producto.

## 10. Secrets, entorno y grants

- Búsqueda con valores redactados en archivos tracked y `.env*` locales: no se encontró secreto privado hardcodeado en fuente tracked. Coincidencias SQL `service_role` son REVOKEs; config usa env placeholders; `.env.example` contiene nombres con valores vacíos.
- `.env.local` contiene variables OAuth de Google privadas y variables públicas de Supabase; sus valores no se imprimieron. Está ignorado por `.gitignore` y no está tracked. Su presencia local es esperada; no se demuestra filtración. `.env.example` es el único `.env*` tracked.
- Solo NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY se consumen en código. Clave pública local publishable; OAuth secret no tiene prefijo NEXT_PUBLIC ni es leído por browser code. No DB password/JWT secret/token privado encontrado en fuente revisada.
- No se hizo auditoría completa del historial Git, del filesystem ajeno al repo, de logs históricos ni de bundles de despliegues anteriores. No se afirma que nunca haya habido un secreto comprometido.
- RLS ENABLED en las ocho tablas; no FORCE RLS. Ausencia de FORCE no es defecto por sí sola cuando owners/backend privilegiados son confiables; authenticated/anon no deben ser propietarios ni BYPASSRLS.
- Grants de functions son explícitos en las 20 RPCs; helper denegado a todos los roles API. handle_new_user/set_updated_at son triggers sin revoke explícito y no RPCs ejecutables como funciones normales.
- Siete tablas core no fijan ACL/default privileges; feedback sí revoca a PUBLIC/anon/authenticated/service_role y concede SELECT a authenticated. Sus policies INSERT/UPDATE existen, pero los grants niegan escrituras directas actuales; si alguien añadiese esos grants, cambiaría la superficie y se omitirían locks de RPC.
- No se encontró cambio de owner ni grant CREATE de schema en las migraciones de app. Verificar efectivos en DB; no asumir seguridad o inseguridad por defaults de otra instalación.

## 11. npm audit

`npm.cmd audit --json --cache .audit-npm-cache`: **exit 1 por vulnerabilidades**, 5 HIGH, 0 critical/moderate/low. El primer intento sandbox falló al conectar con el registro; reintento permitido completó. Sin instalación/actualización.

| Paquete | Relación | Clasificación |
| --- | --- | --- |
| braces 3.0.3 | Advisory directo GHSA-vfj7-8cjw-p6xm, stack exhaustion | Transitive, dev-only; no vector runtime identificado |
| micromatch 4.0.8 | Depende de braces | Transitive, dev-only, propagado |
| fast-glob 3.3.1 | Depende de micromatch | Transitive, dev-only, propagado |
| @next/eslint-plugin-next 16.3.8 | Depende de fast-glob | Transitive, dev-only, propagado |
| eslint-config-next 16.3.8 | DevDependency directa | Dev-only, propagado |

`npm.cmd audit --omit=dev --json --cache .audit-npm-cache`: **exit 0, cero vulnerabilidades**. `npm.cmd ls braces micromatch fast-glob eslint-config-next --all` confirmó la cadena exclusiva revisada. No es un falso positivo del advisory; es una dependencia realmente afectada sin explotación identificada por el uso actual. Un audit limpio de runtime no certifica ausencia de vulnerabilidades desconocidas.

La sugerencia automática implica cambio mayor/downgrade de eslint-config-next a 14.2.35, incompatible en principio con el objetivo Next 16: no se aplicó. La caché temporal creada para el audit se eliminó tras validar que su ruta absoluta estaba dentro del workspace.

## 12. Release blockers y recomendaciones priorizadas

**BLOCKERS before staging con actores externos:** H1. Para aprobar seguridad del entorno, reconstruir DB en entorno local/de pruebas autorizado y comprobar RLS/ACL/owners efectivos. Sandbox privado de reproducción puede avanzar sin afirmar PASS de release.

**BLOCKERS before production:** H1; cerrar la brecha de verificación de DB; verificar HTTPS/Secure cookies, host/proxy y allowlists OAuth del entorno real. Resolver M1/M3 o documentar aceptación explícita de su riesgo de integridad. Para signup abierto y usuarios no confiables, mitigar/aceptar formalmente M2 con presupuesto operativo; no es un bloqueo de un MVP cerrado por sí mismo.

**Non-blocking hardening:** L1–L3, L5 según flujo; mínimo DTO de mutation responses; reducir dependencia de ACL/defaults implícitos; search_path más restrictivo; tooling D1; límites de paginación/retención. L4 pasa a blocker si pruebas de entorno permiten Host arbitrario.

**Acceptable MVP risks, con el contrato actual:** país/dispositivo autodeclarados; SO desconocido sin matching automático; initial_intent no usado como rol; email de testing autodeclarado; texto libre escapado; enlaces http/https definidos por owner; histórico readonly de feedback/snapshots; create+publish en transacciones separadas con draft recuperable. El riesgo de abuso sin cuotas solo es aceptable temporalmente en piloto cerrado con usuarios conocidos.

Orden sugerido:

1. Aprobar corrección H1 y migration que reemplace únicamente join_campaign; pruebas RPC directas por país y estado.
2. Habilitar DB de pruebas; exportar catálogo efectivo y ejecutar matriz de dos testers, dos owners y anonymous; probar también API directa sin Next.
3. Aprobar migration de M1 que reevalúe al reducir target; reproducir ese autocierre. Ejecutar carreras de último slot, confirm/complete doble y cancel vs acciones; preservar orden de locks si se amplían otras transiciones.
4. Acordar límites de duración/texto/filas y cuotas: M2/M3. Implementar solo tras aprobación de reglas y migration correspondiente.
5. Validar configuración del despliegue: hosts, callbacks exactos, HTTPS, cookies, ownership/ACL y nonce según flujo.
6. Resolver validaciones desiguales L1–L3 y tooling D1 en incrementos separados.

No se creó ninguna migration propuesta ni se aplicó corrección de seguridad en esta auditoría.

## 13. Comandos y validaciones ejecutadas

| Comando/check | Resultado |
| --- | --- |
| git status --short inicial | Árbol limpio |
| rg --files / rg de SQL, auth, URLs, RPCs y secretos | Inventario y revisión local; valores privados redactados |
| Docs Next instalados data-security.md / serverActions.md | Consultadas reglas de autorización y CSRF de esta versión |
| npm run lint / npx tsc iniciales | PowerShell bloqueó shims .ps1; se usaron .cmd sin cambiar ExecutionPolicy |
| npm.cmd run lint | PASS, exit 0 |
| npx.cmd tsc --noEmit | PASS, exit 0 |
| npm.cmd run build | PASS, exit 0; compilación, tipos, 15 páginas generadas; rutas autenticadas dinámicas |
| npm.cmd audit --json | Primer intento falló por conectividad; no se interpretó como cero vulnerabilidades |
| npm.cmd audit --json --cache .audit-npm-cache | Completado; 5 HIGH dev, exit 1 |
| npm.cmd audit --omit=dev --json --cache .audit-npm-cache | PASS, 0 vulnerabilidades, exit 0 |
| npm.cmd ls braces micromatch fast-glob eslint-config-next --all | Cadena dev confirmada |
| docker ps --format '{{.Names}}' | No daemon local disponible; no pruebas DB ejecutadas |
| git ls-files '*.env*' / git check-ignore .env.local | Solo .env.example tracked; .env.local ignorado |
| Inspección de tipo de clave pública local | Publishable, valor redactado |
| git diff --check | PASS; informe nuevo comprobado además por lectura y whitespace |

Build/tsc produjeron artefactos locales ignorados habituales (.next, tsbuildinfo/next-env si corresponde); no cambios tracked de aplicación. Único archivo nuevo entregado: `docs/security-audit-mvp-2026-10-08.md`. No commit ni operaciones sobre base remota. Este reporte no autoriza las correcciones propuestas.
