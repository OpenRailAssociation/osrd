package fr.sncf.osrd.stdcm.preprocessing.implementation

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.conflicts.IncrementalConflictDetector
import fr.sncf.osrd.conflicts.TrainRequirements
import fr.sncf.osrd.conflicts.TravelledPath
import fr.sncf.osrd.conflicts.incrementalConflictDetector
import fr.sncf.osrd.envelope_utils.DoubleBinarySearch
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.math.max
import kotlin.math.min

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
        val pathStartTime = startTime - infraExplorer.interpolateTimeClamp(startOffset)
        val endTime = infraExplorer.interpolateTimeClamp(endOffset) + pathStartTime

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
            search.feedback(envelope.interpolateTotalTimeClamp(search.input))
        }
        return Offset(Distance.fromMeters(value))
    }
}

fun makeBlockAvailability(
    infra: FullInfra,
    requirements: Collection<SpacingRequirement>,
    gridMarginBeforeTrain: Double = 0.0,
    gridMarginAfterTrain: Double = 0.0,
): BlockAvailabilityInterface {
    var reqWithGridMargin = requirements
    if (gridMarginAfterTrain != 0.0 || gridMarginBeforeTrain != 0.0) {
        // The margin expected *after* the new train is added *before* the other train resource uses
        reqWithGridMargin =
            requirements.map {
                SpacingRequirement(
                    it.zone,
                    it.beginTime - gridMarginAfterTrain,
                    it.endTime + gridMarginBeforeTrain,
                    it.isComplete
                )
            }
    }
    val trainRequirements = listOf(TrainRequirements(0L, reqWithGridMargin, listOf()))
    return BlockAvailability(
        infra,
        incrementalConflictDetector(trainRequirements),
        gridMarginBeforeTrain,
        gridMarginAfterTrain,
    )
}
