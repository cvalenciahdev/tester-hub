# Auditoría de abuso lógico y frecuencia — MVP

Fecha: 2026-10-09 (America/Cancun).

**Dictamen: FAIL de prevención de crecimiento/escritura intensiva para un MVP con alta abierta a usuarios no confiables. PASS de los guards de duplicación, ownership y eventos repetidos revisados/probados.** Un piloto cerrado puede aceptar los riesgos residuales explícitamente; esta auditoría no certifica protección de tráfico/infraestructura de un despliegue remoto.

Se implementó una optimización concreta de rechazo de feedback, sin introducir números, cuotas o un limitador genérico. Los vectores C/D restantes se reportan antes de decidir umbrales, conforme a la solicitud. No se modificaron UI, duración, country, target, monetización ni otras reglas de campaña.

## Clasificación e inventario

- **A:** protección suficiente contra repetición lógica mediante estado/constraint. No necesariamente idempotente: una segunda llamada puede devolver error en vez de éxito.
- **B:** repetición sin crecimiento lógico permanente relevante por llamada; carga de tráfico/updates sigue existiendo y corresponde al presupuesto de infraestructura. No se justifica un limitador de aplicación por reflejo.
- **C:** crecimiento o amplificación real permitido por la superficie actual.
- **D:** escritura de tester que retiene locks compartidos y para la que se recomienda protección de frecuencia antes de alta abierta; ventana/umbral requieren decisión. No es una cifra ni una cuota aprobada.

Actor tester/developer es relación con el recurso: initial_intent no es un rol de autorización. Toda RPC de usuario deriva identidad de auth.uid(); las escrituras REST de tablas aplican RLS contra auth.uid(). UI disabled/inFlight no se considera defensa de backend. Server Actions se pueden invocar por POST directo; también deben considerarse las llamadas directas a Supabase.

| RPC/acción | Actor autorizado | Estado / filas nuevas | Defensa existente | Repetición / impacto | Clase |
| --- | --- | --- | --- | --- | --- |
| join_campaign | Auth ajeno a app y elegible | Una participación + joined | Lock C; unique(campaign_id,tester_id); capacidad; estado abierto; actor/eligibilidad | Misma cuenta/campaña no duplica ni crea eventos; el check ALREADY_JOINED ocurre antes de count/INSERT | A |
| add_participation_feedback | Tester de participación active | Una nueva fila por llamada; sin participation_event | C→P; recheck tester/state; texto requerido; author=auth.uid | Múltiples entradas son el modelo aprobado, pero no hay tope de cantidad/tamaño acumulado; tracking del owner devuelve todas | C |
| update_participation_feedback | Author y tester propio active | UPDATE, sin nuevas filas/eventos | C→P→F; autor/state recheck | No multiplica filas, pero un tester puede reescribir texto sin pausa y disputar lock de campaña con otros actores | D para alta abierta |
| Create app: action + REST apps INSERT | Auth owner_id propio | Una app por llamada | RLS owner, name no vacío; PK | Nombres repetidos permitidos; filas/texto sin cuota funcional; action-only rate limit sería bypassable por REST | C |
| Update app: action + REST apps UPDATE | Owner propio | UPDATE, sin nuevas filas/eventos | RLS ownership; action limita campos/archive | Writes/WAL/vacuum bajo repetición, sin duplicación lógica; la semántica de archive no se cambia aquí | B |
| create_campaign | Owner de app activa | Campaña draft + países seleccionados | Lock app; inputs/ownership; PK countries | Cada llamada crea una campaña válida distinta; serializar por app no limita total ni apps diferentes | C |
| update_campaign | Owner, campaña editable | UPDATE; puede reemplazar countries antes de participaciones | Lock C; terminales/structural locks/piso covered; helper central | Repetición no duplica países ni participaciones/eventos; updates, revalidación y locks generan carga | B |
| publish_campaign | Owner, solo draft | Estado recruiting, sin participation_event | Lock C + guard draft | Segunda llamada falla; no publicación duplicada | A |
| cancel_campaign | Owner, draft/recruiting/testing | Cancelled + evento por participación aún abierta | Lock C; transacción; solo abiertos; terminales | Segunda llamada falla; no evento repetido. Coste inicial proporcional a participaciones abiertas | A |
| enable_access | Owner de campaña | waiting_access→access_enabled + evento | Lock P; actor; estado exacto | Segunda llamada falla antes de UPDATE/INSERT evento | A |
| confirm_installation | Tester propio | access_enabled→active + evento | C→P; actor y estado exacto; cálculo seguro existente | Repetir falla, no nuevas fechas/eventos | A |
| complete_participation | Tester propio | active→completed + evento | C→P; actor/periodo/feedback; helper central | Repetir falla; campaña/participación no se reabren | A |
| mark_incompatible | Tester propio | Abierto→incompatible + evento | Lock P; actor; estados abiertos; razón requerida | Terminal no repetible; no spam de eventos por la misma participación | A |
| abandon_participation | Tester propio | Abierto→abandoned + evento | Lock P; actor; estados abiertos | Terminal no repetible; no rejoin de cuenta en campaña por unique | A |
| cancel_participation | Owner de campaña | Abierto→cancelled + evento | Lock P; actor; estados abiertos | Terminal no repetible; cupo se libera sin duplicar estado/evento | A |
| complete_onboarding action/RPC | Auth propio | Actualiza profile, reemplaza devices | Action rechaza onboarding ya completo; RPC valida 1–2/unique platform | RPC directa puede repetirse: reemplazo acotado, nuevos IDs/WAL, no acumulación de devices por esa RPC | B |
| update_my_profile | Auth propio, device IDs propios | UPDATE/reemplazo de colección | Lock profile; ownership devices; 1–2/unique platform en RPC | No crecimiento indefinido por RPC; writes/WAL/IDs bajo repetición | B |
| profiles UPDATE REST | Auth propio | UPDATE | RLS id propio | Campos/texto pueden reescribirse; no nuevas filas ni privilegios por intent | B |
| user_devices INSERT REST relacionado | Auth user_id propio | Nueva fila por llamada | RLS owner; PK; enums/versiones | Las reglas de colección de RPC no se aplican a INSERT directo: múltiples filas misma plataforma aceptadas | C |
| get_dashboard_data | Auth propio | Read | Scope tester/owner; proyecciones limit 3; métricas indexadas | Repetir solo consume consulta; counts escalan con historial | B |
| list_available_campaigns | Auth con perfil válido | Read | Scope eligibility, limit1–48, offset no negativo | Paginación de respuesta; count y offset profundo pueden costar, sin problema de tráfico medido | B |
| get_campaign_detail | Auth elegible | Read | UUID/state/scope + solo propia participación | No filas/eventos nuevos; no datos privados ajenos | B |
| get_campaign_tracking | Owner de esa campaña | Read histórico | Check owner antes de leer testers/feedback | Amplifica C de feedback: JSON contiene toda la historia. No añadir rate limit a esta lectura | B, afectada por C |
| list_my_participations | Tester propio | Read histórico | tester_id=auth.uid; feedback propio | JSON agregado sin paginación total; amplifica su historial propio | B, afectada por C |
| My Apps / app rounds loaders | Auth owner propio | Read | RLS + scope explícito; páginas de 500 | Recorren todas las páginas; resumen apps filtra rounds por cada app, coste crece con ambas colecciones | B, afectada por C |

Los helpers internos no amplían creación/frecuencia por API: completion/safe-date están reservados a los caminos existentes. Auth callbacks/logout no agregan filas de negocio por repetición; la creación de cuentas pertenece a Auth y no se convirtió en un limitador genérico aquí.

## Vectores reales y prioridad

### 1. Texto procesado antes de actor autorizado — corregido

Ubicación original: `20261005110000_participation_feedback.sql:36,61`, initializers de v_text. regexp_replace se evaluaba al entrar, antes de NOT_AUTHENTICATED/ownership. Un autenticado ajeno podía mandar texto grande y obtener rechazo después del trabajo de normalización. No había fuga ni escritura ajena, pero se gastaba CPU innecesaria.

Migration nueva `20261009180000_feedback_authorize_before_normalize.sql`: v_text se declara sin inicializar; la misma regexp_replace se ejecuta después de las comprobaciones iniciales de actor/autor y antes de C→P/F. Todas las comprobaciones finales, errores y retornos quedan textualmente intactos. También reduce el tiempo que una llamada autorizada tarda reteniendo los locks, respecto a mover la normalización dentro del lock.

Medición ilustrativa local del mismo probe de tres llamadas rechazadas con texto de 1 MiB preconstruido: add pasó de 92.139 ms a 4.277 ms; update de 109.528 ms a 2.683 ms. Una repetición posterior dio 3.945/2.444 ms. No son SLOs, capacidad de producción ni base suficiente para elegir acciones/minuto. El tamaño/cantidad del probe son parámetros de test, no límites impuestos.

La mejora no evita parsing/transporte de requests grandes ni escrituras autorizadas masivas. Esa protección general se deja a plataforma/infraestructura.

### 2. Feedback acumulado y edición intensiva — C/D pendientes

El contrato permite muchos feedbacks durante active; no hay límite funcional explícito de entradas ni longitud. Un tester puede agregar entradas, incluso iguales, repetidamente. El SQL de prueba creó 21 entradas cortas; owner tracking devolvió las 21, payload de aproximadamente 5 KiB. El problema es crecimiento proporcional y acumulado, no que 21 sea una cantidad prohibida.

La edición no crea filas lógicas adicionales, pero mantiene C→P→F y genera versiones/WAL. Un tester autorizado puede disputar recursos de su campaña con owners/otros testers. Para un piloto pequeño conocido puede aceptarse; antes de abrir alta se recomienda resolver la decisión de frecuencia para escrituras de feedback.

Owner puede cancelar la participación y detener nuevas escrituras gracias al state guard; el historial ya escrito permanece. Un rate limit temporal reduce velocidad, no resuelve retención/crecimiento acumulado. No se impuso un máximo de feedbacks ni se deduplicó texto porque cambiaría el modelo.

### 3. Apps y campañas — C pendientes

Apps INSERT está expuesto por REST bajo RLS; crear nombres iguales produce apps distintas válidas. create_campaign crea drafts repetidos y puede ejecutarse sobre apps distintas. Lock por app serializa ese recurso, sin quota/frecuencia global. El probe creó dos apps con el mismo nombre y dos campañas con iguales parámetros, sin rechazo ni side effect duplicado inesperado.

Una protección futura debe cubrir el origen real: DB para apps INSERT directo; RPC para campaign. No basta un contador solo en Next. Las tablas de negocio tienen created_at manipulable en algunos writes directos: no confiar ciegamente en ese campo para contar intentos salvo que se garantice servidor como autoridad.

### 4. Devices directos — C secundario pendiente

Las RPCs de colección validan 1–2 dispositivos/plataformas únicas; policies de user_devices permiten INSERT owner sin ese invariante de colección. La prueba insertó tres android propios directamente; una inserción con user_id ajeno fue rechazada por RLS. Es un bypass de la validación de colección, no de ownership.

No se corrigió schema ni se inventó quota en este ticket. Decisión requerida: confirmar que la regla de colección también rige el CRUD REST y diseñar enforcement compatible con IDs/cambios de plataforma/datos existentes, o cerrar la vía directa explícitamente. Añadir cooldown solo al profile RPC no protegería esta vía.

## Lo que ya estaba protegido y no necesita limiter MVP

Join: FOR UPDATE campaña serializa check+count+INSERT, unique(campaign,tester) cubre carreras y terminales; repetición no llega al count/cupo ni al evento tras ALREADY_JOINED. Sí consume auth/lookups y lock breve, pero no se observó una razón para cambiar sus errores/precedencia o añadir rate limit. La UI hace su precheck adicional; no se confió en él para seguridad.

Las transiciones verifican actor y estado dentro de SQL. Sus errores ocurren antes de INSERT de evento; cancel_campaign solo genera eventos para abiertos que realmente cierra. Los counts de cupo no se alteran por intentos rechazados. No se relajó el modelo de target/country/lifecycle.

Autenticados no pueden usar user_id/author_id para tomar identidad ajena: RPCs usan auth.uid; apps/devices directos validan owner_id/user_id contra auth.uid en RLS. No hay un nuevo limitador bypassable porque no se creó ninguno. Un futuro limitador debe derivar actor del mismo origen y compartir exclusión entre acciones simultáneas del mismo actor.

No se proponen limitadores de dashboard/discovery/tracking/My Tests/listados. El crecimiento observado de sus respuestas debe tratarse en escrituras, retención/paginación y capacidad; limitar lecturas legítimas del owner ocultaría el problema. El TOML local contiene rate limits de Auth; no protegen automáticamente las RPCs de negocio. No se inspeccionó un despliegue remoto ni se certifican sus protecciones de tráfico.

## Concurrencia

- join: lock C y unique; dos joins mismo tester se serializan/rechazan, dos testers para último cupo se serializan por C. No se añade rate limiter por reflejo.
- feedback create: C→P, estado revalidado. Dos creaciones válidas pueden crear dos entradas según el modelo; ningún unique de una sola entrada sería apropiado sin cambiar producto. Esto confirma C, no una carrera de corrupción.
- feedback edit: C→P→F; actor/state rechecks. El cambio mueve solo cálculo de texto y no cambia orden de locks. Si el estado cambia mientras se normaliza fuera del lock, el recheck sigue rechazándolo correctamente.
- create campaign: app lock y transacción campaña+países; dos calls pueden crear dos campañas completas distintas. Create/publish en Next siguen siendo RPCs separadas y el cliente informa draft recuperable; no se añade idempotency key que suprima creaciones legítimas.

No existía harness SQL concurrente de dos sesiones. Los tests añadidos usan repetición secuencial y revisión de locks/constraints; no se afirma que ejecutaron llamadas simultáneas. Plan local para dos sesiones: dejar join en BEGIN reteniendo C, lanzar segundo join y verificar espera; commit primero; segundo debe fallar ALREADY_JOINED o NO_AVAILABLE_SLOTS. Mismo procedimiento con feedback create: dos éxitos con IDs distintos si active permanece; con transition: un éxito y otro INVALID_PARTICIPATION_STATE, un solo evento. No se hizo stress test ni se simuló DDoS.

## Decisión de producto/técnica requerida antes de poner números

No se aprobó ni implementó X/minuto, campañas/día, maximum feedback ni cap de texto. Para cerrar C/D antes de alta abierta:

1. Acordar el modo de MVP (piloto conocido o alta abierta), presupuesto de DB/almacenamiento y patrón legítimo de burst (feedback con varias observaciones, import/retries, creación manual).
2. Medir latencia/coste de escrituras autorizadas y contención en entorno representativo. El probe de rechazo de 1 MiB no permite derivar un umbral de uso legítimo.
3. Proponer ventana, burst y unidad por auth.uid para cada vector; distinguir límite temporal técnico de cuota comercial permanente. No hay números suficientes sustentados en esta sesión para recomendarlos como política lista para implementar.
4. Cubrir RPC y REST directos. Seleccionar el estado mínimo seguro, con identidad/timestamp controlados por servidor; evitar añadir tabla genérica de attempts si basta la solución concreta. Un check de timestamp sin lock compartido de actor puede ser bypassed por requests simultáneos a recursos distintos.
5. Revisar retención/paginación a largo plazo como trabajo separado; no presentar rate limiting temporal como tope de crecimiento total.
6. Si se aprueba una limitación, definir error funcional estable (por ejemplo RATE_LIMITED según convención), traducciones y tests de actores/concurrencia. Hoy no se agregó ese error ni traducciones innecesarias.

## Pruebas y archivos

Nuevos archivos de este incremento: la migration de feedback, `supabase/tests/logical_abuse.sql`, `tests/logical-abuse.test.cjs` y este documento. No cambios de aplicación/UI, migrations históricas ni dependencias.

SQL local: probe de crecimiento permitido apps/campaigns/feedback/devices; RLS frente a owner falso; actor falso en feedback; repetición join/último cupo/enable/confirm/complete sin evento extra; feedback poscierre rechazado; trim/texto/author del tester legítimo intactos. Todo termina con ROLLBACK. Tres tests Node comparan las funciones con las originales quitando únicamente el movimiento de normalización y comprueban actor→normalización→lock.

Validaciones: seis suites SQL locales, 17 tests Node, browsers existentes, lint, tsc --noEmit, build y git diff --check. La migration sí permanece aplicada en la base local; los fixtures no.

Riesgos post-MVP: multi-account/Sybil (unique es por cuenta), ocupar plazas legítimas sin intención de probar (owner puede cancelar; no se añadió auto-expiry), datos ilimitados por C, contención de escrituras por D y amplificación de respuestas históricas. No se encontró bypass de ownership ni generación duplicada de eventos por repetir transiciones.

**No se creó un sistema genérico de rate limiting, una tabla de attempts ni cuotas arbitrarias. Sin remoto, reset o commit.**
