package fr.sncf.osrd.kt_external_generated_inputs

import fr.sncf.osrd.railjson.schema.external_generated_inputs.RJSElectricalProfileSet
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.DistanceRangeMapImpl
import fr.sncf.osrd.utils.units.Distance.Companion.fromMeters

/**
 * A mapping from track sections to electrical profile values
 * The electrical profiles model the power loss along catenaries depending on the position and the power class of
 * the rolling stock used
 */

class ElectricalProfileMapping {
    /**
     * Internal representation: {"power class": {"track section": {"range": "electrical profile value"}}}
     */
    var mapping = HashMap<String, HashMap<String, DistanceRangeMap<String>>>()

    /**
     * Parse the rjs profiles and store them in the internal mapping.
     */
    fun parseRJS(rjsProfileSet: RJSElectricalProfileSet) {
        assert(mapping.isEmpty())
        for (rjsProfile in rjsProfileSet.levels) {
            val trackMapping: HashMap<String, DistanceRangeMap<String>> =
                mapping.computeIfAbsent(
                    rjsProfile.powerClass
                ) { _: String? -> HashMap() }
            for (trackRange in rjsProfile.trackRanges) {
                val rangeMapping = trackMapping.computeIfAbsent(
                    trackRange.trackSectionID
                ) { k: String? -> DistanceRangeMapImpl() }
                rangeMapping.put(fromMeters(trackRange.begin), fromMeters(trackRange.end), rjsProfile.value)
            }
        }
    }

    /** Returns the electrical profiles encountered on a path */
    fun getProfilesOnPath(path: Path): HashMap<String, DistanceRangeMap<String>> {
        val res = HashMap<String, DistanceRangeMap<String>>()
        for (entry in mapping.entries) {
            val powerClass = entry.key
            val byTrackMapping: HashMap<String, DistanceRangeMap<String>> = entry.value
            res.put(powerClass, path.getElectricalProfiles(byTrackMapping))
        }
        return res
    }
}
