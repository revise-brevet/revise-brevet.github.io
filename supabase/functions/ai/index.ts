// BREVET MASTER — relais IA sécurisé (Supabase Edge Function)
// Garde la clé Anthropic secrète côté serveur. Le site public n'y a jamais accès.
// Déploiement : Supabase → Edge Functions → "ai" → coller ce code → Deploy
// Secret requis : ANTHROPIC_API_KEY (Edge Functions → Secrets)

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
// Modèle : Haiku 4.5 = rapide + économique (idéal pour une aide aux révisions sur un site public).
// Pour une qualité maximale, remplace par "claude-opus-4-8" (plus cher).
const MODEL = "claude-haiku-4-5";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM = `Tu es Zo, le coach pédagogique de l'app BREVET MASTER.
Tu aides des élèves français de collège (5e, 4e, 3e) à réviser le Diplôme National du Brevet.
Règles :
- Réponds TOUJOURS en français, de façon simple, claire et encourageante, au niveau d'un collégien.
- Sois concis (pas de pavés). Utilise des exemples concrets et des étapes numérotées quand c'est utile.
- Reste strictement sur les matières scolaires du brevet. Si on te demande autre chose, ramène gentiment vers les révisions.
- N'invente pas de fausses informations. Si tu n'es pas sûr, dis-le.`;

function modeInstruction(mode: string): string {
  if (mode === "exos")
    return "Génère 3 exercices courts adaptés au brevet sur le sujet demandé. Numérote-les. À la fin, ajoute une section 'Réponses :' avec les corrigés.";
  if (mode === "explain")
    return "Explique simplement et brièvement la bonne réponse à cet élève qui vient de se tromper. Donne le raisonnement en 2-3 phrases max + une astuce pour retenir.";
  if (mode === "lecon")
    return "Explique cette notion comme une mini-leçon : définition simple, 1 exemple, et 1 astuce pour la retenir.";
  return "Réponds à la question de l'élève de façon pédagogique et concise.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "method" }), { status: 405, headers: { ...cors, "content-type": "application/json" } });

  try {
    if (!ANTHROPIC_KEY)
      return new Response(JSON.stringify({ error: "Clé IA non configurée (ANTHROPIC_API_KEY manquante)." }), { status: 500, headers: { ...cors, "content-type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode || "ask");
    let prompt = String(body.prompt || "").slice(0, 2000); // borne anti-abus
    if (!prompt) return new Response(JSON.stringify({ error: "prompt vide" }), { status: 400, headers: { ...cors, "content-type": "application/json" } });

    const userMsg = modeInstruction(mode) + "\n\n" + prompt;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 900,
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    const data = await r.json();
    if (!r.ok)
      return new Response(JSON.stringify({ error: data?.error?.message || "Erreur IA" }), { status: 502, headers: { ...cors, "content-type": "application/json" } });

    const text = (data.content || [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();

    return new Response(JSON.stringify({ text }), { headers: { ...cors, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "content-type": "application/json" } });
  }
});
