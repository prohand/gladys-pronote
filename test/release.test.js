// -----------------------------------------------------------------------------
// The changelog roll of the Release workflow (.github/scripts/changelog-release.mjs).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { rollChangelog } from '../.github/scripts/changelog-release.mjs';

const REPO = 'https://github.com/prohand/gladys-pronote';

test('the Unreleased section moves under the version, an empty one stays on top', () => {
  const text = `# Changelog\n\n## [Unreleased]\n\n### Added\n\n- A thing.\n\n[Unreleased]: ${REPO}/commits/main\n`;
  const rolled = rollChangelog(text, '1.0.0', '2026-10-14');
  assert.match(
    rolled,
    /## \[Unreleased\]\n\n## \[1\.0\.0\] - 2026-10-14\n\n### Added\n\n- A thing\./,
  );
  assert.match(rolled, new RegExp(`\\[Unreleased\\]: ${REPO}/compare/v1\\.0\\.0\\.\\.\\.HEAD`));
  assert.match(rolled, new RegExp(`\\[1\\.0\\.0\\]: ${REPO}/releases/tag/v1\\.0\\.0`));
});

test('the next release compares with the previous tag', () => {
  const text = `## [Unreleased]\n\n- B.\n\n## [1.0.0] - 2026-10-14\n\n- A.\n\n[Unreleased]: ${REPO}/compare/v1.0.0...HEAD\n[1.0.0]: ${REPO}/releases/tag/v1.0.0\n`;
  const rolled = rollChangelog(text, '1.1.0', '2026-11-01');
  assert.match(
    rolled,
    new RegExp(`\\[1\\.1\\.0\\]: ${REPO}/compare/v1\\.0\\.0\\.\\.\\.v1\\.1\\.0`),
  );
});

test('the repository changelog has an Unreleased section and its link', async () => {
  const text = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  assert.match(text, /^## \[Unreleased\]$/m);
  assert.match(text, new RegExp(`^\\[Unreleased\\]: ${REPO}/commits/main$`, 'm'));
});
