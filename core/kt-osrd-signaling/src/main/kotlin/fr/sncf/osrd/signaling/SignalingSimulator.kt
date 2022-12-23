package fr.sncf.osrd.signaling

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.indexing.IdxMap
import fr.sncf.osrd.utils.indexing.StaticIdxList

/*
 * val signalingModuleManager = SignalingModuleManager()
 * val loadedSignalInfra = loadSignals(unloadedSignalInfra, signalingModuleManager)
 * val blocks = buildBlock(signalingRoutingInfra, loadedSignalInfra, signalingModuleManager)
 */

enum class ZoneStatus {
    /** The zone is clear to be used by the train */
    CLEAR,

    /** The zone is occupied by another train, but otherwise clear to use */
    OCCUPIED,

    /** The zone is incompatible. There may be another train as well */
    INCOMPATIBLE,
}

interface SigSystemManager : InfraSigSystemManager {
    fun checkSignalingSystemBlock(reporter: BlockDiagReporter, sigSystem: SignalingSystemId, block: SigBlock)
    fun evalSignal(
        driverId: SignalDriverId,
        signal: SigSettings,
        stateSchema: SigStateSchema,
        maView: MovementAuthorityView?,
        limitView: SpeedLimitView?
    ): SigState
}

interface SignalingSimulator {
    val sigModuleManager: InfraSigSystemManager
    fun loadSignals(unloadedSignalInfra: RawSignalingInfra): LoadedSignalInfra
    fun buildBlocks(
        rawSignalingInfra: RawSignalingInfra,
        loadedSignalInfra: LoadedSignalInfra
    ): BlockInfra

    fun evaluate(
        infra: RawInfra,
        loadedSignalInfra: LoadedSignalInfra,
        blocks: BlockInfra,
        fullPath: StaticIdxList<Block>,
        evaluatedPathBegin: Int,
        evaluatedPathEnd: Int,
        zoneStates: List<ZoneStatus>
    ): IdxMap<LogicalSignalId, SigState>
}
