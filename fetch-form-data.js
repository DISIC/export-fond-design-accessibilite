import got from "got";
import { dsIdToGristId } from "./utils.js";

const { DS_API_TOKEN, GRIST_DOC_ID, GRIST_TABLE_ID, GRIST_ACCESS_TOKEN } =
  process.env;

const query = `
  query Request {
    demarche(number: 86391) {
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

/**
 * Fetch data from demarches-simplifiees.fr API
 *
 * TODO: handle pagination
 */
async function fetchDosiers() {
  console.log("⏳ Fetching data...");
  return got
    .post("https://www.demarches-simplifiees.fr/api/v2/graphql", {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${DS_API_TOKEN}`,
      },
      json: {
        query,
        variables: {},
      },
    })
    .json();
}

function buildAirtableUpdateBody(dsData) {
  console.log("⚙️  Building grist PUT body...");

  return {
    // typecast: true,
    // performUpsert: {
    //   fieldsToMergeOn: ["ID"],
    // },
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
                // value = c.files.map((f) => ({
                //   url: f.url,
                //   filename: f.filename,
                // }));
                value = null;
              }

              return [dsIdToGristId(c.id), value];
            })
          ),
        },
      };
    }),
  };
}

async function uploadDossiers(body) {
  console.log("⏳ Uploading data...");

  await got
    .put(
      // `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`,
      `https://docs.getgrist.com/api/docs/${GRIST_DOC_ID}/tables/${GRIST_TABLE_ID}/records`,
      {
        headers: {
          Authorization: `Bearer ${GRIST_ACCESS_TOKEN}`,
        },
        json: body,
      }
    )
    .catch((e) => {
      console.log(e.response.body);
    });
}

async function main() {
  const data = await fetchDosiers();
  // console.log(
  //   data.data.demarche.dossiers.nodes.at(0).champs.map((c) => c.label)
  // );
  const airtableBody = buildAirtableUpdateBody(data);
  console.dir(airtableBody, { depth: null });
  await uploadDossiers(airtableBody);

  console.log("✅ Sucessfully updated airtable data");
}

main();
