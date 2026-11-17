// poe.ninja returns an empty or all-null `graph` for entries it has too few
// listings to track (common early in a league). Such prices can be off by
// orders of magnitude (e.g. an ilvl 83 Elder Paua Amulet listed at 650c while
// the trade site has 144 listings at 1-3c), so they are not shown for base types.
export function hasPriceHistory (graph: Array<number | null> | undefined): boolean {
  return (graph ?? []).some(point => point != null)
}
