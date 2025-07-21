package fr.sncf.osrd.path.implementations

import fr.sncf.osrd.path.interfaces.FullBlockPath
import fr.sncf.osrd.path.interfaces.FullRoutePath
import fr.sncf.osrd.path.interfaces.HeadTravelledPath
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.RouteId
import fr.sncf.osrd.utils.units.Offset

class TrainPathImpl(override val projector: PathOffsetProjector) : TrainPath {

    // TODO: constructors

    override fun subPath(
        from: Offset<HeadTravelledPath>?,
        to: Offset<HeadTravelledPath>?
    ): TrainPath {
        TODO("Not yet implemented")
    }

    override fun getRoutes(): List<RouteId> {
        TODO("Not yet implemented")
    }

    override fun getRouteOffsets(): List<Offset<FullRoutePath>> {
        TODO("Not yet implemented")
    }

    override fun getBlocks(): List<BlockId> {
        TODO("Not yet implemented")
    }

    override fun getBlockOffsets(): List<Offset<FullBlockPath>> {
        TODO("Not yet implemented")
    }
}
