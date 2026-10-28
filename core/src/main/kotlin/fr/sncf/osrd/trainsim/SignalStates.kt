package fr.sncf.osrd.trainsim

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.signaling.ZoneStatus
import fr.sncf.osrd.sim_infra.api.LogicalSignalId
import fr.sncf.osrd.sim_infra.api.SigState
import fr.sncf.osrd.sim_infra.api.ZoneId

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
