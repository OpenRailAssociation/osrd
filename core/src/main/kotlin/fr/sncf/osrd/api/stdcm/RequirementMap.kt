package fr.sncf.osrd.api.stdcm

import com.google.common.collect.Range
import com.squareup.moshi.Json
import fr.sncf.osrd.conflicts.ParsedRequirements
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.ZoneId
import java.util.*

/** Used to save the requirement map in "heavy" payloads */
data class RJSRequirementMap(
    // Zone name -> list of (begin time, end time)
    @Json(name = "occupied_time_ranges_by_zone")
    val occupiedTimeRangesByZone: Map<String, List<List<Double>>>
) {
    companion object {
        fun fromRequirements(infra: RawInfra, map: ParsedRequirements): RJSRequirementMap {
            val requirementMap = mutableMapOf<String, List<List<Double>>>()
            for ((zoneId, rangeMap) in map.entries) {
                val zoneName = infra.getZoneName(zoneId)
                val rangeList = mutableListOf<List<Double>>()
                for (range in rangeMap.values) rangeList.add(
                    listOf(range.lowerEndpoint(), range.upperEndpoint())
                )
                requirementMap[zoneName] = rangeList
            }
            return RJSRequirementMap(requirementMap)
        }
    }

    fun toRequirements(infra: RawInfra): ParsedRequirements {
        val result = mutableMapOf<ZoneId, TreeMap<Double, Range<Double>>>()
        for ((zoneName, ranges) in occupiedTimeRangesByZone) {
            val zoneId = infra.getZoneFromName(zoneName)
            val map = TreeMap<Double, Range<Double>>()
            for (range in ranges) {
                require(range.size == 2)
                val lower = range[0]
                val upper = range[1]
                map[upper] = Range.closedOpen(lower, upper)
            }
            result[zoneId] = map
        }
        return result
    }
}
