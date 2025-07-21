package fr.sncf.osrd.path.interfaces

import fr.sncf.osrd.path.implementations.PathOffsetProjector
import fr.sncf.osrd.utils.units.Offset

/** TODO: reference a picture showing how each path relates to one another. */
interface TrainPath : FullRoutePath, FullBlockPath, CoveredPath, HeadTravelledPath {
    fun subPath(from: Offset<HeadTravelledPath>?, to: Offset<HeadTravelledPath>?): TrainPath

    val projector: PathOffsetProjector
}

fun concat(vararg paths: TrainPath): TrainPath {
    TODO()
}
