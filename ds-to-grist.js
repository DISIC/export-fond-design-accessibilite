import ky from "ky";
import _ from "lodash-es";
import { dsIdToGristId } from "./utils.js";

const {
  DS_API_TOKEN,
  GRIST_DOC_ID,
  GRIST_TABLE_ID,
  GRIST_ACCESS_TOKEN,
  DS_DEMARCHE_ID,
} = process.env;

const gristApi = ky.extend({
  prefixUrl: `https://docs.getgrist.com/api/docs/${GRIST_DOC_ID}/tables/${GRIST_TABLE_ID}`,
  headers: { Authorization: `Bearer ${GRIST_ACCESS_TOKEN}` },
});

const dsApi = ky.extend({
  prefixUrl: "https://www.demarches-simplifiees.fr/api/v2/graphql",
  headers: {
    Authorization: `Bearer ${DS_API_TOKEN}`,
  },
});

async function main() {
  // Fetch DS data
  const query = `
    query GetEntries {
      demarche(number: ${DS_DEMARCHE_ID}) {
        dossiers {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            state
            champs {
              id
              label
              stringValue
              __typename
              ... on PieceJustificativeChamp {
                files {
                  filename
                  url
                }
              }
            }
            demandeur {
              __typename
              ... on PersonneMorale {
                siret
                entreprise {
                  raisonSociale
                }
                association {
                  titre
                  
                }
              }
              ... on PersonneMoraleIncomplete {
                siret
              }
              ... on PersonnePhysique {
                nom
                prenom
                civilite
              }
            }
            dateDepot
            dateDerniereModification
            dateExpiration
            datePassageEnConstruction
            datePassageEnInstruction
            dateSuppressionParAdministration
            dateSuppressionParUsager
            dateTraitement
            pdf {
              url
            }
          }
        }
      }
    }
  `;
  console.log("Fetching data from demarche-simplifiee...");
  const dsData = await dsApi
    .post("", { json: { query, variables: {} } })
    .json();

  const uploadedDataColumns = new Map([
    ["ds_id", "DS ID"],
    ["statut", "Statut"],
    ["pdf", "PDF"],
    ["demandeur", "Demandeur"],
    ["demandeur_siret", "Demandeur (Siret)"],
  ]);

  // Build records data
  const uploadDataPayload = {
    records: dsData.data.demarche.dossiers.nodes.map((dossier) => {
      let demandeur;
      let demandeurSiret;
      if (dossier.demandeur.__typename === "PersonneMorale") {
        demandeur =
          dossier.demandeur.entreprise?.raisonSociale ||
          dossier.demandeur.association?.titre;
        demandeurSiret = dossier.demandeur.siret;
      } else if (dossier.demandeur.__typename === "PersonnePhysique") {
        demander = `${dossier.demandeur.civilite} ${dossier.demandeur.prenom} ${dossier.demandeur.nom}`;
      } else if (dossier.demandeur.__typename === "PersonneMoraleIncomplete") {
        demandeurSiret = dossier.demandeur.siret;
      }

      return {
        require: {
          ds_id: dossier.id,
        },
        fields: {
          ds_id: dossier.id,
          statut: dossier.state,
          pdf: dossier.pdf.url,
          demandeur: demandeur,
          demandeur_siret: demandeurSiret,
          ...Object.fromEntries(
            dossier.champs.map((c) => {
              let value = c.stringValue;

              // File field
              if (c.__typename === "PieceJustificativeChamp") {
                if (c.files.length) {
                  value = c.files[0].url;
                }
              }

              uploadedDataColumns.set(dsIdToGristId(c.id), c.label);

              return [dsIdToGristId(c.id), value];
            })
          ),
        },
      };
    }),
  };

  // Compare existing columns with records data columns
  // - fetch existings columns
  console.log("Fetching existing columns from Grist");
  const { columns } = await gristApi.get("columns").json();
  const columnIds = columns.map((col) => col.id);

  // - list columns to be uploaded
  const uploadedDataColumnIds = Array.from(uploadedDataColumns.keys());

  // If needed create new columns on Grist
  const columnDifference = _.difference(uploadedDataColumnIds, columnIds);
  if (columnDifference.length > 0) {
    console.log(
      `${columnDifference.length} missing columns. Creating new columns...`
    );
    const newColumnsPayload = {
      columns: columnDifference.map((colId) => ({
        id: colId,
        fields: { label: uploadedDataColumns.get(colId) },
      })),
    };
    await gristApi.post("columns", { json: newColumnsPayload });
    console.log("✅ New columns created on Grist");
  } else {
    console.log("No column update needed.");
  }

  // Send new records to grist
  console.log("Uploading form data to Grist...");
  await gristApi.put("records", { json: uploadDataPayload });
  console.log("✅ Successfully uploaded data to Grist");
}

main();
