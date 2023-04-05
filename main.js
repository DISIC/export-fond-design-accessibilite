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
            id
            label
            stringValue
          }
        }
      }
    }
  }
`;

/** Fetch data from demarches-simplifiees.fr API */
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

function transformDossierData(data) {
  console.log("⚙️ Transforming data...");
  return {
    records: data.data.demarche.dossiers.nodes.map((dossier) => {
      // console.log(dossier);
      return {
        fields: {
          ID: dossier.id,
          "Porteur du projet": dossier.champs.find(
            (c) => c.label === "Nom et prénom du porteur de projet"
          ).stringValue,
          "Fonction du porteur de projet": dossier.champs.find(
            (c) => c.label === "Fonction du porteur de projet"
          ).stringValue,
          "Email du porteur de projet": dossier.champs.find(
            (c) => c.label === "Email du porteur de projet"
          ).stringValue,
        },
      };
    }),
  };
}

async function uploadDossiers(data) {
  console.log("Uploading data...");

  await got.post(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`,
    {
      headers: {
        Authorization: `Bearer ${AIRTABLE_ACCESS_TOKEN}`,
      },
      json: data,
    }
  );
}

async function main() {
  const data = await fetchDosiers();
  const transformedData = transformDossierData(data);
  await uploadDossiers(transformedData);

  console.log("✅ Sucessfully updated airtable data");
}

main();
