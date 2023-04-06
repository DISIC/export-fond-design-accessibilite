/**
 * @file Automatically add columns to airtable base based on fields returned by
 * demarches-simplifiees.fr API.
 *
 * *Note*: It's only to create columns which can be mapped to the `demarche.dossiers.nodes.champs` items. Other columns have to be created manually.
 */

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
        nodes {
          champs {
            label
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

const NEW_COLUMN_URL = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables/${AIRTABLE_TABLE_ID}/fields`;

async function main() {
  const formsData = await fetchDosiers();

  const form = formsData.data.demarche.dossiers.nodes.at(0);

  if (!form) {
    throw "The API needs to return at least one form. None were returned.";
  }

  for (let i = 0; i < form.champs.length; i++) {
    console.log('Creating the "', field.label, '" field...');
    const field = form.champs[i];
    await got.post(NEW_COLUMN_URL, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_ACCESS_TOKEN}`,
      },
      json: {
        name: field.label,
        type: "singleLineText",
      },
    });
  }

  console.log("✅ Done !");
}

main();
