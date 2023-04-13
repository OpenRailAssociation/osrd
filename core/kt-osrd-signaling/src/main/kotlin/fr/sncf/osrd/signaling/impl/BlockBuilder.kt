package fr.sncf.osrd.signaling.impl

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.BlockInfraBuilder
import fr.sncf.osrd.sim_infra.impl.blockInfraBuilder
import fr.sncf.osrd.utils.indexing.IdxMap
import fr.sncf.osrd.utils.indexing.MutableStaticIdxArrayList
import mu.KotlinLogging


private val logger = KotlinLogging.logger {}


internal fun internalBuildBlocks(
    sigModuleManager: InfraSigSystemManager,
    rawSignalingInfra: RawSignalingInfra,
    loadedSignalInfra: LoadedSignalInfra
): BlockInfra {
    // Step 1) associate DirDetectorIds to a list of delimiting logical signals
    val signalDelimiters = findSignalDelimiters(rawSignalingInfra, loadedSignalInfra)
    val detectorEntrySignals = makeDetectorEntrySignals(loadedSignalInfra, signalDelimiters)
    return blockInfraBuilder(loadedSignalInfra, rawSignalingInfra) {
        // Step 2) iterate on zone paths along the route path.
        //   - maintain a list of currently active blocks
        //   - At each signal, add it to compatible current blocks.
        //   - if the signal is delimiting, stop and create the block (deduplicate it too)
        for (route in rawSignalingInfra.routes) {
            val routeEntryDet = rawSignalingInfra.getRouteEntry(route)
            val routeExitDet = rawSignalingInfra.getRouteExit(route)
            val entrySignals = detectorEntrySignals[routeEntryDet]
            var currentBlocks = getInitPartialBlocks(sigModuleManager, rawSignalingInfra, loadedSignalInfra, entrySignals, routeEntryDet)
            // while inside the route, we maintain a list of currently active blocks.
            // each block either expect any signaling system (when starting from a buffer stop or wildcard signal),
            // or expects a given signaling system. blocks can therefore tell whether a signal belongs there.
            // if a signal is not part of a block, it is ignored
            // if a signal delimits a block, it ends the block and starts a new ones, one per driver
            // if a signal does not delimit a block and has a single driver, it continues the block
            // if a signal does not delimit a block and has multiple drivers, it duplicates the block

            for (zonePath in rawSignalingInfra.getRoutePath(route)) {
                val zonePathLength = rawSignalingInfra.getZonePathLength(zonePath)
                for (block in currentBlocks)
                    block.addZonePath(zonePath, zonePathLength)

                // iterate over signals which are between the block entry and the block exit
                val signals = rawSignalingInfra.getSignals(zonePath)
                val signalsPositions = rawSignalingInfra.getSignalPositions(zonePath)
                for ((physicalSignal, position) in signals.zip(signalsPositions)) {
                    val distanceToZonePathEnd = zonePathLength - position
                    assert(distanceToZonePathEnd >= Distance.ZERO)
                    assert(distanceToZonePathEnd <= zonePathLength)
                    for (signal in loadedSignalInfra.getLogicalSignals(physicalSignal)) {
                        currentBlocks = updatePartialBlocks(
                            sigModuleManager,
                            currentBlocks,
                            loadedSignalInfra,
                            signal,
                            distanceToZonePathEnd,
                        )
                    }
                }
            }

            // when a route ends at a buffer stop, unterminated blocks are expected,
            // as the buffer stop sort of acts as a closed signal. when a route does not
            // end with a buffer stop, blocks are expected to end with the route.
            // such blocks are not valid, and can be fixed by adding a delimiter signal
            // right before the end of the route.
            val routeEndsAtBufferStop = rawSignalingInfra.isBufferStop(routeExitDet.detector)
            for (curBlock in currentBlocks) {
                if (curBlock.zonePaths.size == 0)
                    continue
                if (curBlock.signals.size == 0)
                    continue

                val lastZonePath = curBlock.zonePaths[curBlock.zonePaths.size - 1]
                assert(routeExitDet == rawSignalingInfra.getZonePathExit(lastZonePath))
                if (!routeEndsAtBufferStop)
                    logger.debug { "unterminated block at end of route ${rawSignalingInfra.getRouteName(route)}" }
                block(curBlock.startAtBufferStop, true, curBlock.zonePaths, curBlock.signals, curBlock.signalPositions)
            }
        }
    }
}

private fun findSignalDelimiters(
    rawSignalingInfra: RawSignalingInfra,
    loadedSignalInfra: LoadedSignalInfra
): IdxMap<LogicalSignalId, DirDetectorId> {
    val res = IdxMap<LogicalSignalId, DirDetectorId>()
    for (zonePath in rawSignalingInfra.zonePaths) {
        val endDetector = rawSignalingInfra.getZonePathExit(zonePath)
        val signals = rawSignalingInfra.getSignals(zonePath)
        val signalsPositions = rawSignalingInfra.getSignalPositions(zonePath)
        val switchesPositions = rawSignalingInfra.getZonePathMovableElementsDistances(zonePath)

        val cutoffDistance = if (switchesPositions.size == 0)
            Distance.ZERO
        else
            switchesPositions[switchesPositions.size - 1]

        for (physicalSignalIndex in 0 until signals.size) {
            if (signalsPositions[physicalSignalIndex] < cutoffDistance) {
                // TODO: add a warning if the physical signal has logical signals which are delimiters
                continue
            }
            val physicalSignal = signals[physicalSignalIndex]
            for (logicalSignal in rawSignalingInfra.getLogicalSignals(physicalSignal))
                if (loadedSignalInfra.isBlockDelimiter(logicalSignal))
                    res[logicalSignal] = endDetector
        }
    }
    return res
}

private fun makeDetectorEntrySignals(
    loadedSignalInfra: LoadedSignalInfra,
    signalDelimiters: IdxMap<LogicalSignalId, DirDetectorId>,
): IdxMap<DirDetectorId, IdxMap<SignalingSystemId, LogicalSignalId>> {
    val res = IdxMap<DirDetectorId, IdxMap<SignalingSystemId, LogicalSignalId>>()
    for (logicalSignal in loadedSignalInfra.logicalSignals) {
        val delim = signalDelimiters[logicalSignal] ?: continue
        val delimSignals = res.getOrPut(delim) { IdxMap() }
        val signalingSystem = loadedSignalInfra.getSignalingSystem(logicalSignal)
        if (delimSignals[signalingSystem] != null)
            logger.debug { "duplicate signals at detector" }
        delimSignals[signalingSystem] = logicalSignal
    }
    return res
}

class PartialBlock(
    val startAtBufferStop: Boolean,
    val signals: MutableStaticIdxArrayList<LogicalSignal>,
    val signalPositions: MutableDistanceList,
    val zonePaths: MutableStaticIdxArrayList<ZonePath>,
    var expectedSignalingSystem: SignalingSystemId?,
    var currentLength: Distance,
) {
    constructor(startAtBufferStop: Boolean, expectedSignalingSystem: SignalingSystemId?) : this(
        startAtBufferStop,
        MutableStaticIdxArrayList(),
        mutableDistanceArrayListOf(),
        MutableStaticIdxArrayList(),
        expectedSignalingSystem,
        0.meters,
    )

    constructor(startAtBufferStop: Boolean) : this(startAtBufferStop, null)

    fun addSignal(signal: LogicalSignalId, position: Distance): PartialBlock {
        signals.add(signal)
        signalPositions.add(position)
        return this
    }

    fun addZonePath(zonePath: ZonePathId, length: Distance) {
        zonePaths.add(zonePath)
        currentLength += length
    }

    fun acceptsSignal(loadedSignalInfra: LoadedSignalInfra, signal: LogicalSignalId): Boolean {
        if (expectedSignalingSystem == null)
            return true
        return loadedSignalInfra.getSignalingSystem(signal) == expectedSignalingSystem
    }

    fun clone(): PartialBlock {
        return PartialBlock(
            startAtBufferStop,
            signals.clone(),
            signalPositions.clone(),
            zonePaths.clone(),
            expectedSignalingSystem,
            currentLength
        )
    }
}

private fun getInitPartialBlocks(
    sigModuleManager: InfraSigSystemManager,
    rawSignalingInfra: RawSignalingInfra,
    loadedSignalInfra: LoadedSignalInfra,
    entrySignals: IdxMap<SignalingSystemId, LogicalSignalId>?,
    entryDet: DirDetectorId,
): MutableList<PartialBlock> {
    val initialBlocks = mutableListOf<PartialBlock>()
    val isBufferStop = rawSignalingInfra.isBufferStop(entryDet.detector)
    if (entrySignals == null) {
        if (!isBufferStop)
            logger.debug { "no signal at non buffer stop" }
        initialBlocks.add(
            PartialBlock(
                true,
                MutableStaticIdxArrayList(),
                mutableDistanceArrayListOf(),
                MutableStaticIdxArrayList(),
                null,
                0.meters
            )
        )
    } else {
        if (isBufferStop)
            logger.debug { "signal at buffer stop" }
        for (entrySignal in entrySignals.values()) {
            val drivers = loadedSignalInfra.getDrivers(entrySignal)
            if (drivers.size == 0) {
                initialBlocks.add(PartialBlock(false).addSignal(entrySignal, 0.meters))
                continue
            }

            for (driver in drivers) {
                val inputSigSystem = sigModuleManager.getInputSignalingSystem(driver)
                initialBlocks.add(PartialBlock(false, inputSigSystem).addSignal(entrySignal, 0.meters))
            }
        }
    }
    return initialBlocks
}

enum class SignalBlockRel {
    UNRELATED,
    PART_OF,
    END_OF,
}

private fun evalSignalBlockRel(
    sigModuleManager: InfraSigSystemManager,
    loadedSignalInfra: LoadedSignalInfra,
    block: PartialBlock,
    signal: LogicalSignalId,
): SignalBlockRel {
    if (!block.acceptsSignal(loadedSignalInfra, signal))
        return SignalBlockRel.UNRELATED
    val signalingSystem = loadedSignalInfra.getSignalingSystem(signal)
    val sigSettings = loadedSignalInfra.getSettings(signal)
    if (!sigModuleManager.isBlockDelimiter(signalingSystem, sigSettings))
        return SignalBlockRel.PART_OF
    return SignalBlockRel.END_OF
}

private fun BlockInfraBuilder.updatePartialBlocks(
    sigModuleManager: InfraSigSystemManager,
    currentBlocks: MutableList<PartialBlock>,
    loadedSignalInfra: LoadedSignalInfra,
    signal: LogicalSignalId,
    distanceToZonePathEnd: Distance,
): MutableList<PartialBlock> {
    val nextBlocks = mutableListOf<PartialBlock>()
    // for each currently active block, evaluate the relationship between this signal and this block
    for (curBlock in currentBlocks) {
        val blockPosition = curBlock.currentLength - distanceToZonePathEnd
        when (evalSignalBlockRel(sigModuleManager, loadedSignalInfra, curBlock, signal)) {
            SignalBlockRel.UNRELATED -> nextBlocks.add(curBlock)
            SignalBlockRel.PART_OF -> {
                curBlock.addSignal(signal, blockPosition)
                val drivers = loadedSignalInfra.getDrivers(signal)
                if (drivers.size == 0) {
                    val newBlock = curBlock.clone()
                    newBlock.expectedSignalingSystem = null
                    nextBlocks.add(newBlock)
                } else {
                    for (driver in drivers) {
                        val newBlock = curBlock.clone()
                        newBlock.expectedSignalingSystem = sigModuleManager.getInputSignalingSystem(driver)
                        nextBlocks.add(newBlock)
                    }
                }
            }
            SignalBlockRel.END_OF -> {
                curBlock.addSignal(signal, blockPosition)
                block(curBlock.startAtBufferStop, false, curBlock.zonePaths, curBlock.signals, curBlock.signalPositions)
                val drivers = loadedSignalInfra.getDrivers(signal)
                if (drivers.size == 0) {
                    val newBlock = PartialBlock(false).addSignal(signal, 0.meters)
                    nextBlocks.add(newBlock)
                } else {
                    for (driver in drivers) {
                        val inputSigSystem = sigModuleManager.getInputSignalingSystem(driver)
                        val newBlock = PartialBlock(false, inputSigSystem)
                            .addSignal(signal, 0.meters)
                        nextBlocks.add(newBlock)
                    }
                }
            }
        }
    }
    return nextBlocks
}
