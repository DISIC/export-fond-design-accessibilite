import fetch from "node-fetch";

const { DS_API_URL, DS_API_TOKEN } = process.env;

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

async function main() {
  const data = await fetch(DS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${DS_API_TOKEN}`,
    },
    body: JSON.stringify({
      query,
      variables: {},
    }),
  }).then((res) => res.json());

  // console.dir(data, { depth: null });

  const dossierCount = data.data.demarche.dossiers.nodes.length;
  console.log("Succesfully fetched data for", dossierCount, "forms");
}

main();
