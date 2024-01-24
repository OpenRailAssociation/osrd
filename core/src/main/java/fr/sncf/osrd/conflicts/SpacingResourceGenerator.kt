package fr.sncf.osrd.conflicts

import fr.sncf.osrd.signaling.SignalingSimulator
import fr.sncf.osrd.signaling.ZoneStatus
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra_adapter.SimInfraAdapter
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.meters
import mu.KotlinLogging

private val logger = KotlinLogging.logger {}


/**
 * ```
 *         zone occupied                  Y           Y
 *  explicit requirement                              Y         Y
 *     needs requirement                  Y           Y         Y
 *               signals          ┎o         ┎o         ┎o         ┎o         ┎o         ┎o
 *                 zones   +---------|----------|----------|----------|----------|----------|
 *            train path                  =============
 *                 phase    headroom    begin      main        end          tailroom
 * ```
 */
enum class SpacingRequirementPhase {
    HeadRoom,
    Begin,
    Main,
    End,
    TailRoom;

    /** Checks whether the current state accepts this zone configuration */
    fun check(occupied: Boolean, hasRequirement: Boolean): Boolean {
        return when (this) {
            HeadRoom -> !occupied && !hasRequirement
            Begin -> occupied && !hasRequirement
            Main -> occupied && hasRequirement
            End -> !occupied && hasRequirement
            TailRoom -> !occupied && !hasRequirement
        }
    }

    fun react(occupied: Boolean, hasRequirement: Boolean): SpacingRequirementPhase {
        // no state change
        if (check(occupied, hasRequirement))
            return this

        when (this) {
            HeadRoom -> {
                if (occupied)
                    return Begin.react(true, hasRequirement)
            }
            Begin -> {
                if (hasRequirement)
                    return Main.react(occupied, true)
                if (!occupied)
                    return TailRoom
            }
            Main -> {
                if (!occupied)
                    return End.react(false, hasRequirement)
            }
            End -> {
                if (!hasRequirement)
                    return TailRoom
           }
            TailRoom -> return TailRoom
        }
        return this
    }
}


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

    private var phase = SpacingRequirementPhase.HeadRoom

    // last zone for which a requirement was emitted
    private var lastEmittedZone = -1

    // last zone whose occupancy was tested with the current pending signal
    // when a new signal starts processing, this value is initialized to the zone immediately after it
    private var nextProbedZoneForSignal = -1

    // the queue of signals awaiting processing
    private val pendingSignals = ArrayDeque<PathSignal>()

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
                if (signalBlockIndex == 0 && pendingSignals.isNotEmpty() && pendingSignals.last().signal == signal)
                    continue

                val signalPathOffset = incrementalPath.convertBlockOffset(blockIndex, signalBlockPosition)
                // skip signals outside the path
                if (signalPathOffset < incrementalPath.travelledPathBegin)
                    continue
                if (incrementalPath.pathComplete && signalPathOffset >= incrementalPath.travelledPathEnd)
                    continue
                pendingSignals.addLast(PathSignal(signal, signalPathOffset, blockIndex))
            }
        }
        nextProcessedBlock = incrementalPath.endBlockIndex
    }

    /**
     * For all zones which either occupied by the train or required at some point, emit a zone requirement.
     * Some zones do not have requirements: those before the train's starting position, and those far enough from
     * the end of the train path.
     */
    private fun emitZoneRequirement(
        zoneIndex: Int,
        zoneRequirementTime: Double
    ): SpacingRequirement? {
        val zonePath = incrementalPath.getZonePath(zoneIndex)
        val zone = rawInfra.getZonePathZone(zonePath)

        val zoneEntryOffset = incrementalPath.getZonePathStartOffset(zoneIndex)
        val zoneExitOffset = incrementalPath.getZonePathEndOffset(zoneIndex)
        val zoneEntryTime = callbacks.arrivalTimeInRange(zoneEntryOffset, zoneExitOffset)
        val zoneExitTime = callbacks.departureTimeFromRange(zoneEntryOffset, zoneExitOffset)
        val enters = zoneEntryTime.isFinite()
        val exits = zoneExitTime.isFinite()
        assert(enters == exits)
        val occupied = enters

        val explicitRequirement = zoneRequirementTime.isFinite()

        phase = phase.react(occupied, explicitRequirement)
        val correctPhase = phase.check(occupied, explicitRequirement)
        if (!correctPhase)
            logger.error { "incorrect phase for zone $zone" }

        if (phase == SpacingRequirementPhase.HeadRoom || phase == SpacingRequirementPhase.TailRoom)
            return null

        val beginTime: Double
        val endTime: Double

        val zoneName = rawInfra.getZoneName(zone)

        when (phase) {
            SpacingRequirementPhase.Begin -> {
                beginTime = 0.0
                endTime = zoneExitTime
            }
            SpacingRequirementPhase.Main -> {
                beginTime = if (zoneRequirementTime.isFinite()) {
                    zoneRequirementTime
                } else {
                    // zones may not be required due to faulty signaling.
                    // in this case, fall back to the time at which the zone was first occupied
                    logger.error { "missing main phase zone requirement on zone $zoneName" }
                    zoneEntryTime
                }
                endTime = zoneExitTime
            }
            else -> /* SpacingRequirementPhase.End */ {
                assert(zoneRequirementTime.isFinite())
                beginTime = zoneRequirementTime
                // the time at which this requirement ends is the one at which the train
                // exits the simulation
                endTime = callbacks.endTime()
            }
        }

        return SpacingRequirement(zoneName, beginTime, endTime)
    }

    private fun getSignalProtectedZone(signal: PathSignal): Int {
        // the signal protects all zone inside the block
        // if a signal is at a block boundary,
        return incrementalPath.getBlockEndZone(signal.minBlockPathIndex)
    }

    fun processPathUpdate(): List<SpacingRequirement> {
        registerPathExtension()

        val res = mutableListOf<SpacingRequirement>()
        fun emitRequirementsUntil(zoneIndex: Int, sightTime: Double) {
            if (zoneIndex <= lastEmittedZone)
                return

            for (skippedZone in lastEmittedZone + 1 until zoneIndex) {
                val req = emitZoneRequirement(skippedZone, Double.POSITIVE_INFINITY)
                if (req != null)
                    res.add(req)
            }
            val req = emitZoneRequirement(zoneIndex, sightTime)
            if (req != null)
                res.add(req)
            lastEmittedZone = zoneIndex
        }


        val blocks = mutableStaticIdxArrayListOf<Block>()
        for (blockIndex in incrementalPath.beginBlockIndex until incrementalPath.endBlockIndex)
            blocks.add(incrementalPath.getBlock(blockIndex))

        // there may be more zone states than what's contained in the path's blocks, which shouldn't matter
        val zoneStartIndex = incrementalPath.getBlockStartZone(incrementalPath.beginBlockIndex)
        val zoneCount = incrementalPath.getBlockEndZone(incrementalPath.endBlockIndex - 1) - zoneStartIndex
        val zoneStates = MutableList(zoneCount) { ZoneStatus.CLEAR }

        // for all signals, update zone requirement times until a signal is found for which
        // more path is needed
        signalLoop@ while (pendingSignals.isNotEmpty()) {
            val pathSignal = pendingSignals.first()
            if (nextProbedZoneForSignal == -1)
                nextProbedZoneForSignal = getSignalProtectedZone(pathSignal)
            val physicalSignal = loadedSignalInfra.getPhysicalSignal(pathSignal.signal)

            // figure out when the signal is first seen
            val sightOffset = pathSignal.pathOffset - rawInfra.getSignalSightDistance(physicalSignal)
            val sightTime = callbacks.arrivalTimeInRange(sightOffset, pathSignal.pathOffset)

            // find the first zone after the signal which can be occupied without disturbing the train
            var lastConstrainingZone = -1
            zoneProbingLoop@ while (true) {
                // if we reached the last zone, just quit
                if (nextProbedZoneForSignal == incrementalPath.endZonePathIndex) {
                    if (incrementalPath.pathComplete)
                        break@zoneProbingLoop
                    break@signalLoop
                }
                val zoneIndex = nextProbedZoneForSignal++

                // find the index of this signal's block in the block array
                val currentBlockOffset = pathSignal.minBlockPathIndex - incrementalPath.beginBlockIndex
                assert(blocks[currentBlockOffset] == incrementalPath.getBlock(pathSignal.minBlockPathIndex))
                zoneStates[zoneIndex - zoneStartIndex] = ZoneStatus.OCCUPIED
                val simulatedSignalStates = simulator.evaluate(
                    rawInfra, loadedSignalInfra, blockInfra,
                    blocks, 0, blocks.size,
                    zoneStates, ZoneStatus.CLEAR
                )
                zoneStates[zoneIndex - zoneStartIndex] = ZoneStatus.CLEAR
                val signalState = simulatedSignalStates[pathSignal.signal]!!

                // FIXME: Have a better way to check if the signal is constraining
                if (signalState.getEnum("aspect") == "VL")
                    break
                emitRequirementsUntil(zoneIndex, sightTime)
                lastConstrainingZone = zoneIndex
            }

            if (lastConstrainingZone == -1) {
                logger.error { "signal ${rawInfra.getLogicalSignalName(pathSignal.signal)} does not react to zone occupation" }
            }
            pendingSignals.removeFirst()
            nextProbedZoneForSignal = -1
        }
        return res
    }

    fun clone(): SpacingRequirementAutomaton {
        TODO("Not yet implemented")
    }
}
