package fr.sncf.osrd.stdcm

import fr.sncf.osrd.graph.Pathfinding.EdgeLocation
import fr.sncf.osrd.sim_infra.api.BlockId

data class STDCMStep(
    val locations: Collection<EdgeLocation<BlockId>>,
    val duration: Double?,
    val stop: Boolean
)
