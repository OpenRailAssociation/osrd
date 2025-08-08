package fr.sncf.osrd.signaling.impl

import fr.sncf.osrd.signaling.*
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.api.SignalDriver
import fr.sncf.osrd.utils.indexing.StaticIdxSpace
import fr.sncf.osrd.utils.indexing.StaticPool

class SigSystemManagerImpl : SigSystemManager {
    private val sigSystemMap = mutableMapOf<String, SignalingSystemId>()
    private val sigSystemPool = StaticPool<SignalingSystem, SignalingSystemDriver>()
    private val sigSystemCost = mutableMapOf<SignalingSystemId, Double>()
    private val driverMap =
        mutableMapOf<Pair<SignalingSystemId, SignalingSystemId>, SignalDriverId>()
    private val driverPool = StaticPool<SignalDriver, fr.sncf.osrd.signaling.SignalDriver>()

    // cost must be in [0; 1] (used to choose block when everything else is equal)
    fun addSignalingSystem(sigSystem: SignalingSystemDriver, cost: Double): SignalingSystemId {
        val res = sigSystemPool.add(sigSystem)
        sigSystemMap[sigSystem.id] = res
        assert(cost in 0.0..1.0) { "Signaling system costs must be normalized in [0; 1]" }
        sigSystemCost[res] = cost
        return res
    }

    fun addSignalDriver(sigDriver: fr.sncf.osrd.signaling.SignalDriver): SignalDriverId {
        val res = driverPool.add(sigDriver)
        driverMap[
            Pair(
                findSignalingSystemOrThrow(sigDriver.outputSignalingSystem),
                findSignalingSystemOrThrow(sigDriver.inputSignalingSystem),
            )] = res
        return res
    }

    override fun evalSignal(
        driverId: SignalDriverId,
        signal: SigSettings,
        parameters: SigParameters,
        stateSchema: SigStateSchema,
        maView: MovementAuthorityView?,
        limitView: SpeedLimitView?,
    ): SigState {
        val driver = driverPool[driverId]
        return driver.evalSignal(signal, parameters, stateSchema, maView, limitView)
    }

    override fun isConstraining(
        signalingSystem: SignalingSystemId,
        signalState: SigState,
        trainState: SignalingTrainState,
    ): Boolean {
        val driver = sigSystemPool[signalingSystem]
        return driver.isConstrainingOnSight(signalState, trainState)
    }

    override val signalingSystems: StaticIdxSpace<SignalingSystem>
        get() = sigSystemPool.space()

    override fun findSignalingSystem(sigSystem: String): SignalingSystemId? {
        return sigSystemMap[sigSystem]
    }

    override fun getStateSchema(sigSystem: SignalingSystemId): SigStateSchema {
        return sigSystemPool[sigSystem].stateSchema
    }

    override fun getSettingsSchema(sigSystem: SignalingSystemId): SigSettingsSchema {
        return sigSystemPool[sigSystem].settingsSchema
    }

    override fun getParametersSchema(sigSystem: SignalingSystemId): SigParametersSchema {
        return sigSystemPool[sigSystem].parametersSchema
    }

    override fun getName(sigSystem: SignalingSystemId): String {
        return sigSystemPool[sigSystem].id
    }

    override fun isCurveBased(sigSystem: SignalingSystemId): Boolean {
        return sigSystemPool[sigSystem].isCurveBased
    }

    override fun getCost(sigSystem: SignalingSystemId): Double {
        return sigSystemCost[sigSystem]
            ?: throw RuntimeException("signaling system does not have an assigned cost")
    }

    override val drivers
        get() = driverPool.space()

    override fun findDriver(
        outputSig: SignalingSystemId,
        inputSig: SignalingSystemId,
    ): SignalDriverId {
        return driverMap[Pair(outputSig, inputSig)]!!
    }

    override fun getInputSignalingSystem(driver: SignalDriverId): SignalingSystemId {
        return findSignalingSystemOrThrow(driverPool[driver].inputSignalingSystem)
    }

    override fun getOutputSignalingSystem(driver: SignalDriverId): SignalingSystemId {
        return findSignalingSystemOrThrow(driverPool[driver].outputSignalingSystem)
    }

    override fun isBlockDelimiter(sigSystem: SignalingSystemId, settings: SigSettings): Boolean {
        return evalSigSettings(sigSystemPool[sigSystem].isBlockDelimiterExpr, settings)
    }

    override fun isRouteDelimiter(sigSystem: SignalingSystemId, settings: SigSettings): Boolean {
        return evalSigSettings(sigSystemPool[sigSystem].isRouteDelimiterExpr, settings)
    }

    override fun checkSignalingSystemBlock(
        reporter: BlockDiagReporter,
        sigSystem: SignalingSystemId,
        block: SigBlock,
    ) {
        sigSystemPool[sigSystem].checkBlock(reporter, block)
    }

    override fun checkSignal(
        reporter: SignalDiagReporter,
        driverId: SignalDriverId,
        settings: SigSettings,
        sigBlock: SigBlock,
    ) {
        driverPool[driverId].checkSignal(reporter, settings, sigBlock)
    }
}
