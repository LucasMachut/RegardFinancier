# Trois étapes, environ 5 minutes

## 1. Le projet Supabase

1. Ouvre https://supabase.com/dashboard/org/jshlqceljygtwyumebcx (organisation **finances**)
2. **New project**
   - Name : `regard-financier`
   - Database password : clique sur **Generate a password** et **enregistre-la dans ton
     gestionnaire de mots de passe**. Elle ne sert pas à l'application, mais elle est
     irrécupérable ensuite (seulement réinitialisable).
   - Region : **South America (São Paulo)**, c'est le plus proche de Rio
   - Plan : Free
3. Attends la fin de la création (environ deux minutes)
4. **SQL Editor** → **New query** → colle tout `supabase/01_schema.sql` → **Run**

Tu dois voir `Success. No rows returned`.

### Le choix que tu m'avais demandé

Tu avais répondu « table ouverte, sans login ». Je ne l'ai pas appliqué par défaut,
et je te dois l'explication plutôt que de le faire en silence.

Pour GitHub Pages gratuit le dépôt doit être **public**. L'URL du projet et la clé
anon sont donc lisibles par tout le monde dans `js/config.js`. Avec une table
ouverte, ça veut dire que ton salaire visé, tes dépenses fixes, le nom de tes
clients et tes montants facturés sont lisibles **et modifiables** par n'importe qui
tombant sur le dépôt. Des robots scannent les dépôts publics à la recherche de
clés Supabase et testent les tables ouvertes. Ce n'est pas un risque théorique.

`01_schema.sql` protège donc les données, avec une connexion par lien e-mail, une
seule fois : la session reste ouverte ensuite sur l'appareil, tu ne revois plus
l'écran. En pratique tu as le confort que tu cherchais.

Si tu veux quand même la table ouverte, c'est ton fichier et ta décision : exécute
`supabase/02_variante_table_ouverte.sql` après le premier. L'application le détecte
seule et passe en mode sans connexion, avec un indicateur orange « partagé ».
Réexécuter `01_schema.sql` remet la protection.

## 2. Les clés dans l'application

Dans Supabase : **Project Settings → API**. Copie **Project URL** et la clé
**anon public** (surtout pas `service_role`, elle contourne toutes les
protections), et remplace les deux `__A_REMPLIR__` dans `js/config.js`.

## 3. Le dépôt

```bash
cd RegardFinancier
git init -b main
git add -A
git commit -m "Regard financier — calculateur de prix et tableau de bord"
git remote add origin https://github.com/LucasMachut/RegardFinancier.git
git push -u origin main
```

Le dépôt m'a renvoyé une 404 en anonyme : soit il est privé, soit il n'existe pas
encore. S'il n'existe pas, crée-le sur GitHub **sans README ni .gitignore** (le
dépôt en contient déjà), et **public** pour Pages gratuit.

Puis sur GitHub : **Settings → Pages → Source : GitHub Actions**.

Le site sort sur `https://lucasmachut.github.io/RegardFinancier/`.

## Récupérer tes données actuelles

Avant de passer au site en ligne : ouvre ton fichier local, onglet **Paramètres**,
bouton **Exporter le JSON**, et garde-le. Sur le site en ligne, colle-le dans le
même champ et clique **Importer**. Le stockage du navigateur ne suit pas d'une
adresse à l'autre, c'est le seul moyen de transporter tes deux missions.
