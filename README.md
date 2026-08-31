# Regard financier

Calculateur de prix et tableau de bord pour lucasmachut.visuals.

Il part d'un salaire mensuel visé, en déduit une heure de travail, ajoute une
marge figée, puis chiffre chaque prestation à partir du temps qu'elle prend
réellement. Le tableau de bord suit ce qui est proposé, facturé et encaissé.

## Le calcul

```
heure de ton temps = salaire mensuel visé ÷ (jours facturables × 4 × heures par jour)
heure vendue       = heure de ton temps ÷ (1 − marge)
prix               = coûts directs + (heures × heure vendue) × multiplicateur de prazo
```

Le contrôle du plancher porte sur `(prix − coûts directs) ÷ heures`. Les coûts
directs sont avancés puis remboursés : ils ne sont jamais de la rémunération, et
les inclure dans le contrôle laisserait passer des missions à perte.

Le champ « jours facturables par semaine » compte les jours vendus à un client,
pas les jours travaillés. Prospection, devis et administration sont couverts par
la marge, pas par les heures de la mission.

## Mise en route

1. Crée un projet Supabase, puis exécute `supabase/01_schema.sql` dans le SQL Editor.
2. Renseigne `js/config.js` avec l'URL du projet et la clé **anon**.
3. Pousse sur `main`. Le workflow publie sur GitHub Pages.

Sans `js/config.js` renseigné, l'application fonctionne entièrement en local :
tout est enregistré dans le navigateur et l'indicateur affiche « local ».

## Données

| Table | Contenu |
|---|---|
| `rf_config` | Un document par utilisateur : socle, niches, modules, extras, prazos |
| `rf_missions` | Une ligne par mission : date, client, niche, valeur, heures, statut |
| `rf_mois` | Vue d'agrégation par mois : facturé, encaissé, pipeline, heures |

La RLS restreint chaque ligne à son propriétaire. La clé anon est publiée dans
le code source, c'est prévu : elle ne donne accès à rien sans session valide.
La clé `service_role` contourne la RLS et ne doit jamais être versionnée ; le
workflow de déploiement échoue s'il en détecte une.

`supabase/02_variante_table_ouverte.sql` supprime cette protection et rend les
données lisibles et modifiables par toute personne connaissant l'URL. Le fichier
est fourni mais n'est pas appliqué.

## Synchronisation

`localStorage` sert de cache et permet de travailler hors ligne. Supabase est la
source de vérité dès qu'une session existe. Les changements sont regroupés et
poussés après 1,2 s d'inactivité, puis une dernière fois à la fermeture de
l'onglet. Si la base est injoignable, l'indicateur passe au rouge et le travail
continue en local sans rien perdre.
