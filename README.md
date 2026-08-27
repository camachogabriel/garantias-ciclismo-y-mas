# Sistema de Garantías — Ciclismo y Más

Seguimiento de garantías de medidores de potencia (Favero, Sigeyi, XOSS, 4iiii).

## Páginas

| Archivo | Uso | Quién |
|---|---|---|
| `index.html` | Formulario de registro de garantía | Cliente (link público) |
| `estado.html` | Consulta de estado por código | Cliente |
| `admin.html` | Panel de gestión (estados, notas, cobros, códigos de bielas/ANT+, fotos, RMAs, correos) | Equipo (login fijo) |
| `alllink.html` | Accesos rápidos a todo lo anterior + dashboards | Referencia interna |

## Flujo

1. El cliente recibe el link de `index.html` y registra su garantía (datos + hasta 6 fotos).
2. El sistema genera un código `GC-XXXXXX` y se lo envía por correo.
3. El cliente consulta el estado en `estado.html` con su código (solo ve estado, no datos personales).
4. El equipo gestiona todo desde `admin.html`: cambia estados, agrega notas, cobros, códigos de bielas (código + ANT+) y fotos, y envía correos de actualización al cliente.
5. Cuando una o varias garantías están listas para mandarse al fabricante, el equipo las selecciona en la lista y pulsa **Generar RMA**: se genera un código `RMA-XXXXXX`, todas las garantías seleccionadas pasan a estado **Enviada**, y se envía un correo a `camachogabriel@gmail.com` con la tabla (Código, Nombre, Equipo, Código 1, Código 2) para hacer el request al fabricante.
6. En la pestaña **RMAs** del panel se edita el tracking de envío/retorno y sus fechas, y se puede eliminar un RMA (desvincula las garantías sin cambiar su estado).

## Infraestructura (Supabase)

⚠️ **Este proyecto de Supabase es compartido** con otros sistemas del negocio (`fichas_*`, `topstone_*`, etc.). No es un proyecto aislado. Por eso el panel de garantías usa un **login fijo dedicado** en vez de depender de cualquier usuario autenticado del proyecto — ver sección de seguridad abajo.

- **Proyecto:** `Garantias Ciclismo y Mas` (`cejgurbaweucfpuzvdpw`)
- **URL:** https://cejgurbaweucfpuzvdpw.supabase.co
- **Tablas propias:** `warranties`, `warranty_status_history`, `rma_requests` (todas con RLS)
- **Storage:** bucket `warranty-photos` (máx. 10 MB por foto)
- **Edge Function:** `send-warranty-email` (correos vía Brevo; tipos `registro`, `actualizacion`, `rma`)
- Migraciones en `supabase/migrations/` (ya aplicadas al proyecto).

### Seguridad: acceso restringido a un solo correo

Como el proyecto es compartido, las políticas RLS de `warranties`, `warranty_status_history`, `rma_requests` y del bucket `warranty-photos` **no** dan acceso a "cualquier usuario autenticado" — solo al correo `garantias@athletetrainlab.com`. Así, usuarios de otros sistemas que vivan en este mismo proyecto no pueden ver ni tocar datos de garantías aunque inicien sesión.

**Login del panel admin:**
- Correo: `garantias@athletetrainlab.com`
- Contraseña: `Garantias4iiii$$`

Si se agregan más personas al equipo, hay que: crear su usuario en Authentication → Users, y añadir su correo a las políticas RLS (`auth.jwt() ->> 'email' = ...`) o mejor migrar a una tabla de admins permitidos.

## Configuración pendiente

### 1. Correos (Brevo)
Se usa la misma cuenta de Brevo del proyecto AthleteTrainLab. La configuración se lee primero de los secrets de la Edge Function y, si no existen, del Vault de Supabase:
- `BREVO_API_KEY` — API key de Brevo (requerido)
- `FROM_EMAIL` — remitente; default: `Ciclismo y Más <hola@athletetrainlab.com>` (recomendado: `garantias@athletetrainlab.com`, ya verificado en Brevo)
- `STATUS_URL` — URL pública de `estado.html` (para el botón del correo)
- `RMA_NOTIFY_EMAIL` — a quién llega el correo de solicitud de RMA; default: `camachogabriel@gmail.com`

Para configurar: dashboard → **Edge Functions → send-warranty-email → Secrets**, o guardar los valores en **Vault** con esos mismos nombres.

### 2. Publicar las páginas
Es un sitio estático: publicado con GitHub Pages desde este repo (branch `main`, root). No requiere build.

## Estados

`en_revision` → `aprobada` → `enviada` (automático al generar RMA) → `recibida` → `lista_para_entrega` | `rechazada`

Cada cambio de estado queda en `warranty_status_history` (con marca de si se notificó por correo 📧).
