package fr.sncf.osrd.signaling.impl

import fr.sncf.osrd.signaling.*
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.api.SignalDriver
import fr.sncf.osrd.utils.indexing.StaticIdxSpace
import fr.sncf.osrd.utils.indexing.StaticPool

class SigSystemManagerImpl : SigSystemManager {
    private val sigSystemMap = mutableMapOf<String, SignalingSystemId>()
    private val sigSystemPool = StaticPool<SignalingSystem, SignalingSystemDriver>()
    private val driverMap =
        mutableMapOf<Pair<SignalingSystemId, SignalingSystemId>, SignalDriverId>()
    private val driverPool = StaticPool<SignalDriver, fr.sncf.osrd.signaling.SignalDriver>()

    fun addSignalingSystem(sigSystem: SignalingSystemDriver): SignalingSystemId {
        val res = sigSystemPool.add(sigSystem)
        sigSystemMap[sigSystem.id] = res
        return res
    }

    fun addSignalDriver(sigDriver: fr.sncf.osrd.signaling.SignalDriver): SignalDriverId {
        val res = driverPool.add(sigDriver)
        driverMap[
            Pair(
                findSignalingSystem(sigDriver.outputSignalingSystem),
                findSignalingSystem(sigDriver.inputSignalingSystem)
            )] = res
        return res
    }

    override fun evalSignal(
        driverId: SignalDriverId,
        signal: SigSettings,
        parameters: SigParameters,
        stateSchema: SigStateSchema,
        maView: MovementAuthorityView?,
        limitView: SpeedLimitView?
    ): SigState {
        val driver = driverPool[driverId]
        return driver.evalSignal(signal, parameters, stateSchema, maView, limitView)
    }

    override fun isConstraining(
        signalingSystem: SignalingSystemId,
        signalState: SigState,
        trainState: SignalingTrainState
    ): Boolean {
        val driver = sigSystemPool[signalingSystem]
        return driver.isConstraining(signalState, trainState)
    }

    override val signalingSystems: StaticIdxSpace<SignalingSystem>
        get() = sigSystemPool.space()

    override fun findSignalingSystem(sigSystem: String): SignalingSystemId {
        return sigSystemMap[sigSystem]!!
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

    override val drivers
        get() = driverPool.space()

    override fun findDriver(
        outputSig: SignalingSystemId,
        inputSig: SignalingSystemId
    ): SignalDriverId {
        return driverMap[Pair(outputSig, inputSig)]!!
    }

    override fun getInputSignalingSystem(driver: SignalDriverId): SignalingSystemId {
        return findSignalingSystem(driverPool[driver].inputSignalingSystem)
    }

    override fun getOutputSignalingSystem(driver: SignalDriverId): SignalingSystemId {
        return findSignalingSystem(driverPool[driver].outputSignalingSystem)
    }

    override fun isBlockDelimiter(sigSystem: SignalingSystemId, settings: SigSettings): Boolean {
        return evalSigSettings(sigSystemPool[sigSystem].isBlockDelimiterExpr, settings)
    }

    override fun checkSignalingSystemBlock(
        reporter: BlockDiagReporter,
        sigSystem: SignalingSystemId,
        block: SigBlock
    ) {
        sigSystemPool[sigSystem].checkBlock(reporter, block)
    }
}
