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
import fr.sncf.osrd.stdcm.STDCMStep
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
    val incrementalConflictDetector: IncrementalConflictDetector,
    val plannedSteps: List<STDCMStep>,
    val gridMarginBeforeTrain: Double,
    val gridMarginAfterTrain: Double,
    val internalMarginForSteps: Double,
) : BlockAvailabilityInterface {

    override fun getAvailability(
        infraExplorer: InfraExplorerWithEnvelope,
        startOffset: Offset<Path>,
        endOffset: Offset<Path>,
        startTime: Double
    ): BlockAvailabilityInterface.Availability {
        var timeShift = 0.0
        var firstConflictOffset: Offset<TravelledPath>? = null
        val defaultOffset = infraExplorer.getIncrementalPath().toTravelledPath(startOffset)
        while (timeShift.isFinite()) {
            val shiftedStartTime = startTime + timeShift
            val pathStartTime =
                shiftedStartTime - infraExplorer.interpolateDepartureFromClamp(startOffset)
            val endTime = infraExplorer.interpolateDepartureFromClamp(endOffset) + pathStartTime

            val stepAvailability =
                getStepAvailability(infraExplorer, startOffset, endOffset, pathStartTime)
            val conflictAvailability =
                getConflictAvailability(
                    infraExplorer,
                    startOffset,
                    pathStartTime,
                    shiftedStartTime,
                    endTime
                )
            val availability =
                getMostRestrictiveAvailability(stepAvailability, conflictAvailability)

            when (availability) {
                is BlockAvailabilityInterface.Available -> {
                    if (
                        timeShift > 0.0
                    ) { // Availability is available due to adding a delay: timeShift
                        return BlockAvailabilityInterface.Unavailable(
                            timeShift,
                            firstConflictOffset ?: defaultOffset
                        )
                    }
                    // Availability is directly available without adding any delay
                    return availability
                }
                is BlockAvailabilityInterface.Unavailable -> {
                    timeShift += availability.duration

                    // Only update the conflict offset if it hasn't been set
                    firstConflictOffset = firstConflictOffset ?: availability.firstConflictOffset
                }
            }
        }
        // No available solution with a finite delay was found
        return BlockAvailabilityInterface.Unavailable(
            Double.POSITIVE_INFINITY,
            firstConflictOffset ?: defaultOffset
        )
    }

    /**
     * Check that the planned step timing data is respected, i.e. time in
     * [arrivalTime - toleranceBefore - internalMargin, arrivalTime + toleranceAfter + internalMargin].
     * Return the corresponding availability.
     * - If some steps are not respected, find the minimumDelayToBecomeAvailable (subtracting the
     *   internal margin) and return Unavailable(minimumDelayToBecomeAvailable, ...). In case this
     *   delay fails other steps, return Unavailable(Infinity, ...).
     * - If all steps are respected, find the maximumDelayToStayAvailable (adding the internal
     *   margin) and return Available(maximumDelayToStayAvailable, ...).
     */
    private fun getStepAvailability(
        infraExplorer: InfraExplorerWithEnvelope,
        startOffset: Offset<Path>,
        endOffset: Offset<Path>,
        pathStartTime: Double,
    ): BlockAvailabilityInterface.Availability {
        var minimumDelayToBecomeAvailable = 0.0
        var firstUnavailabilityOffset = Offset<TravelledPath>(Double.POSITIVE_INFINITY.meters)
        var maximumDelayToStayAvailable = Double.POSITIVE_INFINITY
        var timeOfNextUnavailability = Double.POSITIVE_INFINITY

        for (step in plannedSteps) {
            val availabilityProperties =
                getStepAvailabilityProperties(
                    step,
                    infraExplorer,
                    startOffset,
                    endOffset,
                    pathStartTime
                )
            if (availabilityProperties.minimumDelayToBecomeAvailable == Double.POSITIVE_INFINITY) {
                return BlockAvailabilityInterface.Unavailable(
                    Double.POSITIVE_INFINITY,
                    availabilityProperties.firstUnavailabilityOffset
                )
            } else if (
                availabilityProperties.minimumDelayToBecomeAvailable > minimumDelayToBecomeAvailable
            ) {
                minimumDelayToBecomeAvailable = availabilityProperties.minimumDelayToBecomeAvailable
                firstUnavailabilityOffset = availabilityProperties.firstUnavailabilityOffset
            } else if (
                availabilityProperties.maximumDelayToStayAvailable < maximumDelayToStayAvailable
            ) {
                maximumDelayToStayAvailable = availabilityProperties.maximumDelayToStayAvailable
                timeOfNextUnavailability = availabilityProperties.timeOfNextUnavailability
            }
        }
        if (minimumDelayToBecomeAvailable > 0.0) { // At least one planned step was not respected
            if (minimumDelayToBecomeAvailable > maximumDelayToStayAvailable) {
                // Adding minimumDelayToBecomeAvailable will make us step out of another planned
                // step
                return BlockAvailabilityInterface.Unavailable(
                    Double.POSITIVE_INFINITY,
                    firstUnavailabilityOffset
                )
            }
            // Adding minimumDelayToBecomeAvailable solves every planned step problem
            return BlockAvailabilityInterface.Unavailable(
                minimumDelayToBecomeAvailable,
                firstUnavailabilityOffset
            )
        }
        // Every planned step was respected
        return BlockAvailabilityInterface.Available(
            maximumDelayToStayAvailable,
            timeOfNextUnavailability
        )
    }

    private fun getStepAvailabilityProperties(
        step: STDCMStep,
        infraExplorer: InfraExplorerWithEnvelope,
        startOffset: Offset<Path>,
        endOffset: Offset<Path>,
        pathStartTime: Double
    ): AvailabilityProperties {
        val incrementalPath = infraExplorer.getIncrementalPath()
        // Iterate over all the predecessor blocks + current block
        // Iterate backwards, as the range is generally towards the end
        for (i in incrementalPath.blockCount - 1 downTo 0) {
            val block = incrementalPath.getBlock(i)

            // Discard lookahead blocks
            if (infraExplorer.getLookahead().toList().contains(block)) {
                continue
            }

            val blockStartOffset = incrementalPath.getBlockStartOffset(i)
            val blockEndOffset = incrementalPath.getBlockEndOffset(i)

            // Discard blocks fully outside the range
            if (blockStartOffset > endOffset) {
                // The considered range is further back in the path
                continue
            }
            if (blockEndOffset < startOffset) {
                // We're outside the considered range and can stop there
                break
            }
            for (location in step.locations) {
                if (location.edge != incrementalPath.getBlock(i)) {
                    continue
                }
                // Only consider the blocks within the range formed by given offsets
                // (including step location here)
                if (blockStartOffset + location.offset.distance !in startOffset..endOffset) {
                    continue
                }
                val stepOffsetOnPath =
                    incrementalPath.getBlockStartOffset(i) + location.offset.distance
                val timeAtStep =
                    infraExplorer.interpolateDepartureFromClamp(stepOffsetOnPath) + pathStartTime
                val plannedMinTimeAtStep =
                    (step.plannedTimingData!!.arrivalTime -
                            step.plannedTimingData.arrivalTimeToleranceBefore)
                        .seconds - internalMarginForSteps
                val plannedMaxTimeAtStep =
                    (step.plannedTimingData.arrivalTime +
                            step.plannedTimingData.arrivalTimeToleranceAfter)
                        .seconds + internalMarginForSteps
                if (plannedMinTimeAtStep > timeAtStep) {
                    // Train passes through planned timing data before it is available
                    return AvailabilityProperties(
                        max(plannedMinTimeAtStep - timeAtStep, 0.0),
                        incrementalPath.toTravelledPath(stepOffsetOnPath),
                        0.0,
                        0.0
                    )
                } else if (timeAtStep > plannedMaxTimeAtStep) {
                    // Train passes through planned timing data after it is available:
                    // block is forever unavailable
                    return AvailabilityProperties(
                        Double.POSITIVE_INFINITY,
                        incrementalPath.toTravelledPath(stepOffsetOnPath),
                        0.0,
                        0.0
                    )
                }
                // Planned timing data respected
                return AvailabilityProperties(
                    0.0,
                    Offset(0.meters),
                    plannedMaxTimeAtStep - timeAtStep,
                    plannedMaxTimeAtStep
                )
            }
        }
        return AvailabilityProperties(
            0.0,
            Offset(0.meters),
            Double.POSITIVE_INFINITY,
            Double.POSITIVE_INFINITY
        )
    }

    /** Check the conflicts on the given path and return the corresponding availability. */
    private fun getConflictAvailability(
        infraExplorer: InfraExplorerWithEnvelope,
        startOffset: Offset<Path>,
        pathStartTime: Double,
        startTime: Double,
        endTime: Double
    ): BlockAvailabilityInterface.Availability {
        val needFullRequirements = startOffset < infraExplorer.getPredecessorLength()
        val spacingRequirements =
            if (needFullRequirements) infraExplorer.getFullSpacingRequirements()
            else infraExplorer.getSpacingRequirements()

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
     * Given 2 availabilities, return the most restrictive one:
     * - Unavailable > Available
     * - both are unavailable: take the one with the highest duration necessary to become available
     * - both are available: take the one with the lowest duration necessary to become unavailable
     */
    private fun getMostRestrictiveAvailability(
        firstAvailability: BlockAvailabilityInterface.Availability,
        secondAvailability: BlockAvailabilityInterface.Availability
    ): BlockAvailabilityInterface.Availability {
        when {
            firstAvailability is BlockAvailabilityInterface.Unavailable &&
                secondAvailability is BlockAvailabilityInterface.Unavailable -> {
                if (firstAvailability.duration >= secondAvailability.duration)
                    return firstAvailability
                return secondAvailability
            }
            firstAvailability is BlockAvailabilityInterface.Available &&
                secondAvailability is BlockAvailabilityInterface.Available -> {
                if (firstAvailability.maximumDelay <= secondAvailability.maximumDelay)
                    return firstAvailability
                return secondAvailability
            }
            firstAvailability is BlockAvailabilityInterface.Unavailable &&
                secondAvailability is BlockAvailabilityInterface.Available -> {
                return firstAvailability
            }
            else -> {
                return secondAvailability
            }
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

private data class AvailabilityProperties(
    // If a resource is unavailable, minimum delay that should be added to the train to become
    // available
    val minimumDelayToBecomeAvailable: Double,
    // If a resource is unavailable, offset of that resource
    val firstUnavailabilityOffset: Offset<TravelledPath>,
    // If everything is available, maximum delay that can be added to the train without a resource
    // becoming unavailable
    val maximumDelayToStayAvailable: Double,
    // If everything is available, minimum begin time of the next resource that could become
    // unavailable
    val timeOfNextUnavailability: Double
)

fun makeBlockAvailability(
    infra: FullInfra,
    requirements: Collection<SpacingRequirement>,
    workSchedules: Collection<WorkSchedule> = listOf(),
    steps: List<STDCMStep> = listOf(),
    gridMarginBeforeTrain: Double = 0.0,
    gridMarginAfterTrain: Double = 0.0,
    timeStep: Double = 2.0,
): BlockAvailabilityInterface {
    // Merge work schedules into train requirements
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

    // Only keep steps with planned timing data
    val plannedSteps = steps.filter { it.plannedTimingData != null }
    return BlockAvailability(
        incrementalConflictDetector(trainRequirements),
        plannedSteps,
        gridMarginBeforeTrain,
        gridMarginAfterTrain,
        timeStep
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
