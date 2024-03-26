package fr.sncf.osrd.signaling.impl

import fr.sncf.osrd.signaling.*
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.SignalParameters
import fr.sncf.osrd.sim_infra.impl.loadedSignalInfra
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
        schema: SigSettingsSchema
    ): SigSettings {
        return schema(rawSettings)
    }

    private fun loadSignalParameters(
        rawParameters: RawSignalParameters,
        schema: SigParametersSchema
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
                                sigModuleManager.findSignalingSystem(oldSignalingSystemId)
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
                                val oldNextSSId = sigModuleManager.findSignalingSystem(oldNextSS)
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
        loadedSignalInfra: LoadedSignalInfra
    ): BlockInfra {
        val blockInfra = internalBuildBlocks(sigModuleManager, rawSignalingInfra, loadedSignalInfra)
        for (block in blockInfra.blocks) {
            val sigSystem = blockInfra.getBlockSignalingSystem(block)
            val path = blockInfra.getBlockPath(block)
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
                    length
                )
            val reporter =
                object : BlockDiagReporter {
                    override fun reportBlock(errorType: String) {
                        logger.debug {
                            val entrySignal = rawSignalingInfra.getLogicalSignalName(signals[0])
                            val exitSignal =
                                rawSignalingInfra.getLogicalSignalName(signals[signals.size - 1])
                            "error in block from $entrySignal to $exitSignal: $errorType"
                        }
                    }

                    override fun reportSignal(sigIndex: Int, errorType: String) {
                        logger.debug {
                            val signal = rawSignalingInfra.getLogicalSignalName(signals[sigIndex])
                            "error at signal $signal: $errorType"
                        }
                    }
                }
            sigModuleManager.checkSignalingSystemBlock(reporter, sigSystem, sigBlock)
        }
        return blockInfra
    }

    override fun evaluate(
        infra: RawInfra,
        loadedSignalInfra: LoadedSignalInfra,
        blocks: BlockInfra,
        fullPath: StaticIdxList<Block>,
        routes: List<RouteId>,
        evaluatedPathEnd: Int,
        zoneStates: List<ZoneStatus>,
        followingZoneState: ZoneStatus,
        followingSignalState: SigState?,
        followingSignalSettings: SigSettings?,
    ): Map<LogicalSignalId, SigState> {
        assert(evaluatedPathEnd > 0)
        assert(evaluatedPathEnd <= fullPath.size)
        val routeSet = routes.toSet()

        // compute the offset of each block's first zone inside the partial path
        val blockZoneMap = IntArray(evaluatedPathEnd + 1)
        var blockZoneOffset = 0
        for (i in 0 until evaluatedPathEnd) {
            blockZoneMap[i] = blockZoneOffset
            blockZoneOffset += blocks.getBlockPath(fullPath[i]).size
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
            private val _nextSignalSettings: SigSettings?
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
        var lastSignalSettings: SigSettings? = null
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
                    null // TODO: Handle speed limits
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
