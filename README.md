# Synchonisation demarches-simplifiees.fr et Airtable

## Utilisation

### Prérequis

- Sur Airtable, créer une nouvelle table.
  - Renommer la première colonne avec le nom "ID"
  - Supprimer les autres colonnes présentes par défaut
- Récuperer un token d'accès pour l'API de demarches-simplifiees.fr
- Récuperer un token d'accès pour l'API de Airtable avec les scopes
  `data.records:write` et `schema.bases:write` et accès à la base dans
  laquelle se trouve la table cible.

### Création des colonnes

- Cloner ce repo : `git clone https://github.com/DISIC/export-fond-design-accessibilite.git`
- Installer les dépendances : `yarn install`
- Lancer le script de création des colonnes :

```
DS_API_TOKEN="xxxx" AIRTABLE_BASE_ID="xxxx" AIRTABLE_TABLE_ID="xxxx" AIRTABLE_ACCESS_TOKEN="xxxx" node create-table-columns.js
```

### Récupération des données

Lancer le script de récupération des données :

```
DS_API_TOKEN="xxxx" AIRTABLE_BASE_ID="xxxx" AIRTABLE_TABLE_ID="xxxx" AIRTABLE_ACCESS_TOKEN="xxxx" node fetch-form-data.js
```
