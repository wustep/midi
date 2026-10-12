/**
 * Where a catalog entry's repository lives. Entries default to GitHub; a project that moved to another
 * forge sets "host" in data/libraries.json (scripts/verify-links.mjs knows how to refresh each host).
 */
export const REPO_HOSTS = { github: 'github.com', codeberg: 'codeberg.org' } as const;
export type RepoHost = keyof typeof REPO_HOSTS;

export interface RepoRef {
  repo: string;
  host?: string;
}

export const repoHost = (l: RepoRef): RepoHost => (l.host as RepoHost) ?? 'github';
export const repoUrl = (l: RepoRef): string => `https://${REPO_HOSTS[repoHost(l)]}/${l.repo}`;
/** "owner/name" for GitHub, "codeberg.org/owner/name" elsewhere, so the forge is visible on cards. */
export const repoLabel = (l: RepoRef): string => (repoHost(l) === 'github' ? l.repo : `${REPO_HOSTS[repoHost(l)]}/${l.repo}`);
