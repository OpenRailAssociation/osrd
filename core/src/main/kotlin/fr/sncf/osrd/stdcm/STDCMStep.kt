package fr.sncf.osrd.stdcm

import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.sim_infra.api.Block

data class STDCMStep(
    val locations: Collection<PathfindingEdgeLocationId<Block>>,
    val duration: Double?,
    val stop: Boolean
)
