package fr.sncf.osrd.conflicts

import fr.sncf.osrd.signaling.SignalingSimulator
import fr.sncf.osrd.signaling.SignalingTrainState
import fr.sncf.osrd.signaling.ZoneStatus
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.Speed
import fr.sncf.osrd.utils.units.metersPerSecond
import kotlin.math.min
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
        for (i in 0 until incrementalPath.endZonePathIndex) {
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
            if (unprotectedReqTime.isFinite()) { // The train may not even reach the zone
                addZonePendingRequirement(unprotectedZoneIndex, unprotectedReqTime)
            }
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

    // Returns true if the zone is required to be clear for the signal to not be constraining.
    // Returns false if it's either not required, or we need a longer block path to tell.
    private fun isZoneIndexRequiredForSignal(
        probedZoneIndex: Int,
        pathSignal: PathSignal,
        routes: List<RouteId>,
        trainState: SignalingTrainState
    ): Boolean {
        val firstBlockIndex = pathSignal.minBlockPathIndex

        // List of blocks to include in the simulator call
        val blocks = mutableStaticIdxArrayListOf(incrementalPath.getBlock(firstBlockIndex))

        // Index of the first zone included in the block path,
        // used to properly index the zone state array
        val firstSimulatedZone = incrementalPath.getBlockStartZone(firstBlockIndex)

        // Number of zones included in the block path
        var nSimulatedZones = blockInfra.getBlockPath(blocks[0]).size

        // Add blocks in the block path until the probed zone is covered
        while (probedZoneIndex - firstSimulatedZone + 1 > nSimulatedZones) {
            if (firstBlockIndex + blocks.size >= incrementalPath.endBlockIndex) {
                // exiting, the end of the block path has been reached
                return false
            }
            val newBlock = incrementalPath.getBlock(firstBlockIndex + blocks.size)
            blocks.add(newBlock)
            nSimulatedZones += blockInfra.getBlockPath(newBlock).size
        }

        val zoneStates = MutableList(nSimulatedZones) { ZoneStatus.CLEAR }
        zoneStates[probedZoneIndex - firstSimulatedZone] = ZoneStatus.OCCUPIED
        val simulatedSignalStates =
            simulator.evaluate(
                rawInfra,
                loadedSignalInfra,
                blockInfra,
                blocks,
                routes,
                blocks.size,
                zoneStates,
                ZoneStatus.OCCUPIED
            )
        val signalState = simulatedSignalStates[pathSignal.signal]!!

        return simulator.sigModuleManager.isConstraining(
            loadedSignalInfra.getSignalingSystem(pathSignal.signal),
            signalState,
            trainState
        )
    }

    // Returns the index of the first zone that isn't required for the given signal,
    // or null if we need more path to determine it
    private fun findFirstNonRequiredZoneIndex(pathSignal: PathSignal, routes: List<RouteId>, trainState: SignalingTrainState): Int? {
        // We are looking for the index `i` where `isZoneIndexRequiredForSignal` returns
        // true at `i-1` and false at `i`. We could just iterate starting at 0, but
        // because `i` is not that small (20 on average) and the signaling
        // simulation calls are expensive, we prefer an approach similar to
        // a binary-search

        // The values here are determined empirically on imported infrastructures,
        // the solutions mostly follow a gaussian distribution centered
        // on start+20 that rarely exceeds start+40.
        // We run a binary search on that range, and iterate one by one when the solution is above.
        var lowerBound = getSignalProtectedZone(pathSignal)
        val initialUpperBound = min(lowerBound + 40, incrementalPath.endZonePathIndex)
        var upperBound = initialUpperBound

        // Main loop, binary search
        while (true) {
            if (lowerBound == upperBound) break
            val probedZoneIndex = (upperBound + lowerBound) / 2
            val required = isZoneIndexRequiredForSignal(probedZoneIndex, pathSignal, routes, trainState)
            if (required) {
                lowerBound = probedZoneIndex + 1
            } else {
                upperBound = probedZoneIndex
            }
        }

        // Handle the case where the result is higher than the initial upper bound
        while (
            lowerBound >= initialUpperBound &&
                isZoneIndexRequiredForSignal(lowerBound, pathSignal, routes, trainState)
        ) lowerBound++

        // Check if more path is needed for a valid solution
        // (i.e. the first zone that is not required is out of bounds)
        if (
            lowerBound >= incrementalPath.getBlockEndZone(incrementalPath.endBlockIndex - 1) &&
            !incrementalPath.pathComplete
        ) {
            return null
        }
        return lowerBound
    }

    fun processPathUpdate(): SpacingResourceUpdate {
        // process newly added path data
        registerPathExtension()
        // initialize requirements which only apply before the train sees any signal
        setupInitialRequirements()

        val routes = incrementalPath.routes.toList()

        // for all signals, update zone requirement times until a signal is found for which
        // more path is needed
        while (pendingSignals.isNotEmpty()) {
            val pathSignal = pendingSignals.first()
            val physicalSignal = loadedSignalInfra.getPhysicalSignal(pathSignal.signal)

            // figure out when the signal is first seen
            val signalOffset = incrementalPath.toTravelledPath(pathSignal.pathOffset)
            val sightOffset = signalOffset - rawInfra.getSignalSightDistance(physicalSignal)
            // If the train's simulation has reached the point where the signal is seen, bail out
            if (callbacks.currentPathOffset <= sightOffset) {
                break
            }
            val sightTime = callbacks.arrivalTimeInRange(sightOffset, signalOffset)
            assert(sightTime.isFinite())

            // Build the train state. We need to have the position of the next signal or to have a complete path.
            val nextSignalOffset = if (pendingSignals.size > 1) {
                incrementalPath.toTravelledPath(pendingSignals[1].pathOffset)
            } else if (incrementalPath.pathComplete) {
                incrementalPath.toTravelledPath(incrementalPath.travelledPathEnd)
            } else {
                return NotEnoughPath
            }
            val maxSpeedInSignalArea = callbacks.maxSpeedInRange(sightOffset, nextSignalOffset)

            class SignalingTrainStateImpl(override val speed: Speed) : SignalingTrainState
            val trainState = SignalingTrainStateImpl(speed = maxSpeedInSignalArea.metersPerSecond)

            // Find the first and last zone required by the signal
            val firstRequiredZone = getSignalProtectedZone(pathSignal)
            val firstNonRequiredZone =
                findFirstNonRequiredZoneIndex(pathSignal, routes, trainState) ?: return NotEnoughPath
            for (i in firstRequiredZone until firstNonRequiredZone) {
                addSignalRequirements(firstRequiredZone, i, sightTime)
            }

            pendingSignals.removeFirst()
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
        val res =
            SpacingRequirementAutomaton(
                this.rawInfra,
                this.loadedSignalInfra,
                this.blockInfra,
                this.simulator,
                this.callbacks.clone(),
                this.incrementalPath.clone()
            )
        res.nextProcessedBlock = nextProcessedBlock
        res.lastEmittedZone = lastEmittedZone
        res.pendingSignals.addAll(pendingSignals)
        res.pendingRequirements.addAll(pendingRequirements)
        return res
    }
}

sealed interface SpacingResourceUpdate

data class SpacingRequirements(val requirements: List<SpacingRequirement>) : SpacingResourceUpdate

data object NotEnoughPath : SpacingResourceUpdate
