package fr.sncf.osrd.conflicts

import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.etcs.BrakingType.IND
import fr.sncf.osrd.envelope_sim.etcs.ETCSBrakingSimulator
import fr.sncf.osrd.envelope_sim.etcs.ETCSBrakingSimulatorImpl
import fr.sncf.osrd.envelope_sim.etcs.EoaType
import fr.sncf.osrd.path.interfaces.BlockPath
import fr.sncf.osrd.signaling.SignalingSimulator
import fr.sncf.osrd.signaling.SignalingTrainState
import fr.sncf.osrd.signaling.ZoneStatus
import fr.sncf.osrd.signaling.etcs_level2.ETCS_LEVEL2
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.standalone_sim.CLOSED_SIGNAL_RESERVATION_MARGIN
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.Speed
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.metersPerSecond
import kotlin.math.min
import mu.KotlinLogging

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

val logger = KotlinLogging.logger {}

data class PendingSpacingRequirement(
    val zoneIndex: Int,
    val zoneEntryOffset: Offset<BlockPath>,
    val zoneExitOffset: Offset<BlockPath>,
    val beginTime: Double,
)

data class ProcessedStop(
    val offset: Offset<BlockPath>,
    val nextBlockIdx: Int,
    val nextZoneIdx: Int,
)

class SpacingRequirementAutomaton(
    // context
    val rawInfra: RawInfra,
    val loadedSignalInfra: LoadedSignalInfra,
    val blockInfra: BlockInfra,
    val simulator: SignalingSimulator,
    var callbacks: IncrementalRequirementCallbacks, // Not read-only to be updated along the path
    var incrementalPath: IncrementalPath, // Not read-only to be updated along the path
    // TODO: Required for ETCS (STDCM doesn't provide it currently, will have to eventually)
    val context: EnvelopeSimContext? = null,
) {
    private var nextProcessedBlock = 0

    // last zone for which a requirement was emitted
    private var lastEmittedZone = -1

    // the queue of signals awaiting processing
    private val pendingSignals = ArrayDeque<PathSignal>()

    // requirements that need to be returned on the next successful pathUpdate
    private val pendingRequirements = ArrayDeque<PendingSpacingRequirement>()

    private var nextStopToProcess = 0
    private var processedStops = ArrayDeque<ProcessedStop>()

    private fun registerPathExtension() {
        // if the path has not yet started, skip signal processing
        if (!incrementalPath.pathStarted) {
            nextProcessedBlock = incrementalPath.blockCount
            return
        }

        // queue signals
        for (blockIndex in nextProcessedBlock until incrementalPath.blockCount) {
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

            val blockEndOffset = incrementalPath.getBlockEndOffset(blockIndex)
            val nextZoneIdx = incrementalPath.getBlockEndZone(blockIndex)
            while (incrementalPath.stopCount > nextStopToProcess) {
                val stopOffset = incrementalPath.getStopOffset(nextStopToProcess)
                if (stopOffset >= blockEndOffset) break
                if (!incrementalPath.isStopOnClosedSignal(nextStopToProcess)) {
                    nextStopToProcess++
                    continue
                }
                processedStops.add(ProcessedStop(stopOffset, blockIndex + 1, nextZoneIdx))
                nextStopToProcess++
            }
        }
        nextProcessedBlock = incrementalPath.blockCount
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
                zoneRequirementTime,
            )
        pendingRequirements.add(req)
    }

    private fun getSignalFirstProtectedZone(signal: PathSignal): Int {
        // the signal protects all zone inside the block
        // if a signal is at a block boundary,
        return incrementalPath.getBlockEndZone(signal.minBlockPathIndex)
    }

    private fun getSignalFirstProtectedBlockLastZone(signal: PathSignal): Int {
        if (signal.minBlockPathIndex >= incrementalPath.blockCount) {
            return incrementalPath.zonePathCount - 1
        }
        return incrementalPath.getBlockEndZone(signal.minBlockPathIndex + 1) - 1
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
        for (i in 0 until incrementalPath.zonePathCount) {
            val zonePathStartOffset = incrementalPath.getZonePathStartOffset(i)
            val zonePathEndOffset = incrementalPath.getZonePathEndOffset(i)
            if (startingPoint >= zonePathStartOffset && startingPoint < zonePathEndOffset) {
                startZone = i
                break
            }
        }
        assert(startZone != -1)

        // We need to add a requirement for each zone between the start
        // and the first required zone
        val firstSignal = pendingSignals.firstOrNull()
        val firstProtectedZone =
            if (firstSignal != null) {
                getSignalFirstProtectedZone(firstSignal)
            } else {
                startZone + 1
            }

        for (i in startZone until firstProtectedZone) {
            // The simulation start time is 0.
            // The zones are not all reached right at the start, but
            // because they're part of the block the train starts on,
            // they can be considered as "required" from the beginning.
            addZonePendingRequirement(i, 0.0)
            lastEmittedZone = i
        }
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
        for (requiredZoneIndex in lastEmittedZone + 1..endZoneIndex) {
            addZonePendingRequirement(requiredZoneIndex, sightTime)
        }
        lastEmittedZone = endZoneIndex
    }

    // Returns true if the zone is required to be clear for the signal to not be constraining.
    // Returns false if it's not required
    // Returns null if we need more path
    private fun isZoneIndexRequiredForSignal(
        probedZoneIndex: Int,
        pathSignal: PathSignal,
        routes: List<RouteId>,
        trainState: SignalingTrainState,
    ): Boolean? {
        val firstBlockIndex = pathSignal.minBlockPathIndex

        // List of blocks to include in the simulator call
        val blocks = mutableStaticIdxArrayListOf(incrementalPath.getBlock(firstBlockIndex))

        // Index of the first zone included in the block path,
        // used to properly index the zone state array
        val firstSimulatedZone = incrementalPath.getBlockStartZone(firstBlockIndex)

        // Number of zones included in the block path
        var nSimulatedZones = blockInfra.getBlockZonePaths(blocks[0]).size

        // Add blocks in the block path until the probed zone is covered
        while (probedZoneIndex - firstSimulatedZone > nSimulatedZones) {
            if (firstBlockIndex + blocks.size >= incrementalPath.blockCount) {
                // exiting, the end of the block path has been reached
                return null
            }
            val newBlock = incrementalPath.getBlock(firstBlockIndex + blocks.size)
            blocks.add(newBlock)
            nSimulatedZones += blockInfra.getBlockZonePaths(newBlock).size
        }

        val zoneStates = MutableList(nSimulatedZones) { ZoneStatus.CLEAR }
        if (probedZoneIndex - firstSimulatedZone < zoneStates.size) {
            zoneStates[probedZoneIndex - firstSimulatedZone] = ZoneStatus.OCCUPIED
        } // Otherwise we rely on the `followingZoneState` of `simulator.evaluate`
        val simulatedSignalStates =
            simulator.evaluate(
                rawInfra,
                loadedSignalInfra,
                blockInfra,
                blocks,
                routes,
                blocks.size,
                zoneStates,
                ZoneStatus.OCCUPIED,
            )
        val signalState = simulatedSignalStates[pathSignal.signal]!!

        return simulator.sigModuleManager.isConstraining(
            loadedSignalInfra.getSignalingSystem(pathSignal.signal),
            signalState,
            trainState,
        )
    }

    // Returns the index of the first zone that isn't required for the given signal,
    // or null if we need more path to determine it. The returned value may be one index
    // further than the end of the path, if we need the whole path but nothing more.
    private fun findFirstNonRequiredZoneIndex(
        pathSignal: PathSignal,
        routes: List<RouteId>,
        trainState: SignalingTrainState,
    ): Int? {
        // Check if more path is needed for a valid solution
        // (i.e. the zone after the end of the path is required)
        val lastZoneIndex = incrementalPath.getBlockEndZone(incrementalPath.blockCount - 1)
        if (
            !incrementalPath.pathComplete &&
                isZoneIndexRequiredForSignal(lastZoneIndex, pathSignal, routes, trainState) != false
        ) {
            return null
        }

        // We are looking for the index `i` where `isZoneIndexRequiredForSignal` returns
        // true at `i-1` and false at `i`. We could just iterate starting at 0, but
        // because `i` is not that small (20 on average) and the signaling
        // simulation calls are expensive, we prefer an approach similar to
        // a binary-search

        // The values here are determined empirically on imported infrastructures,
        // the solutions mostly follow a gaussian distribution centered
        // on start+20 that rarely exceeds start+40.
        // We run a binary search on that range, and iterate one by one when the solution is above.
        var lowerBound = getSignalFirstProtectedZone(pathSignal)
        val initialUpperBound = min(lowerBound + 40, lastZoneIndex)
        var upperBound = initialUpperBound

        // Main loop, binary search
        while (true) {
            if (lowerBound == upperBound) break
            val probedZoneIndex = (upperBound + lowerBound) / 2
            val required =
                isZoneIndexRequiredForSignal(probedZoneIndex, pathSignal, routes, trainState)!!
            if (required) {
                lowerBound = probedZoneIndex + 1
            } else {
                upperBound = probedZoneIndex
            }
        }

        // Handle the case where the result is higher than the initial upper bound
        while (
            lowerBound in initialUpperBound..<lastZoneIndex &&
                isZoneIndexRequiredForSignal(lowerBound, pathSignal, routes, trainState)!!
        ) lowerBound++
        return lowerBound
    }

    fun processPathUpdate(): SpacingResourceUpdate {
        // process newly added path data
        registerPathExtension()
        // initialize requirements which only apply before the train sees any signal
        setupInitialRequirements()

        val routes = incrementalPath.routes.toList()
        val etcsSimulator = context?.let { ETCSBrakingSimulatorImpl(it) }

        // for all signals, update zone requirement times until a signal is found for which
        // more path is needed
        while (pendingSignals.isNotEmpty()) {
            val pathSignal = pendingSignals.first()

            val status = addSignalRequirements(pathSignal, routes, etcsSimulator)

            if (status == SignalRequirementsCreationStatus.NOT_SEEN_IN_AVAILABLE_SIM) {
                break
            } else if (status == SignalRequirementsCreationStatus.NOT_ENOUGH_PATH) {
                return NotEnoughPath
            }

            pendingSignals.removeFirst()
        }

        // serialize requirements and find the index of the first incomplete requirement
        var firstIncompleteReq = pendingRequirements.size
        val spacingRequirements =
            pendingRequirements
                .mapIndexed { index, pendingSpacingRequirement ->
                    val spacingRequirement = postProcessRequirement(pendingSpacingRequirement)
                    if (
                        index < firstIncompleteReq &&
                            (spacingRequirement == null || !spacingRequirement.isComplete)
                    )
                        firstIncompleteReq = index
                    spacingRequirement
                }
                .filterNotNull()

        // remove complete requirements
        for (i in 0 until firstIncompleteReq) pendingRequirements.removeFirst()

        return SpacingRequirements(spacingRequirements)
    }

    private enum class SignalRequirementsCreationStatus {
        REQUIREMENTS_ADDED,
        NOT_SEEN_IN_AVAILABLE_SIM,
        NOT_ENOUGH_PATH,
    }

    private fun addSignalRequirements(
        pathSignal: PathSignal,
        routes: List<RouteId>,
        etcsSimulator: ETCSBrakingSimulator?,
    ): SignalRequirementsCreationStatus {
        val sigSystemId = loadedSignalInfra.getSignalingSystem(pathSignal.signal)
        val isCurveBased = simulator.sigModuleManager.isCurveBased(sigSystemId)
        return if (isCurveBased) {
            if (
                simulator.sigModuleManager.getName(sigSystemId) != ETCS_LEVEL2.id ||
                    etcsSimulator == null
            ) {
                TODO(
                    "Spacing requirements for curve-based signals are only available for " +
                        "ETCS_LEVEL2 and through StandaloneSimulation"
                )
            }
            addEtcsSignalRequirements(pathSignal, etcsSimulator)
        } else {
            addSightSignalRequirements(pathSignal, routes)
        }
    }

    private fun addEtcsSignalRequirements(
        pathSignal: PathSignal,
        etcsSimulator: ETCSBrakingSimulator,
    ): SignalRequirementsCreationStatus {
        val signalOffset = incrementalPath.toTravelledPath(pathSignal.pathOffset)
        var isRouteDelimiter = true
        try {
            isRouteDelimiter = loadedSignalInfra.getSettings(pathSignal.signal).getFlag("Nf")
        } catch (e: Throwable) {
            logger.warn {
                "Unable to determine if " +
                    "signal ${rawInfra.getLogicalSignalName(pathSignal.signal)} is a route delimiter or not: $e"
            }
        }
        val envelope = callbacks.getRawEnvelopeIfSingle()
        // TODO: stop using a single envelope that's unavailable in STDCM and maybe move to a
        //   dedicated EnvelopeTimeInterpolate.getIntersection().
        //   Then probably protect its failure by returning
        //   SignalRequirementsCreationStatus.NOT_SEEN_IN_AVAILABLE_SIM.
        assert(envelope != null) {
            "A single envelope covering whole path is currently expected (used only through standalone simulation)"
        }

        val eoa =
            etcsSimulator
                .computeEoaLocations(
                    envelope!!,
                    listOf(signalOffset),
                    listOf(isRouteDelimiter),
                    EoaType.SPACING,
                )
                .first()
        val curvesList = etcsSimulator.computeStopBrakingCurves(envelope, listOf(eoa))

        assert(curvesList.size == 1)
        val reqPos =
            if (curvesList[eoa]!![IND] != null) {
                curvesList[eoa]!![IND]!!.brakingCurve.beginPos.meters
            } else {
                eoa.offsetEOA.distance
            }

        // Find the first zone of the block protected by signal
        val firstRequiredZone = getSignalFirstProtectedZone(pathSignal)
        // Find the last zone required by the signal
        val lastRequiredZone = getSignalFirstProtectedBlockLastZone(pathSignal)

        val reqTime = callbacks.arrivalTimeInRange(Offset(reqPos), Offset(reqPos))
        assert(reqTime.isFinite())
        addSignalRequirements(firstRequiredZone, lastRequiredZone, reqTime)

        return SignalRequirementsCreationStatus.REQUIREMENTS_ADDED
    }

    private fun addSightSignalRequirements(
        pathSignal: PathSignal,
        routes: List<RouteId>,
    ): SignalRequirementsCreationStatus {
        val physicalSignal = loadedSignalInfra.getPhysicalSignal(pathSignal.signal)

        // figure out when the signal is first seen
        val signalOffset = incrementalPath.toTravelledPath(pathSignal.pathOffset)
        val sightOffset = signalOffset - rawInfra.getSignalSightDistance(physicalSignal)
        // If the train's simulation hasn't reached the point where the signal is seen, bail out
        if (callbacks.currentPathOffset <= sightOffset) {
            return SignalRequirementsCreationStatus.NOT_SEEN_IN_AVAILABLE_SIM
        }
        val sightTime = callbacks.arrivalTimeInRange(sightOffset, signalOffset)
        assert(sightTime.isFinite())

        // Build the train state. We need to have the position of the next signal or to have a
        // complete path.
        val nextSignalOffset =
            if (pendingSignals.size > 1) {
                incrementalPath.toTravelledPath(pendingSignals[1].pathOffset)
            } else if (incrementalPath.pathComplete) {
                incrementalPath.toTravelledPath(incrementalPath.travelledPathEnd)
            } else {
                return SignalRequirementsCreationStatus.NOT_ENOUGH_PATH
            }
        val maxSpeedInSignalArea = callbacks.maxSpeedInRange(sightOffset, nextSignalOffset)

        class SignalingTrainStateImpl(override val speed: Speed) : SignalingTrainState
        val trainState = SignalingTrainStateImpl(speed = maxSpeedInSignalArea.metersPerSecond)

        // Find the first and last zone required by the signal
        val firstRequiredZone = getSignalFirstProtectedZone(pathSignal)
        val firstNonRequiredZone =
            findFirstNonRequiredZoneIndex(pathSignal, routes, trainState)
                ?: return SignalRequirementsCreationStatus.NOT_ENOUGH_PATH
        for (i in firstRequiredZone until firstNonRequiredZone) {
            addSignalRequirements(firstRequiredZone, i, sightTime)
        }
        return SignalRequirementsCreationStatus.REQUIREMENTS_ADDED
    }

    private fun postProcessRequirement(
        pendingRequirement: PendingSpacingRequirement
    ): SpacingRequirement? {
        val zonePath = incrementalPath.getZonePath(pendingRequirement.zoneIndex)
        val zone = rawInfra.getZonePathZone(zonePath)
        val zoneEntryPathOffset =
            incrementalPath.getZonePathStartOffset(pendingRequirement.zoneIndex)
        val zoneEntryOffset = incrementalPath.toTravelledPath(zoneEntryPathOffset)
        val zoneExitOffset =
            incrementalPath.toTravelledPath(
                incrementalPath.getZonePathEndOffset(pendingRequirement.zoneIndex)
            )

        var beginTime = pendingRequirement.beginTime

        // TODO: use a lookup table
        fun findLastStopBeforeZone(): ProcessedStop? {
            for (stop in processedStops.reversed()) {
                if (stop.nextZoneIdx <= pendingRequirement.zoneIndex) {
                    return stop
                }
            }
            return null
        }

        val stop = findLastStopBeforeZone()
        if (stop != null) {
            val stopOffset = incrementalPath.toTravelledPath(stop.offset)
            val stopEndTime = callbacks.departureFromStop(stopOffset)
            if (stopEndTime.isInfinite()) {
                return null
            }
            beginTime = maxOf(beginTime, stopEndTime - CLOSED_SIGNAL_RESERVATION_MARGIN)
        }

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

        return SpacingRequirement(zone, beginTime, endTime, isComplete)
    }

    fun clone(): SpacingRequirementAutomaton {
        val res =
            SpacingRequirementAutomaton(
                this.rawInfra,
                this.loadedSignalInfra,
                this.blockInfra,
                this.simulator,
                this.callbacks.clone(),
                this.incrementalPath.clone(),
                this.context,
            )
        res.nextProcessedBlock = nextProcessedBlock
        res.lastEmittedZone = lastEmittedZone
        res.pendingSignals.addAll(pendingSignals)
        res.pendingRequirements.addAll(pendingRequirements)
        res.nextStopToProcess = nextStopToProcess
        res.processedStops.addAll(processedStops)
        return res
    }
}

sealed interface SpacingResourceUpdate

data class SpacingRequirements(val requirements: List<SpacingRequirement>) : SpacingResourceUpdate

data object NotEnoughPath : SpacingResourceUpdate
