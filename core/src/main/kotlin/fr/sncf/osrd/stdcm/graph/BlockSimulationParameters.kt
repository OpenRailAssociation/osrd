package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorer
import fr.sncf.osrd.utils.units.Offset

data class BlockSimulationParameters(
    val infraExplorer: InfraExplorer,
    val initialSpeed: Double,
    val start: Offset<Block>,
    val stop: Offset<Block>?
)
