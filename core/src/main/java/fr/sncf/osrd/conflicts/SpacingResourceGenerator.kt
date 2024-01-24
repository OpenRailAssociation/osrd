package fr.sncf.osrd.conflicts

import fr.sncf.osrd.signaling.SignalingSimulator
import fr.sncf.osrd.signaling.ZoneStatus
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.Offset
import mu.KotlinLogging

private val logger = KotlinLogging.logger {}

/*
 * ```
 *         zone occupied                  Y           Y
 *  explicit requirement                              Y         Y
 *     needs requirement                  Y           Y         Y
 *               signals          ┎o         ┎o         ┎o         ┎o         ┎o         ┎o
 *           signal seen                     Y
 *                 zones   +---------|----------|----------|----------|----------|----------|
 *            train path                ============
 *                 phase    headroom    begin      main        end          tailroom
 * ```
 *
 * We have to emit implicit requirements for all zones between and including those occupied by the train
 * when it starts, and the first zone required by signaling.
 */

data class PendingSpacingRequirement(
    val zoneIndex: Int,
    val zoneEntryOffset: Offset<Path>,
    val zoneExitOffset: Offset<Path>,
    val beginTime: Double
)

class SpacingRequirementAutomaton(
    // context
    val rawInfra: RawInfra,
    val loadedSignalInfra: LoadedSignalInfra,
    val blockInfra: BlockInfra,
    val simulator: SignalingSimulator,
    var callbacks: IncrementalRequirementCallbacks, // Not read-only to be updated along the path
    var incrementalPath: IncrementalPath, // Not read-only to be updated along the path
) {
    private var nextProcessedBlock = 0

    // last zone for which a requirement was emitted
    private var lastEmittedZone = -1

    // last zone whose occupancy was tested with the current pending signal
    // when a new signal starts processing, this value is initialized to the zone immediately after
    // it
    private var nextProbedZoneForSignal = -1

    // the queue of signals awaiting processing
    private val pendingSignals = ArrayDeque<PathSignal>()

    // requirements that need to be returned on the next successful pathUpdate
    private val pendingRequirements = ArrayDeque<PendingSpacingRequirement>()

    private fun registerPathExtension() {
        // if the path has not yet started, skip signal processing
        if (!incrementalPath.pathStarted) {
            nextProcessedBlock = incrementalPath.endBlockIndex
            return
        }

        // queue signals
        for (blockIndex in nextProcessedBlock until incrementalPath.endBlockIndex) {
            val block = incrementalPath.getBlock(blockIndex)
            val signals = blockInfra.getBlockSignals(block)
            val signalBlockPositions = blockInfra.getSignalsPositions(block)
            for (signalBlockIndex in 0 until signals.size) {
                val signal = signals[signalBlockIndex]
                val signalBlockPosition = signalBlockPositions[signalBlockIndex]
                // skip block transition signals
                if (
                    signalBlockIndex == 0 &&
                        pendingSignals.isNotEmpty() &&
                        pendingSignals.last().signal == signal
                )
                    continue

                val signalPathOffset =
                    incrementalPath.convertBlockOffset(blockIndex, signalBlockPosition)
                // skip signals outside the path
                if (signalPathOffset < incrementalPath.travelledPathBegin) continue
                if (
                    incrementalPath.pathComplete &&
                        signalPathOffset >= incrementalPath.travelledPathEnd
                )
                    continue
                pendingSignals.addLast(PathSignal(signal, signalPathOffset, blockIndex))
            }
        }
        nextProcessedBlock = incrementalPath.endBlockIndex
    }

    private fun addZonePendingRequirement(zoneIndex: Int, zoneRequirementTime: Double) {
        assert(zoneRequirementTime.isFinite())
        val zoneEntryOffset = incrementalPath.getZonePathStartOffset(zoneIndex)
        val zoneExitOffset = incrementalPath.getZonePathEndOffset(zoneIndex)
        val req =
            PendingSpacingRequirement(
                zoneIndex,
                zoneEntryOffset,
                zoneExitOffset,
                zoneRequirementTime
            )
        pendingRequirements.add(req)
    }

    private fun getSignalProtectedZone(signal: PathSignal): Int {
        // the signal protects all zone inside the block
        // if a signal is at a block boundary,
        return incrementalPath.getBlockEndZone(signal.minBlockPathIndex)
    }

    // create requirements for zones occupied by the train at the beginning of the simulation
    private fun setupInitialRequirements() {
        if (lastEmittedZone != -1) return

        // look for the zone which contains the train as it starts.
        // when the simulation starts, the train occupies a single point on the tracks, as if it
        // were contained
        // inside a magic portal until the train entirely moved out of it
        var startZone = -1
        val startingPoint = incrementalPath.travelledPathBegin
        for (i in incrementalPath.beginZonePathIndex until incrementalPath.endZonePathIndex) {
            val zonePathStartOffset = incrementalPath.getZonePathStartOffset(i)
            val zonePathEndOffset = incrementalPath.getZonePathEndOffset(i)
            if (startingPoint >= zonePathStartOffset && startingPoint < zonePathEndOffset) {
                startZone = i
                break
            }
        }

        assert(startZone != -1)
        // the simulation start time is 0)
        addZonePendingRequirement(startZone, 0.0)
        lastEmittedZone = startZone
    }

    private fun addSignalRequirements(beginZoneIndex: Int, endZoneIndex: Int, sightTime: Double) {
        if (endZoneIndex <= lastEmittedZone) return

        // emit requirements for unprotected zones, which are between the last required zone and the
        // first zone required by this signal. This is sometimes somewhat fine, such as at the
        // beginning of a simulation
        for (unprotectedZoneIndex in lastEmittedZone + 1 until beginZoneIndex) {
            val zoneEntryOffset =
                incrementalPath.toTravelledPath(
                    incrementalPath.getZonePathStartOffset(unprotectedZoneIndex)
                )
            val zoneExitOffset =
                incrementalPath.toTravelledPath(
                    incrementalPath.getZonePathEndOffset(unprotectedZoneIndex)
                )
            val unprotectedReqTime = callbacks.arrivalTimeInRange(zoneEntryOffset, zoneExitOffset)
            // TODO: emit a warning message if the unprotected zone is after the first processed
            // signal
            addZonePendingRequirement(unprotectedZoneIndex, unprotectedReqTime)
            lastEmittedZone = unprotectedZoneIndex
        }

        // emit requirements for zones protected by this signal
        for (requiredZoneIndex in
            lastEmittedZone + 1 until endZoneIndex + 1) addZonePendingRequirement(
            requiredZoneIndex,
            sightTime
        )
        lastEmittedZone = endZoneIndex
    }

    fun processPathUpdate(): SpacingResourceUpdate {
        // process newly added path data
        registerPathExtension()
        // initialize requirements which only apply before the train sees any signal
        setupInitialRequirements()

        val blocks = mutableStaticIdxArrayListOf<Block>()
        for (blockIndex in
            incrementalPath.beginBlockIndex until incrementalPath.endBlockIndex) blocks.add(
            incrementalPath.getBlock(blockIndex)
        )

        // there may be more zone states than what's contained in the path's blocks, which shouldn't
        // matter
        val zoneStartIndex = incrementalPath.getBlockStartZone(incrementalPath.beginBlockIndex)
        val zoneEndIndex = incrementalPath.getBlockEndZone(incrementalPath.endBlockIndex - 1)
        val zoneCount = zoneEndIndex - zoneStartIndex
        val zoneStates = MutableList(zoneCount) { ZoneStatus.CLEAR }

        // for all signals, update zone requirement times until a signal is found for which
        // more path is needed
        signalLoop@ while (pendingSignals.isNotEmpty()) {
            val pathSignal = pendingSignals.first()
            val physicalSignal = loadedSignalInfra.getPhysicalSignal(pathSignal.signal)

            // figure out when the signal is first seen
            val signalOffset = incrementalPath.toTravelledPath(pathSignal.pathOffset)
            val sightOffset = signalOffset - rawInfra.getSignalSightDistance(physicalSignal)
            // If the train's simulation has reached the point where the signal is seen, bail out
            if (
                callbacks.currentPathOffset < sightOffset &&
                    !(callbacks.simulationComplete && incrementalPath.pathComplete)
            )
                break@signalLoop
            val sightTime = callbacks.arrivalTimeInRange(sightOffset, signalOffset)
            assert(sightTime.isFinite())
            val signalProtectedZone = getSignalProtectedZone(pathSignal)

            if (nextProbedZoneForSignal == -1) nextProbedZoneForSignal = signalProtectedZone

            // find the first zone after the signal which can be occupied without disturbing the
            // train
            zoneProbingLoop@ while (true) {
                // if we reached the last zone, just quit
                if (nextProbedZoneForSignal == zoneEndIndex) {
                    if (incrementalPath.pathComplete) break@zoneProbingLoop
                    return NotEnoughPath
                }
                val zoneIndex = nextProbedZoneForSignal++

                // find the index of this signal's block in the block array
                val currentBlockOffset =
                    pathSignal.minBlockPathIndex - incrementalPath.beginBlockIndex
                assert(
                    blocks[currentBlockOffset] ==
                        incrementalPath.getBlock(pathSignal.minBlockPathIndex)
                )
                zoneStates[zoneIndex - zoneStartIndex] = ZoneStatus.OCCUPIED
                val simulatedSignalStates =
                    simulator.evaluate(
                        rawInfra,
                        loadedSignalInfra,
                        blockInfra,
                        blocks,
                        0,
                        blocks.size,
                        zoneStates,
                        ZoneStatus.CLEAR
                    )
                zoneStates[zoneIndex - zoneStartIndex] = ZoneStatus.CLEAR
                val signalState = simulatedSignalStates[pathSignal.signal]!!

                // FIXME: Have a better way to check if the signal is constraining
                if (signalState.getEnum("aspect") == "VL") break
                addSignalRequirements(signalProtectedZone, zoneIndex, sightTime)
            }
            pendingSignals.removeFirst()
            nextProbedZoneForSignal = -1
        }

        // serialize requirements and find the index of the first incomplete requirement
        var firstIncompleteReq = pendingRequirements.size
        val serializedRequirements =
            pendingRequirements.mapIndexed { index, pendingSpacingRequirement ->
                val serializedReq = serializeRequirement(pendingSpacingRequirement)
                if (!serializedReq.isComplete && index < firstIncompleteReq)
                    firstIncompleteReq = index
                serializedReq
            }

        // remove complete requirements
        for (i in 0 until firstIncompleteReq) pendingRequirements.removeFirst()

        return SpacingRequirements(serializedRequirements)
    }

    private fun serializeRequirement(
        pendingRequirement: PendingSpacingRequirement
    ): SpacingRequirement {
        val zonePath = incrementalPath.getZonePath(pendingRequirement.zoneIndex)
        val zone = rawInfra.getZonePathZone(zonePath)
        val zoneName = rawInfra.getZoneName(zone)
        val zoneEntryOffset =
            incrementalPath.toTravelledPath(
                incrementalPath.getZonePathStartOffset(pendingRequirement.zoneIndex)
            )
        val zoneExitOffset =
            incrementalPath.toTravelledPath(
                incrementalPath.getZonePathEndOffset(pendingRequirement.zoneIndex)
            )
        val departureTime = callbacks.departureTimeFromRange(zoneEntryOffset, zoneExitOffset)

        // three cases, to be evaluated **in order**:
        // - (COMPLETE) the train left the zone (endTime = time the train left the zone)
        // - (COMPLETE) the simulation has ended (endTime = simulation end time)
        // - (INCOMPLETE) the train hasn't left the zone yet (endTime = currentTime)
        val endTime: Double
        val isComplete: Boolean
        if (departureTime.isFinite()) {
            endTime = departureTime
            isComplete = true
        } else {
            endTime = callbacks.currentTime
            isComplete = callbacks.simulationComplete
        }

        return SpacingRequirement(
            zoneName,
            pendingRequirement.beginTime,
            endTime,
            isComplete,
        )
    }

    fun clone(): SpacingRequirementAutomaton {
        TODO("Not yet implemented")
    }
}

sealed interface SpacingResourceUpdate

data class SpacingRequirements(val requirements: List<SpacingRequirement>) : SpacingResourceUpdate

data object NotEnoughPath : SpacingResourceUpdate
