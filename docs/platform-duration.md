# Duración de participación por plataforma

`duration_days` es el tiempo esperado de participación de un tester desde que confirma instalación. No es la duración total de una campaña, track o build. La fecha final sigue calculándose con la lógica existente de instalación.

## Decisiones

- Android: selector de 7, 14, 21, 30, 45, 60 y 90 días, más Personalizado. Personalizado exige entero positivo. No se añade un máximo funcional/producto: no hay política actual que justifique uno. Se conserva el límite representable del tipo PostgreSQL integer (2147483647), que ya existía; no es una regla de Google Play ni garantiza fechas calculables para todos los extremos.
- 14 días no es una regla global Android ni un máximo. La ayuda ES/EN dice que es un requisito habitual para ciertas cuentas personales nuevas. La validación no exige 14 días ni cambia el target de testers.
- iOS: selector con los mismos presets, sin Personalizado; backend acepta enteros de 1 a 90. El límite del producto deriva de la expiración de builds TestFlight a los 90 días. Un build ya publicado puede tener menos tiempo restante: no se garantiza que haya 90 días disponibles desde la instalación.
- Cualquier máximo Android de producto futuro sería una restricción interna de Tester Hub, no una política de Google Play. El hardening posterior [duration-overflow.md](duration-overflow.md) protege los valores técnicamente no representables con un helper central y `DURATION_OUT_OF_RANGE`; no añade un máximo de días de producto.

## UI y compatibilidad

`CampaignDuration` reemplaza únicamente el control de duración en crear/editar campaña y conserva la posición dentro del layout. Comparte presets/parser con `src/lib/campaign-duration.ts` y textos ES/EN con el i18n existente.

Una duración Android no estándar se carga como Personalizado con su valor. Cambiar Android >90 a iOS mantiene el valor visible como opción inválida, muestra error y exige seleccionar un valor válido; no trunca ni convierte a 90. La server action vuelve a validar la plataforma y duración, incluso en POST directo.

Una duración iOS existente válida no estándar (por ejemplo 10) se muestra como opción actual adicional para no alterar datos válidos. No se habilita edición libre iOS. Un legacy iOS >90 se muestra como inválido; si no hay participaciones debe corregirse antes de guardar. Si hay participaciones, permanece disabled con aviso: no se habilita una vía para modificar duración. Ediciones permitidas de otros campos conservan esa duración legacy bloqueada. Campañas terminales/archivadas mantienen sus controles deshabilitados.

## Backend/migration

Nueva migration: `supabase/migrations/20261009140000_platform_duration.sql`. Aplicada **solo a Supabase local** con `supabase migration up --local`, sin reset y sin editar migraciones históricas.

- create_campaign rechaza iOS >90 con `IOS_DURATION_EXCEEDED`; conserva auth, ownership, duración positiva y todas las comprobaciones anteriores.
- update_campaign usa la plataforma/duración efectivas, incluso si alguno de los parámetros es NULL. Rechaza iOS >90 en campañas editables sin participaciones. La validación ocurre después del bloque de structural locks para preservar su precedencia. Un valor legacy bloqueado sin cambios sigue permitido para ediciones de campos no estructurales.
- Trigger `validate_campaign_ios_duration` (SECURITY INVOKER, search_path vacío) impide INSERT y cambios de platform/duration_days que introducirían iOS >90, incluso en escrituras privilegiadas. La constraint positiva y el tipo integer existentes siguen aplicándose. El trigger no afecta actualizaciones de estado/target ni cambios que dejan intacta una duración legacy.
- Se usa trigger dirigido a los campos en vez de un CHECK general nuevo: un CHECK NOT VALID también rechazaría cualquier UPDATE de una fila legacy inválida y podría bloquear cancelaciones o ediciones permitidas de campañas cuya duración ya no es editable.
- CREATE OR REPLACE conserva firmas/ACLs de RPCs. La llamada de autocierre de target, countries y las demás reglas anteriores están intactas. No se modificaron permisos existentes, installation flow, target o rate limits.

La inspección previa local mostró las migraciones anteriores aplicadas y ninguna fila en test_campaigns. Por tanto no hubo datos de campañas locales que convertir. No se consultaron datos remotos. Los tests simulan legacy dentro de transacciones descartables; ninguna duración real fue alterada automáticamente.

## Pruebas

- `node --test tests/*.test.cjs`: 12 PASS (9 existentes + 3 de duración). Presets por plataforma; custom Android 120/0; iOS90/91; cambio de plataforma inválido; legacy Android custom e iOS no estándar; inputs malformados; preservación exacta de cuerpos SQL anteriores al retirar únicamente los guards nuevos.
- `node tests/country-ui-browser.cjs`: PASS de suite existente en Edge local aislado.
- `node tests/duration-browser.cjs`: PASS en Edge local aislado: edición Android120 se presenta como Custom, envío120, custom0 inválido, Android120→iOS mantiene120 visible/invalid y necesita selección explícita90, iOS sin Custom. El fixture no consulta Supabase ni es un E2E autenticado completo.
- SQL reales, con ON_ERROR_STOP y ROLLBACK: `country_eligibility.sql`, `target_reduction_completion.sql` y `platform_duration.sql`, **los tres PASS** en supabase_db_tester-hub.
- La suite SQL nueva cubre Android1, iOS90, create/update iOS91, cambio de plataforma Android120→iOS rechazado, Android0, locks estructurales, legacy bloqueado/no bloqueado, corrección explícita a90 y escritura directa inválida. El trigger se retira/restaura solo dentro del fixture para simular datos previos; todo el fixture termina con rollback.
- Validaciones técnicas: `npm.cmd run lint`, `npx.cmd tsc --noEmit`, `npm.cmd run build` y `git diff --check`.

Los casos A–H de frontend e I–M de backend quedan cubiertos por estas suites; hay persistencia real de RPCs en fixtures transaccionales, pero no una sesión UI autenticada end-to-end. No hay máximo Android de producto nuevo; el hardening posterior controla los errores de overflow y de representación de fecha.

## Archivos

Modificados: `src/app/(workspace)/campaigns/campaign-form.tsx`, `src/lib/campaign-input.ts`, `src/lib/i18n.tsx`.

Nuevos: `src/components/campaign-duration.tsx`, `src/lib/campaign-duration.ts`, migration, `supabase/tests/platform_duration.sql`, `tests/duration.test.cjs`, `tests/duration-browser.cjs` y este documento.

Sin actualización de dependencias, remoto ni commit.
