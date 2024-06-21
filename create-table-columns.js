/**
 * @file Automatically add columns to grist table based on fields returned by
 * demarches-simplifiees.fr API.
 */

import got from "got";
import _ from "lodash-es";
import { dsIdToGristId } from "./utils.js";

const { DS_API_TOKEN, GRIST_DOC_ID, GRIST_TABLE_ID, GRIST_ACCESS_TOKEN } =
  process.env;

const query = `
  query Request {
    demarche(number: 86391) {
      publishedRevision {
        champDescriptors {
          id
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
      json: { query, variables: {} },
    })
    .json();
}

const DS_TYPENAME_TO_AIRTABLE_TYPE = {
  // HeaderSectionChampDescriptor: "",
  // TextChampDescriptor: "Text",
  // EmailChampDescriptor: "Text",
  // PhoneChampDescriptor: "Text",
  // DropDownListChampDescriptor: "",
  // MultipleDropDownListChampDescriptor: "",
  // TextareaChampDescriptor: "Text",
  NumberChampDescriptor: "Numeric",
  PieceJustificativeChampDescriptor: "Attachments",
};

async function main() {
  const data = await fetchFieldDescriptions();

  const fieldDescriptions =
    data.data.demarche.publishedRevision.champDescriptors;

  const columnDefinitions = [
    {
      id: "ds_id",
      fields: { label: "DS ID", type: "Text" },
    },
    {
      id: "statut",
      fields: { label: "Statut", type: "Text" },
    },
    {
      id: "pdf",
      fields: { label: "PDF", type: "Text" },
    },
    {
      id: "demandeur",
      fields: { label: "Demandeur", type: "Text" },
    },
    {
      id: "demandeur_siret",
      fields: { label: "Demandeur (SIRET)", type: "Text" },
    },
    ...fieldDescriptions.map((c) => ({
      id: dsIdToGristId(c.id),
      fields: {
        label: c.label,
        type: DS_TYPENAME_TO_AIRTABLE_TYPE[c.__typename] ?? "Any",
      },
    })),
  ];

  // console.log(columnDefinitions.map((c) => c.id));

  console.log(`Creating ${columnDefinitions.length} columns on Grist...`);

  const UPDATE_COLUMNS_URL = `https://docs.getgrist.com/api/docs/${GRIST_DOC_ID}/tables/${GRIST_TABLE_ID}/columns?replaceall=true`;
  await got.put(UPDATE_COLUMNS_URL, {
    json: { columns: columnDefinitions },
    headers: { Authorization: `Bearer ${GRIST_ACCESS_TOKEN}` },
  });

  console.log("✅ Done !");
}

main();
