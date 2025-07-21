package fr.sncf.osrd.path

import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.Route
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset

/**
 * This class is in charge of all projections across path types. For now the only implemented
 * projections are among "adjacent" path types, but it can easily be extended.
 */
data class PathOffsetProjector(
    val firstBlockOffset: Offset<FullRoutePath>,
    val coveredPathBeginOffset: Offset<FullBlockPath>,
    val coveredPathEndOffset: Offset<FullBlockPath>,
    val backtrackLocations: List<BacktrackLocation>,
) {
    data class BacktrackLocation(
        val coveredPathOffset: Offset<CoveredPath>,
        val rollingStockLength: Distance,

        // The following data is used to identify where to "cut" the block and route paths,
        // without adding an explicit Infra dependency.
        val previousBlockLength: Length<Block>,
        val nextBlockLength: Length<Block>,
        val previousRouteLength: Length<Route>,
        val nextRouteLength: Length<Route>,
    ) {
        // TODO: add constructors, especially with infra and block/route lists
    }

    // TODO: add convenient constructors

    fun routeToBlock(routeOffset: Offset<FullRoutePath>): Offset<FullBlockPath> {
        TODO()
    }

    fun blockToRoute(blockOffset: Offset<FullBlockPath>): Offset<FullRoutePath> {
        TODO()
    }

    fun blockToCovered(blockOffset: Offset<FullBlockPath>): Offset<CoveredPath> {
        TODO()
    }

    fun coveredToBlock(coveredOffset: Offset<CoveredPath>): Offset<FullBlockPath> {
        TODO()
    }

    fun coveredToHeadTravelled(coveredOffset: Offset<CoveredPath>): Offset<HeadTravelledPath> {
        TODO()
    }

    fun headTravelledToCovered(headTravelled: Offset<HeadTravelledPath>): Offset<CoveredPath> {
        TODO()
    }
}
