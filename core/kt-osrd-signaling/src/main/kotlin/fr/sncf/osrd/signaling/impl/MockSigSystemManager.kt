package fr.sncf.osrd.signaling.impl

import fr.sncf.osrd.signaling.BlockDiagReporter
import fr.sncf.osrd.signaling.MovementAuthorityView
import fr.sncf.osrd.signaling.SigBlock
import fr.sncf.osrd.signaling.SigSystemManager
import fr.sncf.osrd.signaling.SignalDiagReporter
import fr.sncf.osrd.signaling.SignalingTrainState
import fr.sncf.osrd.signaling.SpeedLimitView
import fr.sncf.osrd.sim_infra.api.SigParameters
import fr.sncf.osrd.sim_infra.api.SigParametersSchema
import fr.sncf.osrd.sim_infra.api.SigSettings
import fr.sncf.osrd.sim_infra.api.SigSettingsSchema
import fr.sncf.osrd.sim_infra.api.SigState
import fr.sncf.osrd.sim_infra.api.SigStateSchema
import fr.sncf.osrd.sim_infra.api.SignalDriver
import fr.sncf.osrd.sim_infra.api.SignalDriverId
import fr.sncf.osrd.sim_infra.api.SignalingSystem
import fr.sncf.osrd.sim_infra.api.SignalingSystemId
import fr.sncf.osrd.utils.indexing.StaticIdxSpace

class MockSigSystemManager(
    val sigSystem: String,
    val settingsSchema: SigSettingsSchema,
    val parametersSchema: SigParametersSchema
) : SigSystemManager {
    override fun checkSignalingSystemBlock(
        reporter: BlockDiagReporter,
        sigSystem: SignalingSystemId,
        block: SigBlock
    ) {}

    override fun checkSignal(
        reporter: SignalDiagReporter,
        driverId: SignalDriverId,
        settings: SigSettings,
        sigBlock: SigBlock
    ) {}

    override fun evalSignal(
        driverId: SignalDriverId,
        signal: SigSettings,
        parameters: SigParameters,
        stateSchema: SigStateSchema,
        maView: MovementAuthorityView?,
        limitView: SpeedLimitView?
    ): SigState {
        TODO("Not yet implemented")
    }

    override fun isConstraining(
        signalingSystem: SignalingSystemId,
        signalState: SigState,
        trainState: SignalingTrainState
    ): Boolean {
        TODO("Not yet implemented")
    }

    override val signalingSystems: StaticIdxSpace<SignalingSystem>
        get() = StaticIdxSpace(1u)

    override fun findSignalingSystem(sigSystem: String): SignalingSystemId? {
        if (sigSystem != this.sigSystem) return null
        return SignalingSystemId(0u)
    }

    override fun getStateSchema(sigSystem: SignalingSystemId): SigStateSchema {
        TODO("Not yet implemented")
    }

    override fun getSettingsSchema(sigSystem: SignalingSystemId): SigSettingsSchema {
        return settingsSchema
    }

    override fun getParametersSchema(sigSystem: SignalingSystemId): SigParametersSchema {
        return parametersSchema
    }

    override fun getName(sigSystem: SignalingSystemId): String {
        return this.sigSystem
    }

    override val drivers: StaticIdxSpace<SignalDriver>
        get() = StaticIdxSpace(1u)

    override fun findDriver(
        outputSig: SignalingSystemId,
        inputSig: SignalingSystemId
    ): SignalDriverId {
        assert(outputSig == SignalingSystemId(0u) && inputSig == SignalingSystemId(0u))
        return SignalDriverId(0u)
    }

    override fun getInputSignalingSystem(driver: SignalDriverId): SignalingSystemId {
        assert(driver == SignalDriverId(0u))
        return SignalingSystemId(0u)
    }

    override fun getOutputSignalingSystem(driver: SignalDriverId): SignalingSystemId {
        assert(driver == SignalDriverId(0u))
        return SignalingSystemId(0u)
    }

    override fun isBlockDelimiter(sigSystem: SignalingSystemId, settings: SigSettings): Boolean {
        return true
    }
}
