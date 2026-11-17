import { makeIndexFiles } from '../src/assets/make-index-files.mjs'

export default function () {
  // Once before workers start, including when all generated indexes are absent.
  makeIndexFiles()
}
