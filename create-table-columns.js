/**
 * @file Automatically add columns to airtable base based on fields returned by
 * demarches-simplifiees.fr API.
 *
 * __Note__: The fields generated from the `champDescriptors` items all have type
 * `singleLineText` by default. This is because the API doesnt return the type
 * of the field (short text, long text, number, date...)
 * You're free to manually change the types in Airtable.
 */

import got from "got";
import _ from "lodash-es";

const {
  DS_API_TOKEN,
  AIRTABLE_BASE_ID,
  AIRTABLE_TABLE_ID,
  AIRTABLE_ACCESS_TOKEN,
} = process.env;

const query = `
  query Request {
    demarche(number: 70307) {
      publishedRevision {
        champDescriptors {
          label
          __typename
        }
      }
    }
  }
`;

/**
 * Fetch data from demarches-simplifiees.fr API
 */
async function fetchFieldDescriptions() {
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

const DS_TYPENAME_TO_AIRTABLE_TYPE = {
  PieceJustificativeChampDescriptor: "multipleAttachments",
  IntegerNumberChamp: "number",
};

async function main() {
  const data = await fetchFieldDescriptions();

  const fieldDescriptions =
    data.data.demarche.publishedRevision.champDescriptors;

  const columnDefinitions = _.uniqBy(
    [
      {
        name: "Statut",
        type: "singleLineText",
      },
      {
        name: "PDF",
        type: "url",
      },
      {
        name: "Demandeur",
        type: "singleLineText",
      },
      {
        name: "Demandeur (SIRET)",
        type: "singleLineText",
      },
      ...fieldDescriptions.map((c) => ({
        name: c.label,
        type: DS_TYPENAME_TO_AIRTABLE_TYPE[c.__typename] ?? "singleLineText",
      })),
    ],
    _.property("name")
  );

  for (let i = 0; i < columnDefinitions.length; i++) {
    const definition = columnDefinitions[i];
    console.log('Creating the "', definition.name, '" field...');
    await got.post(NEW_COLUMN_URL, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_ACCESS_TOKEN}`,
      },
      json: definition,
    });
  }

  console.log("✅ Done !");
}

main();
