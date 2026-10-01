# SerenityWeb Security Lab

**Aïmane Ramzi · Administration réseau et cybersécurité**

Une démonstration locale et testable des contrôles de sécurité travaillés sur
[SerenityWeb](https://www.serenityweb.fr/). Ce dépôt explique des décisions
techniques ; il ne contient ni le backend commercial ni ses données.

## Ce que montre ce dépôt

- Un code temporaire haché avec HMAC, limité en tentatives et à usage unique.
- La séparation entre les usages « vérification email » et « récupération du mot de passe ».
- Une autorisation administrateur vérifiée contre l'état actuel du compte.
- Des montants calculés en centimes à partir d'une commande côté serveur.
- La validation et la déduplication d'un événement de paiement dans un modèle local.

## Tester en une minute

Prérequis : Node.js 20 ou plus récent. Aucune dépendance, aucun compte et aucune clé requis.

```sh
npm test
```

Les tests ne contactent ni Stripe, ni Supabase, ni Resend. Ils ne créent aucun
paiement et n'envoient aucun email. Les identités et commandes sont fictives.

## Lire le projet

| Fichier | Objet |
| --- | --- |
| [src/security.mjs](src/security.mjs) | Contrôles indépendants des services externes |
| [test/security.test.mjs](test/security.test.mjs) | Cas nominaux et refus attendus |
| [docs/case-study.md](docs/case-study.md) | Architecture, risques et limites |

## Origine et périmètre

La version privée utilise Express, des JWT, Supabase, Stripe et Resend. Cette
édition publique a été isolée et adaptée pour être exécutable hors ligne : elle
ne reproduit pas tous les parcours, toutes les règles commerciales ou la totalité
des protections de production. Les exemples ont été préparés avec assistance IA
et restent accompagnés de tests et de limites explicites.

**Ce n'est pas un service d'authentification prêt à déployer, ni un audit ou une
certification de sécurité de SerenityWeb.** La vérification des signatures JWT
et des webhooks appartient à la couche d'intégration, non publiée ici.

Aucun secret, compte client, facture, historique de production ou configuration
interne d'entreprise n'est inclus. Aucune licence de réutilisation n'est accordée
à ce stade. Les outils et bibliothèques tiers conservent leurs licences.

