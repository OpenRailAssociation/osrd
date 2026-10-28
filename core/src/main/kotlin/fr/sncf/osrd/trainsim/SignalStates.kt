package fr.sncf.osrd.trainsim

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.signaling.ZoneStatus
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.LogicalSignalId
import fr.sncf.osrd.sim_infra.api.SigState
import fr.sncf.osrd.sim_infra.api.ZoneId
import fr.sncf.osrd.standalone_sim.PathSignal
import fr.sncf.osrd.standalone_sim.pathSignals

fun signalStates(
    fullInfra: FullInfra,
    path: TrainPath,
    occupied: Set<ZoneId>,
): Map<LogicalSignalId, SigState> {
    val zoneStates =
        path
            .getZoneRanges()
            .withIndex()
            .filter { it.value.value in occupied }
            .associate { it.index to ZoneStatus.OCCUPIED }
    return fullInfra.signalingSimulator.evaluate(
        fullInfra.rawInfra,
        fullInfra.loadedSignalInfra,
        fullInfra.blockInfra,
        path,
        zoneStates,
        ZoneStatus.CLEAR,
    )
}

fun signalsAhead(
    blockInfra: BlockInfra,
    path: TrainPath,
    head: PreciseDistance,
    states: Map<LogicalSignalId, SigState>,
): Map<PathSignal, SigState> =
    pathSignals(path, blockInfra)
        .filter { it.pathOffset.toPrecise() >= head }
        .associateWith { states.getValue(it.signal) }
