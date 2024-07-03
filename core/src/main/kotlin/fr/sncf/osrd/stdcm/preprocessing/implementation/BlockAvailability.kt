package fr.sncf.osrd.stdcm.preprocessing.implementation

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.api_v2.stdcm.WorkSchedule
import fr.sncf.osrd.conflicts.IncrementalConflictDetector
import fr.sncf.osrd.conflicts.TrainRequirements
import fr.sncf.osrd.conflicts.TravelledPath
import fr.sncf.osrd.conflicts.incrementalConflictDetector
import fr.sncf.osrd.envelope_utils.DoubleBinarySearch
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.math.max
import kotlin.math.min
import org.slf4j.Logger
import org.slf4j.LoggerFactory

val blockAvailabilityLogger: Logger = LoggerFactory.getLogger("BlockAvailability")

data class BlockAvailability(
    val fullInfra: FullInfra,
    val incrementalConflictDetector: IncrementalConflictDetector,
    val gridMarginBeforeTrain: Double,
    val gridMarginAfterTrain: Double,
) : BlockAvailabilityInterface {

    override fun getAvailability(
        infraExplorer: InfraExplorerWithEnvelope,
        startOffset: Offset<Path>,
        endOffset: Offset<Path>,
        startTime: Double
    ): BlockAvailabilityInterface.Availability {
        val needFullRequirements = startOffset < infraExplorer.getPredecessorLength()
        val spacingRequirements =
            if (needFullRequirements) infraExplorer.getFullSpacingRequirements()
            else infraExplorer.getSpacingRequirements()
        val pathStartTime = startTime - infraExplorer.interpolateDepartureFromClamp(startOffset)
        val endTime = infraExplorer.interpolateDepartureFromClamp(endOffset) + pathStartTime

        // Modify the spacing requirements to adjust for the start time,
        // and filter out the ones that are outside the relevant time range
        val shiftedSpacingRequirements =
            spacingRequirements
                .map {
                    SpacingRequirement(
                        it.zone,
                        max(pathStartTime + it.beginTime, startTime),
                        min(pathStartTime + it.endTime, endTime),
                        it.isComplete
                    )
                }
                .filter { it.beginTime < it.endTime }
        val conflicts =
            incrementalConflictDetector.checkConflicts(shiftedSpacingRequirements, listOf())
        val conflictProperties =
            incrementalConflictDetector.analyseConflicts(shiftedSpacingRequirements, listOf())
        if (conflicts.isEmpty()) {
            return BlockAvailabilityInterface.Available(
                conflictProperties.maxDelayWithoutConflicts,
                conflictProperties.timeOfNextConflict
            )
        } else {
            val firstConflictOffset =
                getEnvelopeOffsetFromTime(
                    infraExplorer,
                    conflicts.first().startTime - pathStartTime
                )
            return BlockAvailabilityInterface.Unavailable(
                conflictProperties.minDelayWithoutConflicts,
                firstConflictOffset
            )
        }
    }

    /**
     * Turns a time into an offset on an envelope with a binary search. Can be optimized if needed.
     */
    private fun getEnvelopeOffsetFromTime(
        explorer: InfraExplorerWithEnvelope,
        time: Double
    ): Offset<TravelledPath> {
        if (time < 0.0) return Offset(0.meters)
        val envelope = explorer.getFullEnvelope()
        if (time > envelope.totalTime) return explorer.getSimulatedLength().cast()
        val search = DoubleBinarySearch(envelope.beginPos, envelope.endPos, time, 2.0, false)

        // The iteration limit avoids infinite loops when accessing times when the train is stopped
        var i = 0
        var value = 0.0
        while (i++ < 20 && !search.complete()) {
            value = search.input
            search.feedback(envelope.interpolateDepartureFromClamp(search.input))
        }
        return Offset(Distance.fromMeters(value))
    }
}

fun makeBlockAvailability(
    infra: FullInfra,
    requirements: Collection<SpacingRequirement>,
    workSchedules: Collection<WorkSchedule> = listOf(),
    gridMarginBeforeTrain: Double = 0.0,
    gridMarginAfterTrain: Double = 0.0,
): BlockAvailabilityInterface {
    val convertedWorkSchedules = convertWorkSchedules(infra.rawInfra, workSchedules)
    var allRequirements = requirements + convertedWorkSchedules
    if (gridMarginAfterTrain != 0.0 || gridMarginBeforeTrain != 0.0) {
        // The margin expected *after* the new train is added *before* the other train resource uses
        allRequirements =
            requirements.map {
                SpacingRequirement(
                    it.zone,
                    it.beginTime - gridMarginAfterTrain,
                    it.endTime + gridMarginBeforeTrain,
                    it.isComplete
                )
            }
    }
    val trainRequirements = listOf(TrainRequirements(0L, allRequirements, listOf()))
    return BlockAvailability(
        infra,
        incrementalConflictDetector(trainRequirements),
        gridMarginBeforeTrain,
        gridMarginAfterTrain,
    )
}

/**
 * Convert work schedules into timetable spacing requirements This is not entirely semantically
 * correct, but it lets us avoid work schedules like any other kind of time-bound constraint
 */
private fun convertWorkSchedules(
    infra: RawSignalingInfra,
    workSchedules: Collection<WorkSchedule>
): List<SpacingRequirement> {
    val res = mutableListOf<SpacingRequirement>()
    for (entry in workSchedules) {
        for (range in entry.trackRanges) {
            val track = infra.getTrackSectionFromName(range.trackSection) ?: continue
            for (chunk in infra.getTrackSectionChunks(track)) {
                val chunkStartOffset = infra.getTrackChunkOffset(chunk)
                val chunkEndOffset = chunkStartOffset + infra.getTrackChunkLength(chunk).distance
                if (chunkStartOffset > range.end || chunkEndOffset < range.begin) continue
                val zone = infra.getTrackChunkZone(chunk)
                if (zone == null) {
                    blockAvailabilityLogger.info(
                        "Skipping part of work schedule [${entry.startTime}; ${entry.endTime}] because it is on a track not fully covered by routes: $track",
                    )
                    continue
                }
                res.add(
                    SpacingRequirement(
                        infra.getZoneName(zone),
                        entry.startTime.seconds,
                        entry.endTime.seconds,
                        true
                    )
                )
            }
        }
    }
    return res
}
