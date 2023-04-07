import got from "got";

const {
  DS_API_TOKEN,
  AIRTABLE_BASE_ID,
  AIRTABLE_TABLE_ID,
  AIRTABLE_ACCESS_TOKEN,
} = process.env;

const query = `
  query Request {
    demarche(number: 70307) {
      dossiers {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          state
          champs {
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
  console.log("⚙️  Building airtable PATCH body...");

  return {
    typecast: true,
    performUpsert: {
      fieldsToMergeOn: ["ID"],
    },
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
        fields: {
          ID: dossier.id,
          Statut: dossier.state,
          PDF: dossier.pdf.url,
          Demandeur: demandeur,
          "Demandeur (SIRET)": demandeurSiret,
          ...Object.fromEntries(
            dossier.champs.map((c) => {
              let value = c.stringValue;

              // File field
              if (c.__typename === "PieceJustificativeChamp") {
                value = c.files.map((f) => ({
                  url: f.url,
                  filename: f.filename,
                }));
              }

              return [c.label, value];
            })
          ),
        },
      };
    }),
  };
}

async function uploadDossiers(body) {
  console.log("⏳ Uploading data...");

  await got.patch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`,
    {
      headers: {
        Authorization: `Bearer ${AIRTABLE_ACCESS_TOKEN}`,
      },
      json: body,
    }
  );
}

async function main() {
  const data = await fetchDosiers();
  const airtableBody = buildAirtableUpdateBody(data);
  await uploadDossiers(airtableBody);

  console.log("✅ Sucessfully updated airtable data");
}

main();
