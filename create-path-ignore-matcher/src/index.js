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

import { Minimatch } from 'minimatch'
import parsePathIgnoreRule from '@alexstevovich/parse-path-ignore-rule'
import pathToPosix from '@alexstevovich/path-to-posix'

export default function createPathIgnoreMatcher(
  patterns,
  baseRelPath = '',
  options = {},
) {
  const debug = options.debug ?? false

  const includeRules = []
  const excludeRules = []

  if (debug)
    console.debug(`Normalizing patterns (baseRelPath="${baseRelPath}")`)
  for (const rawPattern of patterns) {
    const parsed = parsePathIgnoreRule(rawPattern)
    const mm = new Minimatch(parsed.pattern, {
      dot: true,
      matchBase: !parsed.pattern.includes('/'),
    })

    const rule = { matcher: mm, ...parsed }
    ;(parsed.isNegated ? includeRules : excludeRules).push(rule)
    if (debug)
      console.debug(
        `${parsed.isNegated ? 'Include' : 'Exclude'}: ${rawPattern} -> ${parsed.pattern}`,
      )
  }

  const testMatch = (rule, scopedPath, isDir) => {
    if (rule.directoryOnly && !isDir) return false

    if (
      rule.anchored &&
      scopedPath !== rule.pattern &&
      !scopedPath.startsWith(rule.pattern + '/')
    ) {
      return false
    }

    const target = isDir ? `${scopedPath}/` : scopedPath
    const result = rule.matcher.match(target)
    if (debug) {
      if (result) {
        console.debug(
          `Matched: [${rule.raw}] against "${target}" (dir: ${isDir})`,
        )
      } else {
        console.debug(
          `Not matched: [${rule.raw}] against "${target}" (dir: ${isDir})`,
        )
      }
    }
    return result
  }

  const isPathIgnored = (inputPath, isDir) => {
    const posixPath = pathToPosix(inputPath).replace(/\/+$/, '')
    if (debug)
      console.debug(
        `\nEvaluating: ${inputPath} -> "${posixPath}" (dir: ${isDir})`,
      )

    // Scoped path (relative to baseRelPath)
    let scopedPath = posixPath
    if (baseRelPath !== '') {
      const prefix = pathToPosix(baseRelPath).replace(/\/+$/, '')
      if (posixPath === prefix) {
        scopedPath = ''
      } else if (posixPath.startsWith(prefix + '/')) {
        scopedPath = posixPath.slice(prefix.length + 1)
      } else {
        if (debug) console.debug('Outside baseRelPath; not ignored')
        return false
      }
    }
    if (debug) console.debug(`Scoped path: "${scopedPath}"`)

    const segments = scopedPath.split('/')

    for (let i = 1; i < segments.length; i++) {
      const parentPath = segments.slice(0, i).join('/')
      const parentExcluded = excludeRules.some((rule) =>
        testMatch(rule, parentPath, true),
      )
      if (parentExcluded) {
        let restored = false
        for (let j = i; j <= segments.length; j++) {
          const subPath = segments.slice(0, j).join('/')
          const restoredBy = includeRules.some((rule) =>
            testMatch(rule, subPath, j === segments.length ? isDir : true),
          )
          if (restoredBy) {
            if (j === segments.length) {
              if (debug)
                console.debug(`Restored by inclusion rule: matched ${subPath}`)
              restored = true
            } else {
              // intermediate parent is restored — keep going
              continue
            }
            break
          }
        }
        if (!restored) {
          if (debug)
            console.debug(`Not restored; ignored by parent: ${parentPath}`)
          return true
        }
        break
      }
    }

    // Step 2: Direct match
    const isIncluded = includeRules.some((rule) =>
      testMatch(rule, scopedPath, isDir),
    )
    if (isIncluded) {
      if (debug) console.debug('Included directly')
      return false
    }

    const isExcluded = excludeRules.some((rule) =>
      testMatch(rule, scopedPath, isDir),
    )
    if (isExcluded) {
      if (debug) console.debug('Ignored directly')
      return true
    }

    if (debug) console.debug('No rule matched; not ignored')
    return false
  }

  return isPathIgnored
}
