package fr.sncf.osrd.signaling.impl

import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.signaling.*
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.SignalParameters
import fr.sncf.osrd.sim_infra.impl.loadedSignalInfra
import fr.sncf.osrd.utils.LogAggregator
import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.Distance
import mu.KotlinLogging

private val logger = KotlinLogging.logger {}

fun ZoneStatus.reduce(other: ZoneStatus): ZoneStatus {
    if (this == ZoneStatus.INCOMPATIBLE || other == ZoneStatus.INCOMPATIBLE)
        return ZoneStatus.INCOMPATIBLE
    if (this == ZoneStatus.OCCUPIED || other == ZoneStatus.OCCUPIED) return ZoneStatus.OCCUPIED
    return ZoneStatus.CLEAR
}

fun ZoneStatus.toProtectionStatus(): ProtectionStatus {
    return when (this) {
        ZoneStatus.CLEAR -> ProtectionStatus.CLEAR
        ZoneStatus.OCCUPIED -> ProtectionStatus.OCCUPIED
        ZoneStatus.INCOMPATIBLE -> ProtectionStatus.INCOMPATIBLE
    }
}

class SignalingSimulatorImpl(override val sigModuleManager: SigSystemManager) : SignalingSimulator {
    private fun loadSignalSetting(
        rawSettings: Map<String, String>,
        schema: SigSettingsSchema,
    ): SigSettings {
        return schema(rawSettings)
    }

    private fun loadSignalParameters(
        rawParameters: RawSignalParameters,
        schema: SigParametersSchema,
    ): SignalParameters {
        val default = schema(rawParameters.default)
        val conditional = rawParameters.conditional.mapValues { schema(it.value) }
        return SignalParameters(default, conditional)
    }

    override fun loadSignals(unloadedSignalInfra: RawSignalingInfra): LoadedSignalInfra {
        return loadedSignalInfra(sigModuleManager) {
            for (oldPhysicalSignal in unloadedSignalInfra.physicalSignals) {
                physicalSignal {
                    for (oldLogicalSignal in
                        unloadedSignalInfra.getLogicalSignals(oldPhysicalSignal)) {
                        logicalSignal {
                            val oldSignalingSystemId =
                                unloadedSignalInfra.getSignalingSystemId(oldLogicalSignal)
                            val signalingSystemId =
                                sigModuleManager.findSignalingSystemOrThrow(oldSignalingSystemId)
                            signalingSystemId(signalingSystemId)

                            val settingsSchema =
                                sigModuleManager.getSettingsSchema(signalingSystemId)
                            val rawSettings = unloadedSignalInfra.getRawSettings(oldLogicalSignal)
                            sigSettings(loadSignalSetting(rawSettings, settingsSchema))
                            val parametersSchema =
                                sigModuleManager.getParametersSchema(signalingSystemId)
                            val rawParameters =
                                unloadedSignalInfra.getRawParameters(oldLogicalSignal)
                            sigParameters(loadSignalParameters(rawParameters, parametersSchema))

                            for (oldNextSS in
                                unloadedSignalInfra.getNextSignalingSystemIds(oldLogicalSignal)) {
                                val oldNextSSId =
                                    sigModuleManager.findSignalingSystemOrThrow(oldNextSS)
                                driver(sigModuleManager.findDriver(signalingSystemId, oldNextSSId))
                            }
                        }
                    }
                }
            }
        }
    }

    override fun buildBlocks(
        rawSignalingInfra: RawSignalingInfra,
        loadedSignalInfra: LoadedSignalInfra,
    ): BlockInfra {
        val blockInfra = internalBuildBlocks(sigModuleManager, rawSignalingInfra, loadedSignalInfra)
        val blockLogAggregator = LogAggregator({ logger.debug(it) })
        val signalLogAggregator = LogAggregator({ logger.debug(it) })
        for (block in blockInfra.blocks) {
            val sigSystem = blockInfra.getBlockSignalingSystem(block)
            val path = blockInfra.getBlockZonePaths(block)
            val length =
                Distance(
                    path
                        .map { rawSignalingInfra.getZonePathLength(it) }
                        .sumOf { it.distance.millimeters }
                )
            val startAtBufferStop = blockInfra.blockStartAtBufferStop(block)
            val stopAtBufferStop = blockInfra.blockStopAtBufferStop(block)
            val signals = blockInfra.getBlockSignals(block)
            val signalTypes = signals.map { rawSignalingInfra.getSignalingSystemId(it) }
            val signalSettings = signals.map { loadedSignalInfra.getSettings(it) }
            val signalsPositions = blockInfra.getSignalsPositions(block)
            val sigBlock =
                SigBlock(
                    startAtBufferStop,
                    stopAtBufferStop,
                    signalTypes,
                    signalSettings,
                    signalsPositions,
                    length,
                )
            val reporter =
                object : BlockDiagReporter {
                    override fun reportBlock(errorType: String) {
                        val entrySignal = rawSignalingInfra.getLogicalSignalName(signals[0])
                        val exitSignal =
                            rawSignalingInfra.getLogicalSignalName(signals[signals.size - 1])
                        blockLogAggregator.registerError(
                            "error in block from $entrySignal to $exitSignal: $errorType"
                        )
                    }

                    override fun reportSignal(sigIndex: Int, errorType: String) {
                        val signal = rawSignalingInfra.getLogicalSignalName(signals[sigIndex])
                        signalLogAggregator.registerError("error at signal $signal: $errorType")
                    }
                }
            sigModuleManager.checkSignalingSystemBlock(reporter, sigSystem, sigBlock)
            for ((signal, nextSignal) in signals.windowed(2)) {
                val signalReporter =
                    object : SignalDiagReporter {
                        override fun report(errorType: String) {
                            logger.debug {
                                val signalName = rawSignalingInfra.getLogicalSignalName(signal)
                                val nextSignalName =
                                    rawSignalingInfra.getLogicalSignalName(nextSignal)
                                "error at signal $signalName to $nextSignalName: $errorType"
                            }
                        }
                    }
                val driver =
                    sigModuleManager.findDriver(
                        loadedSignalInfra.getSignalingSystem(signal),
                        loadedSignalInfra.getSignalingSystem(nextSignal),
                    )
                sigModuleManager.checkSignal(
                    signalReporter,
                    driver,
                    loadedSignalInfra.getSettings(signal),
                    sigBlock,
                )
            }
        }
        blockLogAggregator.logAggregatedSummary()
        signalLogAggregator.logAggregatedSummary()
        return blockInfra
    }

    override fun evaluate(
        rawInfra: RawInfra,
        loadedSignalInfra: LoadedSignalInfra,
        blockInfra: BlockInfra,
        trainPath: TrainPath,
        zoneStates: List<ZoneStatus>,
        followingZoneState: ZoneStatus,
        followingSignalState: SigState?,
        followingSignalSettings: SigSettings?,
    ): Map<LogicalSignalId, SigState> {
        // TODO path migration: consider migrating the "zone states"
        //  from list of state to a (ZoneId -> state) map?
        val blockRanges = trainPath.getBlocks()
        val routeRanges = trainPath.getRoutes()
        val zoneRanges = trainPath.getZoneRanges()
        val routeSet by lazy { routeRanges.map { it.value }.toSet() }
        assert(zoneStates.size == zoneRanges.size)


        // compute the index of each block's first zone inside the path
        // TODO path migration: double-check that this would work out with actual backtracks
        val blockToFirstZoneIndex = mutableMapOf<BlockId, Int>()
        val blockToLastZoneIndex = mutableMapOf<BlockId, Int>()
        val zoneIndexMap = zoneRanges.withIndex().associate { it.value.value to it.index }
        for (blockRange in blockRanges) {
            val blockId = blockRange.value
            for (zonePath in blockInfra.getBlockZonePaths(blockId)) {
                val zoneId = rawInfra.getZonePathZone(zonePath)
                val zoneIndex = zoneIndexMap[zoneId]!!
                blockToFirstZoneIndex[blockId] =
                    blockToFirstZoneIndex[blockId]?.let { minOf(it, zoneIndex) } ?: zoneIndex
                blockToLastZoneIndex[blockId] =
                    blockToFirstZoneIndex[blockId]?.let { maxOf(it, zoneIndex) } ?: zoneIndex
            }
        }

        // region compute each signal's protection status first, find all the signals we need to
        // evaluate in this call, and which block they belong to
        data class SignalEvalTask(
            val signal: LogicalSignalId,
            val protectionStatus: ProtectionStatus,
        )

        val signalEvalSequence = ArrayDeque<SignalEvalTask>()
        val lastBlockRange = blockRanges.last()
        val lastBlock = lastBlockRange.value
        val lastBlockEndsAtBufferStop = blockInfra.blockStopAtBufferStop(lastBlock)
        if (!lastBlockEndsAtBufferStop) {
            val blockSignals = blockInfra.getBlockSignals(lastBlock)
            val lastSignal = blockSignals.last()
            signalEvalSequence.add(
                SignalEvalTask(lastSignal, followingZoneState.toProtectionStatus())
            )
        }

        for (blockRange in blockRanges.reversed()) {
            val curBlock = blockRange.value
            val startAtBufferStop = blockInfra.blockStartAtBufferStop(curBlock)
            val endsAtBufferStop = blockInfra.blockStopAtBufferStop(curBlock)
            val blockSignals = blockInfra.getBlockSignals(curBlock)
            // the end signal was already processed at the last iteration,
            // or in the last path signal special case

            // intermediary signals
            val interRangeStart = if (startAtBufferStop) 0 else 1
            val interRangeEnd = if (endsAtBufferStop) blockSignals.size else blockSignals.size - 1
            for (signalIndex in (interRangeStart until interRangeEnd).reversed()) {
                signalEvalSequence.add(
                    SignalEvalTask(blockSignals[signalIndex], ProtectionStatus.NO_PROTECTED_ZONES)
                )
            }

            // entry signal
            if (!startAtBufferStop) {
                val entrySignal = blockSignals[0]
                val protectedZonesStart = blockToFirstZoneIndex[curBlock]!!
                val protectedZonesEnd = blockToLastZoneIndex[curBlock]!! + 1
                var zoneStatus = zoneStates[protectedZonesStart]
                for (i in protectedZonesStart + 1 until protectedZonesEnd) zoneStatus =
                    zoneStatus.reduce(zoneStates[i])
                signalEvalSequence.add(SignalEvalTask(entrySignal, zoneStatus.toProtectionStatus()))
            }
        }
        // endregion

        // region evaluate
        class MovementAuthorityViewImpl(
            override val protectionStatus: ProtectionStatus,
            private val _nextSignalState: SigState?,
            private val _nextSignalSettings: SigSettings?,
        ) : MovementAuthorityView {
            override val hasNextSignal
                get() = _nextSignalState != null

            override val nextSignalState
                get() = _nextSignalState!!

            override val nextSignalSettings
                get() = _nextSignalSettings!!
        }

        val res = mutableMapOf<LogicalSignalId, SigState>()
        var lastSignalState: SigState? = followingSignalState
        var lastSignalSettings: SigSettings? = followingSignalSettings
        var lastSignalSSId: SignalingSystemId? = null
        for (task in signalEvalSequence) {
            val signal = task.signal
            val protectionStatus = task.protectionStatus
            val mav =
                MovementAuthorityViewImpl(protectionStatus, lastSignalState, lastSignalSettings)
            val currentSSId = loadedSignalInfra.getSignalingSystem(signal)
            val currentSignalSettings = loadedSignalInfra.getSettings(signal)
            val driver = sigModuleManager.findDriver(currentSSId, lastSignalSSId ?: currentSSId)
            val schema = sigModuleManager.getStateSchema(currentSSId)

            val parameters = loadedSignalInfra.getParameters(signal)
            var resolvedParameters: SigParameters? = null
            for (route in parameters.conditional.keys) {
                if (routeSet.contains(route)) {
                    resolvedParameters = parameters.conditional[route]
                    break
                }
            }
            resolvedParameters = resolvedParameters ?: parameters.default

            val state =
                sigModuleManager.evalSignal(
                    driver,
                    currentSignalSettings,
                    resolvedParameters,
                    schema,
                    mav,
                    null, // TODO: Handle speed limits
                )

            res[signal] = state
            lastSignalState = state
            lastSignalSettings = currentSignalSettings
            lastSignalSSId = currentSSId
        }
        // endregion

        return res
    }
}
