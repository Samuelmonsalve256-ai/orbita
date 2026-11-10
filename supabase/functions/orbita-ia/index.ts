// Órbita · función orbita-ia (Supabase Edge Function)
//
// Puente entre la app y Claude. La clave de Anthropic vive SOLO aquí, como
// secreto de Supabase (ANTHROPIC_API_KEY); nunca llega al navegador.
// Solo responde a usuarios con sesión iniciada en tu proyecto (Supabase
// verifica el token antes de ejecutar esta función).
//
// La app envía { system?, messages, tools? } y recibe { content, stop_reason }.
// El ciclo de herramientas (crear citas, buscar huecos, etc.) lo ejecuta la app.

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-opus-5-5";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "Falta ANTHROPIC_API_KEY", code: "no_key" }, 500);

  // Confirma quién llama. Si ORBITA_CORREOS está definido (correos separados por coma),
  // solo esas cuentas pueden gastar tu saldo de IA.
  const auth = req.headers.get("Authorization") ?? "";
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return json({ error: "Sesión no válida" }, 401);
  const permitidos = (Deno.env.get("ORBITA_CORREOS") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (permitidos.length && !permitidos.includes((user.email ?? "").toLowerCase())) {
    return json({ error: "Cuenta no autorizada" }, 403);
  }

  // deno-lint-ignore no-explicit-any
  let body: { system?: string; messages?: any[]; tools?: any[] };
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  if (!Array.isArray(body.messages) || !body.messages.length) return json({ error: "Faltan mensajes" }, 400);
  if (JSON.stringify(body).length > 400_000) return json({ error: "Solicitud demasiado grande" }, 413);

  const client = new Anthropic({ apiKey });
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      ...(body.system ? { system: body.system } : {}),
      ...(body.tools?.length ? { tools: body.tools } : {}),
      messages: body.messages,
    });
    return json({ content: res.content, stop_reason: res.stop_reason });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "Límite de uso alcanzado", code: "rate_limited" }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "Clave de Anthropic inválida", code: "no_key" }, 500);
    if (e instanceof Anthropic.APIError) return json({ error: e.message, code: "api_error" }, 502);
    return json({ error: String(e), code: "error" }, 500);
  }
});
