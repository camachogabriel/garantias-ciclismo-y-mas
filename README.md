# Sistema de Garantías — Ciclismo y Más

Seguimiento de garantías de medidores de potencia (Favero, Sigeyi, XOSS, 4iiii).

## Páginas

| Archivo | Uso | Quién |
|---|---|---|
| `index.html` | Formulario de registro de garantía | Cliente (link público) |
| `estado.html` | Consulta de estado por código | Cliente |
| `admin.html` | Panel de gestión (estados, notas, cobros, códigos de bielas, fotos, correos) | Equipo (requiere login) |

## Flujo

1. El cliente recibe el link de `index.html` y registra su garantía (datos + foto).
2. El sistema genera un código `GC-XXXXXX` y se lo envía por correo.
3. El cliente consulta el estado en `estado.html` con su código (solo ve estado, no datos personales).
4. El equipo gestiona todo desde `admin.html`: cambia estados (en revisión → aprobada → enviada → recibida → lista para entrega / rechazada), agrega notas, cobros, códigos de bielas y dos fotos de ángulos, y envía correos de actualización.

## Infraestructura (Supabase)

- **Proyecto:** `Garantias Ciclismo y Mas` (`cejgurbaweucfpuzvdpw`)
- **URL:** https://cejgurbaweucfpuzvdpw.supabase.co
- **Tablas:** `warranties`, `warranty_status_history` (con RLS)
- **Storage:** bucket `warranty-photos` (máx. 10 MB por foto)
- **Edge Function:** `send-warranty-email` (correos vía Brevo)
- Migraciones en `supabase/migrations/` (ya aplicadas al proyecto).

## Configuración pendiente

### 1. Correos (Brevo)
Se usa la misma cuenta de Brevo del proyecto AthleteTrainLab. La configuración se lee primero de los secrets de la Edge Function y, si no existen, del Vault de Supabase:
- `BREVO_API_KEY` — API key de Brevo (requerido)
- `FROM_EMAIL` — remitente; default: `Ciclismo y Más <hola@athletetrainlab.com>`
- `STATUS_URL` — URL pública de `estado.html` (para el botón del correo)

Para configurar: dashboard → **Edge Functions → send-warranty-email → Secrets**, o guardar los valores en **Vault** con esos mismos nombres.

### 2. Usuario del panel admin
En Supabase: **Authentication → Users → Add user** — crea el correo/contraseña del equipo.
Desactiva el registro público en **Authentication → Sign In / Up → Disable new user signups**.

### 3. Publicar las páginas
Es un sitio estático: sube el repo a Vercel, Netlify, GitHub Pages o cualquier hosting. No requiere build.

## Estados

`en_revision` → `aprobada` → `enviada` → `recibida` → `lista_para_entrega` | `rechazada`

Cada cambio de estado queda en `warranty_status_history` (con marca de si se notificó por correo 📧).
