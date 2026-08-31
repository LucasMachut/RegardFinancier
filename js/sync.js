/* Regard financier — couche de synchronisation Supabase.
 *
 * Principe : le moteur de calcul n'est pas touché. localStorage reste le cache
 * local et permet de travailler hors ligne ; Supabase est la source de vérité
 * dès qu'une session existe. Ce fichier ne fait que trois choses :
 *   1. tirer les données au démarrage et les fusionner dans l'état de la page,
 *   2. pousser les changements, en les regroupant,
 *   3. afficher honnêtement l'état de la synchro.
 */
import { SUPABASE_URL, SUPABASE_ANON } from "./config.js";

const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const PRET = SUPABASE_URL && !SUPABASE_URL.startsWith("__");
const ANON_UID = "00000000-0000-0000-0000-000000000000";
let sb = null;

/* Import dynamique : si le CDN est injoignable, la page reste utilisable en
   local au lieu de perdre tout le module. */
async function client() {
  if (!PRET) return null;
  const { createClient } = await import(CDN);
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
}

let uid = null;          /* utilisateur courant, null tant qu'aucune session */
let ouvert = false;      /* true si la base tourne en mode table ouverte */
let tirageFait = false;
let idsConnus = new Set();

/* ------------------------------------------------------------- indicateur */
const badge = document.createElement("button");
badge.type = "button";
badge.style.cssText = "display:flex;align-items:center;gap:7px;padding:7px 13px;border-radius:999px;border:1px solid var(--line);background:var(--card-2);color:var(--tx-2);font:600 11.5px Inter,sans-serif;cursor:pointer";
function etat(txt, couleur, titre) {
  badge.innerHTML = '<span style="width:7px;height:7px;border-radius:50%;background:' + couleur + '"></span>' + txt;
  badge.title = titre || "";
}
function poserBadge() {
  const tr = document.querySelector(".topright");
  if (tr && badge.parentNode !== tr) tr.insertBefore(badge, tr.firstChild);
}
/* Les modules sont différés : DOMContentLoaded peut déjà être passé. */
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", poserBadge);
else poserBadge();

/* ------------------------------------------------------------------ outils */
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
function idMission(m) {
  if (!m.id) m.id = (crypto.randomUUID ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      }));
  return m.id;
}
function versLigne(m) {
  const d = String(m.d || "").slice(0, 10);
  return {
    id: idMission(m), user_id: uid,
    mission_date: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null,
    client: String(m.cli || ""), niche: String(m.niche || ""),
    valor: Number(m.valor) || 0, horas: Number(m.horas) || 0,
    status: ["proposto", "fechado", "pago"].includes(m.st) ? m.st : "proposto"
  };
}
const versMission = (r) => ({
  id: r.id, d: r.mission_date || "", cli: r.client || "", niche: r.niche || "",
  valor: Number(r.valor) || 0, horas: Number(r.horas) || 0, st: r.status || "proposto"
});

/* --------------------------------------------------------------- tirage */
async function tirer() {
  const [cfg, mis] = await Promise.all([
    sb.from("rf_config").select("data").eq("user_id", uid).maybeSingle(),
    sb.from("rf_missions").select("*").eq("user_id", uid).order("mission_date", { ascending: false })
  ]);
  if (cfg.error && cfg.error.code !== "PGRST116") throw cfg.error;
  if (mis.error) throw mis.error;

  const distant = cfg.data && cfg.data.data;
  /* Première utilisation : la base est vide, on y envoie ce qui est déjà local
     plutôt que d'écraser le travail existant par du vide. */
  if (!distant && !(mis.data || []).length) { tirageFait = true; await pousser(); return; }

  if (distant) window.S = window.merge(window.S, distant);
  window.S.missions = (mis.data || []).map(versMission);
  idsConnus = new Set(window.S.missions.map((m) => m.id));
  tirageFait = true;
  window.renderAll();
  if (!document.getElementById("page-dash").hidden) window.renderDash();
}

/* --------------------------------------------------------------- poussée */
let enCours = false, redemander = false, minuteur = null;
function planifier() {
  if (!sb || !uid || !tirageFait) return;
  clearTimeout(minuteur);
  minuteur = setTimeout(pousser, 1200);
}
async function pousser() {
  if (!sb || !uid) return;
  if (enCours) { redemander = true; return; }
  enCours = true;
  etat("synchro…", "var(--wa)");
  try {
    const S = window.S;
    const { missions, ui, ...reglages } = S;      /* l'onglet ouvert reste local */
    const courantes = (missions || []).map(versLigne);

    const r1 = await sb.from("rf_config").upsert(
      { user_id: uid, data: reglages }, { onConflict: "user_id" });
    if (r1.error) throw r1.error;

    if (courantes.length) {
      const r2 = await sb.from("rf_missions").upsert(courantes, { onConflict: "id" });
      if (r2.error) throw r2.error;
    }
    const vivantes = new Set(courantes.map((r) => r.id));
    const aSupprimer = [...idsConnus].filter((id) => !vivantes.has(id));
    if (aSupprimer.length) {
      const r3 = await sb.from("rf_missions").delete().in("id", aSupprimer).eq("user_id", uid);
      if (r3.error) throw r3.error;
    }
    idsConnus = vivantes;
    etat("à jour", "var(--ok)", "Dernière synchro : " + new Date().toLocaleTimeString("fr-FR"));
  } catch (e) {
    console.error("[sync]", e);
    etat("hors ligne", "var(--er)", (e && e.message ? e.message : "échec") + " — tes données restent enregistrées dans ce navigateur");
  } finally {
    enCours = false;
    if (redemander) { redemander = false; await attendre(300); pousser(); }
  }
}

/* ----------------------------------------------------- branchement au moteur */
function brancher() {
  const persistOrigine = window.persist;
  window.persist = function () { persistOrigine.apply(this, arguments); planifier(); };
  const saveOrigine = window.save;
  window.save = function () { saveOrigine.apply(this, arguments); planifier(); };
  window.addEventListener("beforeunload", () => {
    if (minuteur) { clearTimeout(minuteur); pousser(); }
  });
}

/* ------------------------------------------------------------ connexion */
function ecranConnexion() {
  const f = document.createElement("div");
  f.style.cssText = "position:fixed;inset:0;z-index:200;display:grid;place-items:center;background:var(--bg);padding:24px";
  f.innerHTML =
    '<div style="max-width:400px;width:100%;background:var(--card);border:1px solid var(--line);border-radius:18px;box-shadow:var(--sh);padding:28px">' +
    '<h2 style="margin:0 0 6px;font:600 20px \'Space Grotesk\',Inter,sans-serif">Regard financier</h2>' +
    '<p style="margin:0 0 18px;color:var(--tx-3);font-size:13.5px;line-height:1.5">Une seule fois. La session reste ouverte ensuite, tu ne reverras plus cet écran sur cet appareil.</p>' +
    '<input id="sb-mail" type="email" autocomplete="email" placeholder="ton@email.com" style="width:100%;padding:11px 13px;border-radius:12px;border:1px solid var(--line-2);background:var(--card-2);color:var(--tx);font:15px Inter,sans-serif;margin-bottom:10px">' +
    '<button id="sb-go" style="width:100%;padding:11px;border-radius:12px;border:0;background:var(--acc);color:#fff;font:600 14px Inter,sans-serif;cursor:pointer">Recevoir le lien de connexion</button>' +
    '<p id="sb-msg" style="margin:12px 0 0;font-size:12.5px;color:var(--tx-3);min-height:18px"></p></div>';
  document.body.appendChild(f);
  const mail = f.querySelector("#sb-mail"), go = f.querySelector("#sb-go"), msg = f.querySelector("#sb-msg");
  const envoyer = async () => {
    const v = (mail.value || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { msg.textContent = "Adresse incomplète."; return; }
    go.disabled = true; msg.textContent = "Envoi…";
    const { error } = await sb.auth.signInWithOtp({
      email: v, options: { emailRedirectTo: window.location.href.split("#")[0] } });
    go.disabled = false;
    msg.textContent = error ? "Échec : " + error.message
      : "Lien envoyé à " + v + ". Ouvre-le depuis cet appareil.";
  };
  go.addEventListener("click", envoyer);
  mail.addEventListener("keydown", (e) => { if (e.key === "Enter") envoyer(); });
  mail.focus();
  return f;
}

/* Détecte si la base tourne en mode table ouverte : dans ce cas on lit sans session. */
async function testeOuvert() {
  const { error } = await sb.from("rf_config").select("user_id").limit(1);
  return !error;
}

/* ------------------------------------------------------------- démarrage */
(async function () {
  if (!PRET) {
    etat("local", "var(--tx-3)", "Supabase n'est pas configuré — tout reste dans ce navigateur");
    badge.onclick = () => alert("Renseigne js/config.js avec l'URL et la clé anon de ton projet Supabase pour activer la synchro.");
    return;
  }
  try { sb = await client(); }
  catch (e) {
    console.error("[sync] chargement du client impossible", e);
    etat("local", "var(--er)", "Bibliothèque Supabase injoignable — tout reste dans ce navigateur");
    return;
  }
  brancher();
  etat("connexion…", "var(--wa)");

  const { data: { session } } = await sb.auth.getSession();
  if (session) uid = session.user.id;
  else if (await testeOuvert()) { ouvert = true; uid = ANON_UID; }

  if (!uid) {
    etat("connexion requise", "var(--wa)");
    const f = ecranConnexion();
    sb.auth.onAuthStateChange(async (_e, s) => {
      if (!s) return;
      uid = s.user.id; f.remove();
      try { await tirer(); } catch (e) { console.error(e); etat("hors ligne", "var(--er)", e.message); }
    });
    return;
  }
  badge.onclick = async () => {
    if (ouvert) return;
    if (confirm("Se déconnecter de cet appareil ?")) { await sb.auth.signOut(); location.reload(); }
  };
  try { await tirer(); etat(ouvert ? "partagé" : "à jour", ouvert ? "var(--wa)" : "var(--ok)",
        ouvert ? "Base en accès ouvert : toute personne ayant l'URL peut lire et écrire" : ""); }
  catch (e) { console.error(e); etat("hors ligne", "var(--er)", e.message + " — données locales conservées"); }
})();
