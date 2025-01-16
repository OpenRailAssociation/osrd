package fr.sncf.osrd.signaling.impl

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.BlockInfraBuilder
import fr.sncf.osrd.sim_infra.impl.blockInfraBuilder
import fr.sncf.osrd.utils.LogAggregator
import fr.sncf.osrd.utils.indexing.IdxMap
import fr.sncf.osrd.utils.indexing.MutableStaticIdxArrayList
import fr.sncf.osrd.utils.units.*
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
    val missingSignalLogAggregator = LogAggregator({ logger.debug(it) })
    val nonRouteDelimitingSignalLogAggregator = LogAggregator({ logger.debug(it) })
    val result =
        blockInfraBuilder(loadedSignalInfra, rawSignalingInfra) {
            // Step 2) iterate on zone paths along the route path.
            //   - maintain a list of currently active blocks
            //   - At each signal, add it to compatible current blocks.
            //   - if the signal is delimiting, stop and create the block (deduplicate it too)
            for (route in rawSignalingInfra.routes) {
                val routeEntryDet = rawSignalingInfra.getRouteEntry(route)
                val routeExitDet = rawSignalingInfra.getRouteExit(route)
                val entrySignals = detectorEntrySignals[routeEntryDet]
                var currentBlocks =
                    getInitPartialBlocks(
                        sigModuleManager,
                        rawSignalingInfra,
                        loadedSignalInfra,
                        entrySignals,
                        routeEntryDet,
                        missingSignalLogAggregator,
                    )
                // While inside the route, we maintain a list of currently active blocks. Each block
                // either expect any signaling system (when starting from a buffer stop or wildcard
                // signal), or expects a given signaling system. Blocks can therefore tell whether a
                // signal belongs there.
                // If a signal is not part of a block, it is ignored. If a signal delimits a block,
                // it ends the block and starts a new ones, one per driver. If a signal does not
                // delimit a block and has a single driver, it continues the block. If a signal does
                // not delimit a block and has multiple drivers, it duplicates the block.

                for (zonePath in rawSignalingInfra.getRoutePath(route)) {
                    val zonePathLength = rawSignalingInfra.getZonePathLength(zonePath)
                    for (block in currentBlocks) block.addZonePath(zonePath, zonePathLength)

                    // iterate over signals which are between the block entry and the block exit
                    val signals = rawSignalingInfra.getSignals(zonePath)
                    val signalsPositions = rawSignalingInfra.getSignalPositions(zonePath)
                    for ((physicalSignal, position) in signals.zip(signalsPositions)) {
                        val distanceToZonePathEnd = zonePathLength - position
                        assert(distanceToZonePathEnd >= Distance.ZERO)
                        assert(distanceToZonePathEnd <= zonePathLength.distance)
                        for (signal in loadedSignalInfra.getLogicalSignals(physicalSignal)) {
                            currentBlocks =
                                updatePartialBlocks(
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
                val routeEndsAtBufferStop = rawSignalingInfra.isBufferStop(routeExitDet.value)
                for (curBlock in currentBlocks) {
                    if (curBlock.zonePaths.size == 0) continue
                    if (curBlock.signals.size == 0) continue

                    val lastZonePath = curBlock.zonePaths[curBlock.zonePaths.size - 1]
                    assert(routeExitDet == rawSignalingInfra.getZonePathExit(lastZonePath))
                    if (!routeEndsAtBufferStop)
                        logger.debug {
                            "unterminated block at end of route ${rawSignalingInfra.getRouteName(route)}"
                        }
                    block(
                        curBlock.startAtBufferStop,
                        true,
                        curBlock.zonePaths,
                        curBlock.signals,
                        curBlock.signalPositions
                    )
                }

                // Finally we want to emit a warning if the route ends on a non route delimiting
                // signal
                if (!routeEndsAtBufferStop) {
                    warnOnRouteEndingOnNonRouteDelimitingSignal(
                        route,
                        routeExitDet,
                        detectorEntrySignals,
                        sigModuleManager,
                        rawSignalingInfra,
                        loadedSignalInfra,
                        nonRouteDelimitingSignalLogAggregator
                    )
                }
            }
        }
    missingSignalLogAggregator.logAggregatedSummary()
    nonRouteDelimitingSignalLogAggregator.logAggregatedSummary()
    return result
}

data class AssociatedDetector(val detector: DirDetectorId, val distance: Distance)

private fun findSignalDelimiters(
    rawSignalingInfra: RawSignalingInfra,
    loadedSignalInfra: LoadedSignalInfra
): IdxMap<LogicalSignalId, AssociatedDetector> {
    val res = IdxMap<LogicalSignalId, AssociatedDetector>()
    for (zonePath in rawSignalingInfra.zonePaths) {
        val endDetector = rawSignalingInfra.getZonePathExit(zonePath)
        val signals = rawSignalingInfra.getSignals(zonePath)
        val signalsPositions = rawSignalingInfra.getSignalPositions(zonePath)
        val switchesPositions = rawSignalingInfra.getZonePathMovableElementsPositions(zonePath)
        val zonePathLen = rawSignalingInfra.getZonePathLength(zonePath)

        // we only take into account signals after the last switch of the zone path
        val cutoffOffset =
            if (switchesPositions.size == 0) Offset(Distance.ZERO)
            else switchesPositions[switchesPositions.size - 1]

        for (physicalSignalIndex in 0 until signals.size) {
            val signalPos = signalsPositions[physicalSignalIndex]
            if (signalPos < cutoffOffset) {
                // TODO: add a warning if the physical signal has logical signals which are
                // delimiters
                continue
            }
            val detectorDistance = zonePathLen - signalPos
            val physicalSignal = signals[physicalSignalIndex]
            for (logicalSignal in rawSignalingInfra.getLogicalSignals(physicalSignal)) if (
                loadedSignalInfra.isBlockDelimiter(logicalSignal)
            )
                res[logicalSignal] = AssociatedDetector(endDetector, detectorDistance)
        }
    }
    return res
}

data class AssociatedSignal(val signal: LogicalSignalId, val distance: Distance)

private fun makeDetectorEntrySignals(
    loadedSignalInfra: LoadedSignalInfra,
    signalDelimiters: IdxMap<LogicalSignalId, AssociatedDetector>,
): IdxMap<DirDetectorId, IdxMap<SignalingSystemId, AssociatedSignal>> {
    val res = IdxMap<DirDetectorId, IdxMap<SignalingSystemId, AssociatedSignal>>()
    for (logicalSignal in loadedSignalInfra.logicalSignals) {
        val delim = signalDelimiters[logicalSignal] ?: continue
        val delimSignals = res.getOrPut(delim.detector) { IdxMap() }
        val signalingSystem = loadedSignalInfra.getSignalingSystem(logicalSignal)
        if (delimSignals[signalingSystem] != null) logger.debug { "duplicate signals at detector" }
        delimSignals[signalingSystem] = AssociatedSignal(logicalSignal, delim.distance)
    }
    return res
}

class PartialBlock(
    val startAtBufferStop: Boolean,
    val signals: MutableStaticIdxArrayList<LogicalSignal>,
    val signalPositions: MutableOffsetList<Block>,
    val zonePaths: MutableStaticIdxArrayList<ZonePath>,
    var expectedSignalingSystem: SignalingSystemId?,
    var currentLength: Length<Block>,
) {
    constructor(
        startAtBufferStop: Boolean,
        expectedSignalingSystem: SignalingSystemId?
    ) : this(
        startAtBufferStop,
        MutableStaticIdxArrayList(),
        mutableOffsetArrayListOf(),
        MutableStaticIdxArrayList(),
        expectedSignalingSystem,
        Length(0.meters),
    )

    constructor(startAtBufferStop: Boolean) : this(startAtBufferStop, null)

    fun addSignal(signal: LogicalSignalId, position: Offset<Block>): PartialBlock {
        signals.add(signal)
        signalPositions.add(position)
        return this
    }

    fun addZonePath(zonePath: ZonePathId, length: Length<ZonePath>) {
        zonePaths.add(zonePath)
        currentLength += length.distance
    }

    fun acceptsSignal(loadedSignalInfra: LoadedSignalInfra, signal: LogicalSignalId): Boolean {
        if (expectedSignalingSystem == null) return true
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
    entrySignals: IdxMap<SignalingSystemId, AssociatedSignal>?,
    entryDet: DirDetectorId,
    missingSignalLogAggregator: LogAggregator,
): MutableList<PartialBlock> {
    val initialBlocks = mutableListOf<PartialBlock>()
    val isBufferStop = rawSignalingInfra.isBufferStop(entryDet.value)
    if (entrySignals == null) {
        if (!isBufferStop)
            missingSignalLogAggregator.registerError(
                "no signal at non buffer stop ${rawSignalingInfra.getDetectorName(entryDet.value)}:${entryDet.direction}"
            )
        initialBlocks.add(
            PartialBlock(
                true,
                MutableStaticIdxArrayList(),
                mutableOffsetArrayListOf(),
                MutableStaticIdxArrayList(),
                null,
                Length(0.meters)
            )
        )
    } else {
        if (isBufferStop)
            logger.debug {
                "signal at buffer stop ${rawSignalingInfra.getDetectorName(entryDet.value)}:${entryDet.direction}"
            }
        for (entry in entrySignals.values()) {
            val drivers = loadedSignalInfra.getDrivers(entry.signal)
            if (drivers.size == 0) {
                initialBlocks.add(
                    PartialBlock(false).addSignal(entry.signal, Offset(-entry.distance))
                )
                continue
            }

            for (driver in drivers) {
                val inputSigSystem = sigModuleManager.getInputSignalingSystem(driver)
                initialBlocks.add(
                    PartialBlock(false, inputSigSystem)
                        .addSignal(entry.signal, Offset(-entry.distance))
                )
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
    if (!block.acceptsSignal(loadedSignalInfra, signal)) return SignalBlockRel.UNRELATED
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
                        newBlock.expectedSignalingSystem =
                            sigModuleManager.getInputSignalingSystem(driver)
                        nextBlocks.add(newBlock)
                    }
                }
            }
            SignalBlockRel.END_OF -> {
                curBlock.addSignal(signal, blockPosition)
                block(
                    curBlock.startAtBufferStop,
                    false,
                    curBlock.zonePaths,
                    curBlock.signals,
                    curBlock.signalPositions
                )
                val drivers = loadedSignalInfra.getDrivers(signal)
                if (drivers.size == 0) {
                    val newBlock =
                        PartialBlock(false).addSignal(signal, Offset(-distanceToZonePathEnd))
                    nextBlocks.add(newBlock)
                } else {
                    for (driver in drivers) {
                        val inputSigSystem = sigModuleManager.getInputSignalingSystem(driver)
                        val newBlock =
                            PartialBlock(false, inputSigSystem)
                                .addSignal(signal, Offset(-distanceToZonePathEnd))
                        nextBlocks.add(newBlock)
                    }
                }
            }
        }
    }
    return nextBlocks
}

private fun warnOnRouteEndingOnNonRouteDelimitingSignal(
    route: RouteId,
    routeExitDet: DirDetectorId,
    detectorSignals: IdxMap<DirDetectorId, IdxMap<SignalingSystemId, AssociatedSignal>>,
    sigModuleManager: InfraSigSystemManager,
    rawSignalingInfra: RawSignalingInfra,
    loadedSignalInfra: LoadedSignalInfra,
    logAggregator: LogAggregator
) {
    val endSignals = detectorSignals[routeExitDet] ?: return
    for (associatedSignal in endSignals.values()) {
        val logicalSignalId = associatedSignal.signal
        val signalingSystem = loadedSignalInfra.getSignalingSystem(logicalSignalId)
        val sigSettings = loadedSignalInfra.getSettings(logicalSignalId)
        val routeEndsWithRouteEndingSignal =
            sigModuleManager.isRouteDelimiter(signalingSystem, sigSettings)
        if (!routeEndsWithRouteEndingSignal) {
            logAggregator.registerError(
                "Route ${rawSignalingInfra.getRouteName(route)} ends with non-route delimiting signal on signaling system ${signalingSystem}"
            )
        }
    }
}
