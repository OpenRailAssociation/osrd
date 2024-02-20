package fr.sncf.osrd.stdcm.preprocessing.implementation

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.conflicts.IncrementalConflictDetector
import fr.sncf.osrd.envelope_utils.DoubleBinarySearch
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import kotlin.math.max
import kotlin.math.min

data class BlockAvailability(
    val fullInfra: FullInfra,
    val incrementalConflictDetector: IncrementalConflictDetector
) : BlockAvailabilityInterface {

    override fun getAvailability(
        infraExplorer: InfraExplorerWithEnvelope,
        startOffset: Offset<Path>,
        endOffset: Offset<Path>,
        startTime: Double
    ): BlockAvailabilityInterface.Availability {
        val spacingRequirements = infraExplorer.getSpacingRequirements()
        val pathStartTime = startTime - infraExplorer.interpolateTimeClamp(startOffset)
        val endTime = infraExplorer.interpolateTimeClamp(endOffset) + pathStartTime
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
        if (conflicts.isEmpty()) {
            val maximumDelay =
                incrementalConflictDetector.maxDelayWithoutConflicts(
                    shiftedSpacingRequirements,
                    listOf()
                )
            val timeOfNextConflict =
                incrementalConflictDetector.timeOfNextConflict(shiftedSpacingRequirements, listOf())
            return BlockAvailabilityInterface.Available(maximumDelay, timeOfNextConflict)
        } else {
            val minimumDelay =
                incrementalConflictDetector.minDelayWithoutConflicts(
                    shiftedSpacingRequirements,
                    listOf()
                )
            val firstConflictOffset =
                getEnvelopeOffsetFromTime(
                    infraExplorer,
                    conflicts.first().startTime - pathStartTime
                )
            return BlockAvailabilityInterface.Unavailable(minimumDelay, firstConflictOffset)
        }
    }

    /**
     * Turns a time into an offset on an envelope with a binary search. Can be optimized if needed.
     */
    private fun getEnvelopeOffsetFromTime(
        explorer: InfraExplorerWithEnvelope,
        time: Double
    ): Offset<Path> {
        val envelope = explorer.getFullEnvelope()
        val search = DoubleBinarySearch(envelope.beginPos, envelope.endPos, time, 2.0, false)
        while (!search.complete()) search.feedback(envelope.interpolateTotalTimeClamp(search.input))
        return explorer
            .getIncrementalPath()
            .fromTravelledPath(Offset(Distance.fromMeters(search.result)))
    }
}
