/**
 * Where a catalog entry's repository lives. Entries default to GitHub; a project that moved to another
 * forge sets "host" in data/libraries.json (scripts/verify-links.mjs knows how to refresh each host).
 * Plain JavaScript so the build scripts can import it on any Node version, not only ones that strip types.
 */
export const REPO_HOSTS = { github: 'github.com', codeberg: 'codeberg.org' };

/** @typedef {{ repo: string; host?: string }} RepoRef */

/** @param {RepoRef} l @returns {keyof typeof REPO_HOSTS} */
export const repoHost = (l) => /** @type {keyof typeof REPO_HOSTS} */ (l.host ?? 'github');
/** @param {RepoRef} l */
export const repoUrl = (l) => `https://${REPO_HOSTS[repoHost(l)]}/${l.repo}`;
/** "owner/name" for GitHub, "codeberg.org/owner/name" elsewhere, so the forge is visible on cards. @param {RepoRef} l */
export const repoLabel = (l) => (repoHost(l) === 'github' ? l.repo : `${REPO_HOSTS[repoHost(l)]}/${l.repo}`);
