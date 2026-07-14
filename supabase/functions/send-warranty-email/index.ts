// Edge Function: send-warranty-email
// Envía correos al cliente vía Resend.
// Tipos: 'registro' (código de seguimiento) | 'actualizacion' (cambio de estado + nota)
// Secrets requeridos: RESEND_API_KEY, FROM_EMAIL (ej: "Ciclismo y Más <garantias@tudominio.com>")
// Opcional: STATUS_URL (link a la página de consulta de estado)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ESTADOS: Record<string, string> = {
  en_revision: "En revisión",
  aprobada: "Aprobada",
  enviada: "Enviada",
  recibida: "Recibida",
  lista_para_entrega: "Lista para entrega",
  rechazada: "Rechazada",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const { tracking_code, type, note } = await req.json();
    if (!tracking_code || !["registro", "actualizacion"].includes(type)) {
      return json({ error: "Parámetros inválidos" }, 400);
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Ciclismo y Más <onboarding@resend.dev>";
    const STATUS_URL = Deno.env.get("STATUS_URL") ?? "";
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY no configurada" }, 500);

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: w, error } = await db
      .from("warranties")
      .select("id, tracking_code, full_name, email, brand, model, status")
      .eq("tracking_code", String(tracking_code).trim().toUpperCase())
      .single();
    if (error || !w) return json({ error: "Garantía no encontrada" }, 404);

    const estado = ESTADOS[w.status] ?? w.status;
    const statusLink = STATUS_URL
      ? `<p style="margin:24px 0"><a href="${STATUS_URL}" style="background:#0f766e;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Consultar estado</a></p>`
      : "";

    let subject: string;
    let body: string;
    if (type === "registro") {
      subject = `Garantía registrada — Código ${w.tracking_code}`;
      body = `
        <p>Hola <strong>${w.full_name}</strong>,</p>
        <p>Recibimos tu solicitud de garantía para tu <strong>${w.brand} ${w.model}</strong>.</p>
        <p>Tu código de seguimiento es:</p>
        <p style="font-size:26px;font-weight:800;letter-spacing:2px;background:#f0fdfa;border:2px dashed #0f766e;border-radius:10px;padding:14px;text-align:center">${w.tracking_code}</p>
        <p>Con este código puedes consultar el estado de tu garantía en cualquier momento.</p>
        ${statusLink}`;
    } else {
      subject = `Actualización de tu garantía ${w.tracking_code} — ${estado}`;
      body = `
        <p>Hola <strong>${w.full_name}</strong>,</p>
        <p>Tu garantía <strong>${w.tracking_code}</strong> (${w.brand} ${w.model}) tiene una actualización:</p>
        <p style="font-size:20px;font-weight:700;color:#0f766e">Estado: ${estado}</p>
        ${note ? `<p style="background:#f8fafc;border-left:4px solid #0f766e;padding:10px 14px;border-radius:4px">${note}</p>` : ""}
        ${statusLink}`;
    }

    const html = `
      <div style="font-family:Segoe UI,system-ui,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
        <div style="background:#0f766e;color:#fff;padding:18px;text-align:center;border-radius:10px 10px 0 0">
          <h2 style="margin:0">🚴 Ciclismo y Más</h2>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 10px 10px">
          ${body}
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
          <p style="font-size:12px;color:#64748b">Este es un correo automático del sistema de garantías de Ciclismo y Más.</p>
        </div>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: [w.email], subject, html }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return json({ error: "Resend rechazó el envío", detail }, 502);
    }

    // Marcar el último cambio de estado como notificado
    if (type === "actualizacion") {
      const { data: last } = await db
        .from("warranty_status_history")
        .select("id")
        .eq("warranty_id", w.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (last?.length) {
        await db.from("warranty_status_history")
          .update({ email_sent: true, note: note ?? null })
          .eq("id", last[0].id);
      }
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
