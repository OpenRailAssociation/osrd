package fr.sncf.osrd.signaling.impl

import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.interfaces.getLegacyBlockPath
import fr.sncf.osrd.path.interfaces.getLegacyRoutePath
import fr.sncf.osrd.signaling.*
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.SignalParameters
import fr.sncf.osrd.sim_infra.impl.loadedSignalInfra
import fr.sncf.osrd.utils.LogAggregator
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
        infra: RawInfra,
        loadedSignalInfra: LoadedSignalInfra,
        blocks: BlockInfra,
        trainPath: TrainPath,
        zoneStates: List<ZoneStatus>,
        followingZoneState: ZoneStatus,
        followingSignalState: SigState?,
        followingSignalSettings: SigSettings?,
    ): Map<LogicalSignalId, SigState> {
        val fullPath = trainPath.getLegacyBlockPath()
        val routes = trainPath.getLegacyRoutePath()
        val evaluatedPathEnd = fullPath.size
        return evaluate(
            infra,
            loadedSignalInfra,
            blocks,
            fullPath,
            routes,
            evaluatedPathEnd,
            zoneStates,
            followingZoneState,
            followingSignalState,
            followingSignalSettings,
            trainPath.getZones().first().value,
        )
    }

    override fun evaluate(
        infra: RawInfra,
        loadedSignalInfra: LoadedSignalInfra,
        blocks: BlockInfra,
        fullPath: List<BlockId>,
        routes: List<RouteId>,
        evaluatedPathEnd: Int,
        zoneStates: List<ZoneStatus>,
        followingZoneState: ZoneStatus,
        followingSignalState: SigState?,
        followingSignalSettings: SigSettings?,
        firstZone: ZoneId?,
    ): Map<LogicalSignalId, SigState> {
        // TODO path migration: remove this overload
        assert(evaluatedPathEnd > 0)
        assert(evaluatedPathEnd <= fullPath.size)
        val routeSet by lazy { routes.toSet() }

        fun getZoneState(i: Int): ZoneStatus {
            // Zones outside the path are considered clear. We can query zone status when they are
            // not included in the path, but still part of a block included in the path.
            return if (i in zoneStates.indices) zoneStates[i] else ZoneStatus.CLEAR
        }

        // compute the offset of each block's first zone inside the partial path
        val blockZoneMap = IntArray(evaluatedPathEnd + 1)
        var blockZoneOffset = 0
        // When the first zone is given, we look for it in the first block and adjust zone indexes.
        // When it's not set, we include all zones in the given blocks.
        val firstZoneOffset =
            if (firstZone == null) 0
            else
                blocks.getBlockZonePaths(fullPath[0]).map(infra::getZonePathZone).indexOf(firstZone)
        for (i in 0 until evaluatedPathEnd) {
            blockZoneMap[i] = blockZoneOffset - firstZoneOffset
            blockZoneOffset += blocks.getBlockZonePaths(fullPath[i]).size
        }
        blockZoneMap[evaluatedPathEnd] = blockZoneOffset

        // region compute each signal's protection status
        // first, find all the signals we need to evaluate in this call, and which block they belong
        // to
        data class SignalEvalTask(
            val signal: LogicalSignalId,
            val protectionStatus: ProtectionStatus,
        )

        val signalEvalSequence = ArrayDeque<SignalEvalTask>()
        val lastBlock = fullPath[evaluatedPathEnd - 1]
        val lastBlockEndsAtBufferStop = blocks.blockStopAtBufferStop(lastBlock)
        if (!lastBlockEndsAtBufferStop) {
            val blockSignals = blocks.getBlockSignals(lastBlock)
            val lastSignal = blockSignals[blockSignals.size - 1]
            signalEvalSequence.add(
                SignalEvalTask(lastSignal, followingZoneState.toProtectionStatus())
            )
        }

        for (blockIndex in (0 until evaluatedPathEnd).reversed()) {
            val curBlock = fullPath[blockIndex]
            val startAtBufferStop = blocks.blockStartAtBufferStop(curBlock)
            val endsAtBufferStop = blocks.blockStopAtBufferStop(curBlock)
            val blockSignals = blocks.getBlockSignals(curBlock)
            // the end signal was already processed at the last iteration,
            // or in the last path signal special case

            // intermediary signals
            val interRangeStart = if (startAtBufferStop) 0 else 1
            val interRangeEnd = if (endsAtBufferStop) blockSignals.size else blockSignals.size - 1
            for (signalIndex in (interRangeStart until interRangeEnd).reversed()) signalEvalSequence
                .add(SignalEvalTask(blockSignals[signalIndex], ProtectionStatus.NO_PROTECTED_ZONES))

            // entry signal
            if (!startAtBufferStop) {
                val entrySignal = blockSignals[0]
                val protectedZonesStart = blockZoneMap[blockIndex]
                val protectedZonesEnd = blockZoneMap[blockIndex + 1]
                var zoneStatus = getZoneState(protectedZonesStart)
                for (i in protectedZonesStart + 1 until protectedZonesEnd) {
                    zoneStatus = zoneStatus.reduce(getZoneState(i))
                }
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
