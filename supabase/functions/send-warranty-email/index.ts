// Edge Function: send-warranty-email
// Envía correos vía Brevo (https://api.brevo.com).
// Tipos:
//   'registro'      -> al cliente, código de seguimiento (requiere tracking_code)
//   'actualizacion' -> al cliente, cambio de estado + nota (requiere tracking_code)
//   'rma'           -> interno, solicitud de RMA al fabricante (requiere rma_code), incluye tabla en el cuerpo y adjunto .xlsx
// Configuración (secret de Edge Function o secreto en Vault):
//   BREVO_API_KEY (requerido), FROM_EMAIL (ej: "Ciclismo y Más <hola@tudominio.com>"),
//   STATUS_URL (link a la página de consulta de estado), RMA_NOTIFY_EMAIL (destino de correos de RMA)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

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
    const { tracking_code, type, note, rma_code } = await req.json();
    if (!["registro", "actualizacion", "rma"].includes(type)) {
      return json({ error: "Parámetros inválidos" }, 400);
    }
    if (type !== "rma" && !tracking_code) return json({ error: "Falta tracking_code" }, 400);
    if (type === "rma" && !rma_code) return json({ error: "Falta rma_code" }, 400);

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Config: primero variables de entorno, si no, Vault
    const getConf = async (name: string): Promise<string | null> => {
      const v = Deno.env.get(name);
      if (v) return v;
      const { data } = await db.rpc("get_secret", { p_name: name });
      return data ?? null;
    };

    const BREVO_API_KEY = await getConf("BREVO_API_KEY");
    if (!BREVO_API_KEY) return json({ error: "BREVO_API_KEY no configurada" }, 500);
    const fromRaw = (await getConf("FROM_EMAIL")) ?? "Ciclismo y Más <hola@athletetrainlab.com>";
    const STATUS_URL = (await getConf("STATUS_URL")) ?? "";
    const mm = fromRaw.match(/^(.*)<(.+)>$/);
    const sender = mm
      ? { name: mm[1].trim(), email: mm[2].trim() }
      : { name: "Ciclismo y Más", email: fromRaw.trim() };

    // ---------- Correo interno: solicitud de RMA ----------
    if (type === "rma") {
      const { data: rma, error: rmaErr } = await db
        .from("rma_requests")
        .select("id, rma_code, created_at")
        .eq("rma_code", String(rma_code).trim().toUpperCase())
        .single();
      if (rmaErr || !rma) return json({ error: "RMA no encontrado" }, 404);

      const { data: items, error: itemsErr } = await db
        .from("warranties")
        .select("tracking_code, full_name, brand, model, code_1, code_2")
        .eq("rma_id", rma.id)
        .order("created_at", { ascending: true });
      if (itemsErr) return json({ error: itemsErr.message }, 500);
      if (!items?.length) return json({ error: "El RMA no tiene garantías asociadas" }, 400);

      const rows = items.map((w) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0">${w.tracking_code}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0">${w.full_name}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0">${w.brand} ${w.model}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0">${w.code_1 ?? ""}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0">${w.code_2 ?? ""}</td>
        </tr>`).join("");

      const html = `
        <div style="font-family:Segoe UI,system-ui,sans-serif;max-width:680px;margin:0 auto;color:#0f172a">
          <div style="background:#334155;color:#fff;padding:18px;text-align:center;border-radius:10px 10px 0 0">
            <h2 style="margin:0">🚴 Ciclismo y Más — Solicitud de RMA</h2>
          </div>
          <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 10px 10px">
            <p>Se generó el RMA <strong>${rma.rma_code}</strong> con ${items.length} garantía(s) para enviar al fabricante.</p>
            <table style="width:100%;border-collapse:collapse;margin-top:14px;font-size:14px">
              <thead>
                <tr style="background:#f8fafc">
                  <th style="text-align:left;padding:8px;border-bottom:2px solid #e2e8f0">Código</th>
                  <th style="text-align:left;padding:8px;border-bottom:2px solid #e2e8f0">Nombre</th>
                  <th style="text-align:left;padding:8px;border-bottom:2px solid #e2e8f0">Equipo</th>
                  <th style="text-align:left;padding:8px;border-bottom:2px solid #e2e8f0">Código 1</th>
                  <th style="text-align:left;padding:8px;border-bottom:2px solid #e2e8f0">Código 2</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
            <p style="font-size:12px;color:#64748b">Correo automático del sistema de garantías de Ciclismo y Más.</p>
          </div>
        </div>`;

      // Generar el archivo XLS adjunto con las mismas columnas de la tabla
      const sheetData = [
        ["Código", "Nombre", "Equipo", "Código 1", "Código 2"],
        ...items.map((w) => [w.tracking_code, w.full_name, `${w.brand} ${w.model}`, w.code_1 ?? "", w.code_2 ?? ""]),
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      worksheet["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 22 }, { wch: 14 }, { wch: 14 }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "RMA");
      const xlsBase64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });

      const notifyEmail = (await getConf("RMA_NOTIFY_EMAIL")) ?? "camachogabriel@gmail.com";
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json", "api-key": BREVO_API_KEY },
        body: JSON.stringify({
          sender,
          to: [{ email: notifyEmail }],
          subject: `Solicitud de RMA ${rma.rma_code} — ${items.length} garantía(s)`,
          htmlContent: html,
          attachment: [{ content: xlsBase64, name: `${rma.rma_code}.xlsx` }],
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        return json({ error: "Brevo rechazó el envío", detail }, 502);
      }
      return json({ ok: true });
    }

    // ---------- Correos al cliente: registro / actualización ----------
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

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json", "api-key": BREVO_API_KEY },
      body: JSON.stringify({ sender, to: [{ email: w.email, name: w.full_name }], subject, htmlContent: html }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return json({ error: "Brevo rechazó el envío", detail }, 502);
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
