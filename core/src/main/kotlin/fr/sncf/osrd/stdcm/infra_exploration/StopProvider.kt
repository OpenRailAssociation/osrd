package fr.sncf.osrd.stdcm.infra_exploration

import com.google.common.collect.HashMultimap
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.stdcm.STDCMStep
import fr.sncf.osrd.utils.units.Offset

/** Provides the stops to the `InfraExplorer` as it moves on the infra. */
fun interface StopProvider {
    fun getStops(block: BlockId): Set<ExplorerStopInput>
}

/** Contains the data we have on the stop, *except* the stop duration. */
data class ExplorerStopInput(
    val block: BlockId,
    val offset: Offset<Block>,
    val receptionSignal: RJSReceptionSignal,
    // If true, two scenarios will be considered (with and without).
    // (not yet implemented though)
    val optional: Boolean,
    // If true, the path ends there.
    val isLastArrival: Boolean,
)

fun stopProviderFromSteps(steps: List<STDCMStep>): StopProvider {
    val map = HashMultimap.create<BlockId, ExplorerStopInput>()
    for ((i, step) in steps.withIndex()) {
        if (!step.stop) continue
        val last = i == steps.lastIndex
        for (location in step.locations) {
            // We guess some parameters that should ideally be forwarded from
            // the request, but this gives a clear place to put them later on
            map.put(
                location.edge,
                ExplorerStopInput(
                    location.edge,
                    location.offset,
                    RJSReceptionSignal.SHORT_SLIP_STOP,
                    optional = false,
                    isLastArrival = last,
                )
            )
        }
    }
    return StopProvider { block: BlockId -> map.get(block) }
}

fun stopProviderFromArrival(
    arrivalLocations: Collection<PathfindingEdgeLocationId<Block>>
): StopProvider {
    val map = HashMultimap.create<BlockId, ExplorerStopInput>()
    for (location in arrivalLocations) {
        map.put(
            location.edge,
            ExplorerStopInput(
                location.edge,
                location.offset,
                RJSReceptionSignal.SHORT_SLIP_STOP,
                optional = false,
                isLastArrival = true,
            )
        )
    }
    return StopProvider { block: BlockId -> map.get(block) }
}

fun emptyStopProvider(): StopProvider {
    return StopProvider { _: BlockId -> setOf() }
}
