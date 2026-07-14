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
- **Edge Function:** `send-warranty-email` (correos vía Resend)
- Migraciones en `supabase/migrations/` (ya aplicadas al proyecto).

## Configuración pendiente

### 1. Correos (Resend)
1. Crea una cuenta en [resend.com](https://resend.com) y genera una API key.
2. En Supabase: **Edge Functions → send-warranty-email → Secrets**, agrega:
   - `RESEND_API_KEY` — tu API key
   - `FROM_EMAIL` — ej: `Ciclismo y Más <garantias@tudominio.com>` (dominio verificado en Resend; mientras tanto usa el default de pruebas)
   - `STATUS_URL` — URL pública de `estado.html` (para el botón del correo)

### 2. Usuario del panel admin
En Supabase: **Authentication → Users → Add user** — crea el correo/contraseña del equipo.
Desactiva el registro público en **Authentication → Sign In / Up → Disable new user signups**.

### 3. Publicar las páginas
Es un sitio estático: sube el repo a Vercel, Netlify, GitHub Pages o cualquier hosting. No requiere build.

## Estados

`en_revision` → `aprobada` → `enviada` → `recibida` → `lista_para_entrega` | `rechazada`

Cada cambio de estado queda en `warranty_status_history` (con marca de si se notificó por correo 📧).
