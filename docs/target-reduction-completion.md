# Autocierre después de actualizar target

## Cambio y alcance

Migration nueva: `supabase/migrations/20261009120000_target_reduction_completion.sql`.
Reemplaza únicamente la última definición de `public.update_campaign` y conserva su firma, SECURITY DEFINER, search_path, ACLs, ownership, estados terminales, constraints y structural locks. Las migraciones anteriores no se editan.

Al final de la función, después de UPDATE de campaña y del bloque de países existente, y antes de RETURN, cuando `p_target_testers IS NOT NULL`:

```sql
perform public._evaluate_campaign_completion(p_campaign_id);
select * into v_campaign from public.test_campaigns where id = p_campaign_id;
```

La recarga hace que el retorno incluya el nuevo status/ completed_at, evitando devolver la fila de UPDATE RETURNING anterior al helper. Un target enviado con su mismo valor también reevalúa; una edición sin parámetro target mantiene su comportamiento previo.

El helper reutilizado vive en `20261003221616_campaign_lifecycle.sql:8`. Solo completa testing, sin waiting_access/access_enabled/active, con completed_count >= target. Actualiza status y completed_at mediante la lógica existente; no crea eventos de campaña y esta migration no inventa ninguno. Se conserva el evento de participación cuando complete_participation completa un tester.

No se cambia UI, elegibilidad de país, rate limits, duración, dependencias, definición de covered ni otra RPC. El código de países ya presente en update_campaign se conserva textualmente, no se modifica en este incremento.

## Casos A–G

Estos son resultados esperados de la revisión estática y las assertions SQL añadidas, **no resultados ejecutados en PostgreSQL**.

| Caso | Operación | Resultado esperado |
| --- | --- | --- |
| A | testing, target10, completed5, open0 → target5 | completed, completed_at no nulo; retorno RPC coincide con fila almacenada |
| B | Mismo estado → target6 | testing, completed_at nulo |
| C | testing, target10, completed5, open1 → target5 | TARGET_BELOW_COVERED_TESTERS; no cambios, sigue testing con target10 |
| C válido | Mismo estado → target6 | testing con target6; el helper no completa con abiertos |
| D | recruiting, completed5, open0 → target5 | recruiting, no completion |
| E | completed → cualquier target | INVALID_CAMPAIGN_STATE; sin mutación ni reapertura |
| F | cancelled → target5 | INVALID_CAMPAIGN_STATE; no pasa a completed |
| G | testing, target5, completed5 → target10 | testing, no completion |

También se prueban draft, edición sin target, ownership/auth, ausencia de evento inventado, completion del último tester y cancelación seguida de reducción del target.

C necesita precisión respecto a la solicitud: covered cuenta completed y abiertos. Por ello completed5+open1 implica covered6 y no puede reducirse a5 sin relajar la regla, prohibido en este ticket. La prueba exige el error existente y añade target6 como reducción válida con abiertos.

## Locks y concurrencia

update_campaign adquiere FOR UPDATE sobre campaña antes de contar y mutar. Ese lock permanece hasta commit/rollback. El helper vuelve a bloquear la misma fila en la misma transacción; no hay lock nuevo de participación ni orden inverso. complete_participation mantiene campaña → participación y no fue modificada. Otro update/join/complete/cancel_campaign de la misma campaña espera el lock de campaña, por lo que target, completion y fila retornada quedan en una transacción.

cancel_participation actualmente bloquea solo participación y lee campaña sin bloquearla; no invoca el helper. Se conserva ese comportamiento. Cancelar disminuye abiertos y covered, sin aumentar completed. Con el invariante covered <= target no existe un estado válido que tenga completed >= target y además una participación abierta; la cancelación sola no puede alcanzar el target. El test usa completed5+open1,target6: cancelar deja testing con completed5,target6; reducir después a5 completa.

Una cancelación concurrente puede hacer que el count de covered sea conservador y rechace una reducción que sería válida después de su commit; no relaja el mínimo ni causa una completion incorrecta. Nuevos abiertos y aumentos de completed pasan por RPCs que bloquean campaña, evitando cambios entre evaluación y cierre. Si hubiera datos que violen el invariante por escrituras privilegiadas, no se certifica el autocierre por cancelación; requeriría otro alcance.

No se encontró ciclo de locks introducido por el cambio. No se ejecutaron carreras reales: no hay harness SQL concurrente existente ni base local disponible. Plan para dos sesiones locales, aislamiento habitual READ COMMITTED:

1. Campaña testing, completed4+active1, target10. Owner actualiza target5 y deja BEGIN abierto; tester complete debe esperar. Tras commit del owner, tester completa y el helper cierra con target5.
2. Orden inverso: tester completa y retiene la transacción; owner update espera, después lee completed5 y completa al reducir a5.
3. Dos updates sobre la misma campaña se serializan; si el primero completa, el segundo rechaza INVALID_CAMPAIGN_STATE.
4. Cancelar active mientras owner reduce a su piso: confirmar cancelación sin contarla como completed y que ningún target cae por debajo del covered observado. Reintentar la reducción menor después del commit de cancelación.

## Pruebas y limitaciones

`tests/target-completion.test.cjs`: tres checks estáticos ejecutables con Node. Comprueban que quitar el bloque nuevo produce exactamente la función anterior y las mismas ACLs, que la llamada ocurre bajo el lock al final de las mutaciones, que el retorno se recarga y que la lógica sigue centralizada. No simulan ni sustituyen ejecución PostgreSQL.

`supabase/tests/target_reduction_completion.sql`: fixtures locales con roles/JWT, RPCs reales y assertions de estado/fecha/retorno/error; transacción termina con ROLLBACK. Ejecutar solo en base local descartable después de aplicar todas las migraciones. Incluye el evento de la completion existente y un actor ajeno/no autenticado.

Docker local no está disponible (pipe docker_engine ausente); no se hizo db reset, no se ejecutó el SQL ni se aplicó la migration. Sin remoto ni commit. Para una base local descartable disponible:

```powershell
npx.cmd supabase db reset --local
psql LOCAL_CONNECTION -v ON_ERROR_STOP=1 -f supabase/tests/country_eligibility.sql
psql LOCAL_CONNECTION -v ON_ERROR_STOP=1 -f supabase/tests/target_reduction_completion.sql
```

Validaciones locales: lint, TypeScript sin emit, build, git diff --check y nueve tests Node (tres nuevos + seis existentes). La validación SQL/concurrente permanece pendiente.

## Diff resumido

Cuatro archivos nuevos: una migration con la definición vigente de update_campaign más un bloque de reevaluación/recarga de 11 líneas; una prueba SQL; tres pruebas estáticas Node; este documento. Ningún archivo existente modificado. Helper y flujos de participación anteriores intactos.
