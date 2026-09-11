/*
 * ISC License
 *
 * Copyright (c) 2025 Alex Stevovich
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 * OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */

import filterPathsByGlob from '@alexstevovich/filter-paths-by-glob'
import hasParentPathSegment from '@alexstevovich/has-parent-path-segment'
import scanPathsWithIgnore from '@alexstevovich/scan-paths-with-ignore'

/**
 * Performs glob(s) from a root directory with Git-like ignore logic.
 *
 * @param {string|string[]} patterns - Glob string or array of globs (relative to rootDir).
 * @param {object} options
 * @param {string} options.rootDir - Directory to glob within and anchor ignore logic.
 * @param {string[]} [options.ignoreRuleFiles=[]] - Files like `.gitignore`.
 * @param {string[]} [options.globalIgnoreRules=[]] - Additional ignore patterns.
 * @param {boolean} [options.debug=false]
 * @returns {Promise<string[]>} List of matching, non-ignored relative paths.
 */
export default async function globPathsWithIgnore(
  rootDir,
  patterns,
  { ignoreRuleFiles = [], globalIgnoreRules = [], debug = false } = {},
) {
  if (!rootDir) {
    throw new Error('rootDir is required')
  }

  const patternList = Array.isArray(patterns) ? patterns : [patterns]

  // Validate globs are within rootDir
  for (const pattern of patternList) {
    if (hasParentPathSegment(pattern)) {
      throw new Error(`pattern "${pattern}" escapes rootDir`)
    }
  }

  const files = await scanPathsWithIgnore(rootDir, {
    ignoreRuleFiles,
    globalIgnoreRules,
    recursive: true,
    pathTypes: 'FILE',
    debug,
  })

  let results = []
  for (const pattern of patternList) {
    const matched = filterPathsByGlob(rootDir, files, pattern)
    results.push(...matched)
  }

  return [...new Set(results)].sort()
}
