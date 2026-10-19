// -----------------------------------------------------------------------------
// The HTTP client handed to pawnote, with a fix for PRONOTE 2026.2.
//
// Before logging in, pawnote reads the instance page (`mobile.eleve.html`…) and
// cuts the parameters of its `Start(…)` call out of the text, up to `)}catch`.
// PRONOTE 2026.2 writes `Start ({…});} catch`: the `;` hides the end marker,
// pawnote 1.6.2 cannot find the parameters and throws PageUnavailableError at
// every login (password and QR code alike). The fetcher removes that `;` from
// the instance page only, and behaves like pawnote's default fetcher otherwise.
// Harmless once pawnote parses the new page itself: it then matches nothing.
// -----------------------------------------------------------------------------

/** The instance page pawnote reads before logging in. */
const INSTANCE_PAGE = /\/mobile\.[a-z]+\.html$/i;

/**
 * Remove the `;` PRONOTE 2026.2 puts between the `Start(…)` call and the end of
 * its `try` block.
 *
 * @param {string} html
 * @returns {string}
 */
export function fixInstancePage(html) {
  return html.replace(/(Start\s*\([^)]*\))\s*;(\s*\}\s*catch)/, '$1$2');
}

/**
 * A pawnote fetcher (same contract as `defaultFetcher` of
 * `@literate.ink/utilities`).
 *
 * @param {typeof fetch} [fetchImpl] the tests pass a fake one
 */
export function createPronoteFetcher(fetchImpl = fetch) {
  return async (request) => {
    const response = await fetchImpl(request.url.href, {
      redirect: request.redirect ?? 'follow',
      headers: request.headers ?? {},
      method: request.method ?? 'GET',
      body: request.content,
    });
    let content = await response.text();
    if (INSTANCE_PAGE.test(request.url.pathname)) {
      content = fixInstancePage(content);
    }
    return { status: response.status, content, headers: response.headers };
  };
}
