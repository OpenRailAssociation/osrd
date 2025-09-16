package fr.sncf.osrd.path.legacy_objects

import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.railjson.schema.external_generated_inputs.RJSElectricalProfileSet
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.TrackChunkId
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.DistanceRangeMapImpl
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.units.Distance.Companion.fromMeters

/**
 * A mapping from track sections to electrical profile values The electrical profiles model the
 * power loss along electrifications depending on the position and the power class of the rolling
 * stock used
 */
class ElectricalProfileMapping {
    /**
     * Internal representation: {"power class": {"track section": {"range": "electrical profile
     * value"}}}
     */
    var mapping = HashMap<String, HashMap<String, DistanceRangeMap<String>>>()

    /** Parse the rjs profiles and store them in the internal mapping. */
    fun parseRJS(rjsProfileSet: RJSElectricalProfileSet) {
        assert(mapping.isEmpty())
        for (rjsProfile in rjsProfileSet.levels) {
            val trackMapping: HashMap<String, DistanceRangeMap<String>> =
                mapping.computeIfAbsent(rjsProfile.powerClass) { _: String? -> HashMap() }
            for (trackRange in rjsProfile.trackRanges) {
                val rangeMapping =
                    trackMapping.computeIfAbsent(trackRange.trackSectionID) { _: String? ->
                        DistanceRangeMapImpl()
                    }
                rangeMapping.put(
                    fromMeters(trackRange.begin),
                    fromMeters(trackRange.end),
                    rjsProfile.value,
                )
            }
        }
    }

    /** Returns the electrical profiles encountered on a path */
    fun getProfilesOnPath(
        infra: RawInfra,
        path: TrainPath,
    ): HashMap<String, DistanceRangeMap<String>> {
        val res = HashMap<String, DistanceRangeMap<String>>()
        for (entry in mapping.entries) {
            val powerClass = entry.key
            val byTrackMapping = entry.value
            res[powerClass] =
                path.getRangeMapFromUndirected { chunkId ->
                    getProfilesOnChunk(infra, chunkId, byTrackMapping)
                }
        }
        return res
    }

    /** Returns the range of electrical profiles on the given chunk */
    fun getProfilesOnChunk(
        infra: RawInfra,
        chunk: TrackChunkId,
        mapping: HashMap<String, DistanceRangeMap<String>>,
    ): DistanceRangeMap<String> {
        val chunkOffset = infra.getTrackChunkOffset(chunk)
        val trackId = infra.getTrackFromChunk(chunk)
        val trackName = infra.getTrackSectionName(trackId)
        var profilesOnChunk = distanceRangeMapOf<String>()
        if (mapping.containsKey(trackName)) {
            val trackProfiles = mapping[trackName]!!
            profilesOnChunk =
                trackProfiles.subMap(
                    chunkOffset.distance,
                    chunkOffset.distance + infra.getTrackChunkLength(chunk).distance,
                )
            profilesOnChunk.shiftPositions(-chunkOffset.distance)
        }
        return profilesOnChunk
    }
}
