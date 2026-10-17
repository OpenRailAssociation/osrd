package fr.sncf.osrd.sim_infra.impl

import fr.sncf.osrd.sim_infra.api.DirTrackChunkId
import fr.sncf.osrd.sim_infra.api.SpeedLimitProperty
import fr.sncf.osrd.utils.DistanceRangeMap

class TemporarySpeedLimitManager(
    val speedLimits: Map<DirTrackChunkId, DistanceRangeMap<SpeedLimitProperty>>,
) {
    constructor() : this(speedLimits = mutableMapOf()) {}
}
