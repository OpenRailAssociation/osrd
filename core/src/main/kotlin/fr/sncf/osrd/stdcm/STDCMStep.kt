package fr.sncf.osrd.stdcm

import fr.sncf.osrd.infra.api.signaling.SignalingRoute
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeLocation

@JvmRecord
data class STDCMStep(
    @JvmField val locations: Collection<EdgeLocation<SignalingRoute>>,
    val duration: Double,
    val stop: Boolean
)
