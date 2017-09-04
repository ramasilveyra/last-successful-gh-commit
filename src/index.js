import axios from 'axios';

export default getLastSuccessfulCommit;
export const graphqlEndpoint = 'https://api.github.com/graphql';

async function getLastSuccessfulCommit({ owner, name, token, after } = {}) {
  if (!owner) {
    throw new Error('"owner" needs to be defined');
  }
  if (!name) {
    throw new Error('"name" needs to be defined');
  }
  if (!token) {
    throw new Error('"token" needs to be defined');
  }

  const response = await getCommitsInfo({ owner, name, token, after });
  const parsed = parseResponse(response);

  if (parsed.commit) {
    return parsed.commit;
  }

  if (parsed.after) {
    return getLastSuccessfulCommit({ owner, name, token, after: parsed.after });
  }

  return null;
}

function getCommitsInfo({ owner, name, token, after = null }) {
  return axios.post(
    graphqlEndpoint,
    {
      query: createQuery(owner, name, after)
    },
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
}

function createQuery(owner, name, after) {
  const query = `
    query {
      repository(owner: "${owner}", name: "${name}") {
        ref(qualifiedName: "master") {
          target {
            ... on Commit {
              history(first: 10${after ? `, after: "${after}"` : ''}) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                edges {
                  node {
                    status {
                      state
                    }
                    message
                    oid
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  return query;
}

function parseResponse(response) {
  const history = response.data.data.repository.ref.target.history;
  const hasNextPage = history.pageInfo.hasNextPage;
  const after = history.pageInfo.endCursor;
  const commit = findSuccessCommit(history.edges);

  if (commit) {
    return { commit, after: null };
  }

  if (hasNextPage && after) {
    return { commit: null, after };
  }

  return { commit: null, after: null };
}

function findSuccessCommit(edges) {
  // eslint-disable-next-line no-restricted-syntax
  for (const commit of edges) {
    if (commit.node.status && commit.node.status.state === 'SUCCESS') {
      return commit;
    }
  }

  return null;
}
