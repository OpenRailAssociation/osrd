package fr.sncf.osrd.utils

import fr.sncf.osrd.utils.units.Speed

/** Java can't handle generics with value classes, it's impossible to extract the underlying speed from a
 * `RangeMapEntry` in pure java. This method handles this specific case.  */
fun rangeMapEntryToSpeed(entry: DistanceRangeMap.RangeMapEntry<Speed>): Long {
    return entry.value.millimetersPerSecond.toLong()
}
