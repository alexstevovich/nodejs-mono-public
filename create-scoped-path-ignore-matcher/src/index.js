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

import fs from 'node:fs/promises'
import path from 'node:path'

import createPathIgnoreMatcher from '@alexstevovich/create-path-ignore-matcher'
import loadPathPatternFiles from '@alexstevovich/load-path-pattern-files'
import pathToPosix from '@alexstevovich/path-to-posix'

export default async function createScopedPathIgnoreMatcher(
  rootDir,
  options = {},
) {
  const matcher = new ScopedPathIgnoreMatcher(rootDir, options)
  await matcher.init()
  const match = (relativePath) => {
    return matcher.match(relativePath)
  }
  match.matcher = matcher
  return match
}

class ScopedPathIgnoreMatcher {
  constructor(
    rootDir,
    { ignoreRuleFiles = [], globalIgnoreRules = [], debug = false } = {},
  ) {
    this.rootDir = path.resolve(rootDir)
    this.ignoreRuleFiles = Array.isArray(ignoreRuleFiles)
      ? ignoreRuleFiles
      : [ignoreRuleFiles]
    this.globalIgnoreRules = globalIgnoreRules
    this.debug = debug
    this.hierarchy = new Map()
  }

  async init() {
    const queue = [this.rootDir]

    while (queue.length) {
      const currentDir = queue.pop()
      const relPath = path.relative(this.rootDir, currentDir)
      const parentDir = path.dirname(currentDir)
      const parentMatcher = this.hierarchy.get(parentDir)
      const parentPatterns = parentMatcher?.__patterns || []

      const localPatterns = await loadPathPatternFiles(
        currentDir,
        this.ignoreRuleFiles,
      )

      if (this.debug) {
        console.debug(`Building matcher for: ${currentDir}`)
        console.debug(`├─ inherited: ${parentPatterns.length} patterns`)
        console.debug(`├─ local: ${localPatterns.length} patterns`)
        if (relPath === '') {
          console.debug(
            `├─ global rules: ${this.globalIgnoreRules.length} patterns`,
          )
        }
      }

      const allPatterns = [
        ...parentPatterns,
        ...localPatterns,
        ...(relPath === '' ? this.globalIgnoreRules : []),
      ]

      const matcher = createPathIgnoreMatcher(allPatterns, '', {
        debug: this.debug,
      })
      matcher.__patterns = allPatterns
      this.hierarchy.set(currentDir, matcher)

      const dirents = await fs.readdir(currentDir, { withFileTypes: true })
      for (const ent of dirents) {
        if (ent.isSymbolicLink()) continue

        const childPath = path.join(currentDir, ent.name)
        const relChildPath = path.relative(this.rootDir, childPath)
        const isDir = ent.isDirectory()

        let isIgnored = matcher(relChildPath, isDir)

        if (isDir && isIgnored) {
          const restored = matcher.__patterns.some(
            (pattern) =>
              pattern.negated &&
              pattern.pattern.startsWith(pathToPosix(relChildPath) + '/'),
          )
          if (restored) isIgnored = false
        }

        if (isDir && !isIgnored) queue.push(childPath)
      }
    }
  }

  match(relPath) {
    relPath = pathToPosix(relPath)

    const isDir = relPath.endsWith('/')

    let checkDir = this.rootDir
    const parts = relPath.split('/')

    // Remove the empty trailing part if it's a directory path ending with '/'
    const loopUntil = isDir ? parts.length - 1 : parts.length - 1
    for (let i = 0; i < loopUntil; i++) {
      checkDir = path.join(checkDir, parts[i])
    }

    if (this.debug) {
      console.debug(`\nMatching: ${relPath} (${isDir ? 'dir' : 'file'})`)
    }

    while (checkDir && checkDir !== path.dirname(checkDir)) {
      const matcher = this.hierarchy.get(checkDir)
      if (this.debug) {
        console.debug(`├─ Checking matcher for ${checkDir}`)
      }
      if (matcher) {
        return matcher(relPath, isDir)
      }
      checkDir = path.dirname(checkDir)
    }

    return false
  }

  dir(relPath) {
    return this.match(relPath, true)
  }

  file(relPath) {
    return this.match(relPath, false)
  }

  toString() {
    return `[ScopedPathIgnoreMatcher from ${this.rootDir}]`
  }
}
