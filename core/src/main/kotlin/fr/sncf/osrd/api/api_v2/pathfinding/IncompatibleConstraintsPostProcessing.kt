package fr.sncf.osrd.api.api_v2.pathfinding

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.pathfinding.constraints.ElectrificationConstraints
import fr.sncf.osrd.api.pathfinding.constraints.LoadingGaugeConstraints
import fr.sncf.osrd.api.pathfinding.constraints.SignalingSystemConstraints
import fr.sncf.osrd.api.pathfinding.makePathProps
import fr.sncf.osrd.graph.*
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.filterIntersection
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset

fun buildIncompatibleConstraintsResponse(
    infra: FullInfra,
    possiblePathWithoutErrorNoConstraints: PathfindingResultId<Block>?,
    constraints: Collection<PathfindingConstraint<Block>>,
    initialRequest: PathfindingBlockRequest,
): IncompatibleConstraintsPathResponse? {
    if (
        possiblePathWithoutErrorNoConstraints == null ||
            possiblePathWithoutErrorNoConstraints.ranges.isEmpty()
    )
        return null

    val pathRanges = possiblePathWithoutErrorNoConstraints.ranges
    val pathProps =
        makePathProps(infra.rawInfra, infra.blockInfra, pathRanges.map { it.edge }, Offset.zero())

    val elecConstraints = constraints.filterIsInstance<ElectrificationConstraints>()
    assert(elecConstraints.size < 2)
    val elecBlockedRangeValues =
        getConstraintsDistanceRange(
                infra,
                pathRanges,
                pathProps.getElectrification(),
                elecConstraints.firstOrNull()
            )
            .map { RangeValue(Pathfinding.Range(Offset(it.lower), Offset(it.upper)), it.value) }

    val gaugeConstraints = constraints.filterIsInstance<LoadingGaugeConstraints>()
    assert(gaugeConstraints.size < 2)
    val gaugeBlockedRanges =
        getConstraintsDistanceRange(
                infra,
                pathRanges,
                pathProps.getLoadingGauge(),
                gaugeConstraints.firstOrNull()
            )
            .map { RangeValue<String>(Pathfinding.Range(Offset(it.lower), Offset(it.upper)), null) }

    val signalingSystemConstraints = constraints.filterIsInstance<SignalingSystemConstraints>()
    assert(signalingSystemConstraints.size < 2)
    val blockList = pathRanges.map { it.edge }
    val pathSignalingSystem = getPathSignalingSystems(infra, blockList)
    val signalingSystemBlockedRangeValues =
        getConstraintsDistanceRange(
                infra,
                pathRanges,
                pathSignalingSystem,
                signalingSystemConstraints.firstOrNull()
            )
            .map { RangeValue(Pathfinding.Range(Offset(it.lower), Offset(it.upper)), it.value) }

    if (
        listOf(elecBlockedRangeValues, gaugeBlockedRanges, signalingSystemBlockedRangeValues).all {
            it.isEmpty()
        }
    ) {
        return null
    }

    return IncompatibleConstraintsPathResponse(
        runPathfindingPostProcessing(infra, initialRequest, possiblePathWithoutErrorNoConstraints),
        IncompatibleConstraints(
            elecBlockedRangeValues,
            gaugeBlockedRanges,
            signalingSystemBlockedRangeValues
        )
    )
}

private fun <T> getConstraintsDistanceRange(
    infra: FullInfra,
    pathRanges: List<Pathfinding.EdgeRange<BlockId, Block>>,
    pathConstrainedValues: DistanceRangeMap<T>,
    constraint: PathfindingConstraint<Block>?
): DistanceRangeMap<T> {
    if (constraint == null) {
        return distanceRangeMapOf()
    }

    val blockedRanges = getBlockedRanges(infra, pathRanges, constraint)
    val filteredRangeValues = filterIntersection(pathConstrainedValues, blockedRanges)
    val travelledPathOffset = pathRanges.first().start.distance
    filteredRangeValues.shiftPositions(-travelledPathOffset)
    return filteredRangeValues
}

private fun getBlockedRanges(
    infra: FullInfra,
    pathRanges: List<Pathfinding.EdgeRange<BlockId, Block>>,
    currentConstraint: PathfindingConstraint<Block>
): DistanceRangeMap<Boolean> {
    val blockList = pathRanges.map { it.edge }
    val blockedRanges = distanceRangeMapOf<Boolean>()
    var startBlockPathOffset = Distance.ZERO
    for (block in blockList) {
        currentConstraint.apply(block).map {
            blockedRanges.put(
                startBlockPathOffset + it.start.distance,
                startBlockPathOffset + it.end.distance,
                true
            )
        }
        startBlockPathOffset += infra.blockInfra.getBlockLength(block).distance
    }
    blockedRanges.truncate(
        pathRanges.first().start.distance,
        startBlockPathOffset - infra.blockInfra.getBlockLength(blockList.last()).distance +
            pathRanges.last().end.distance
    )
    return blockedRanges
}

private fun getPathSignalingSystems(
    infra: FullInfra,
    blockList: List<BlockId>
): DistanceRangeMap<String> {
    val pathSignalingSystem = distanceRangeMapOf<String>()
    var startBlockPathOffset = Distance.ZERO
    for (block in blockList) {
        val blockLength = infra.blockInfra.getBlockLength(block).distance
        val blockSignalingSystemIdx = infra.blockInfra.getBlockSignalingSystem(block)
        val blockSignalingSystemName =
            infra.signalingSimulator.sigModuleManager.getName(blockSignalingSystemIdx)
        pathSignalingSystem.put(
            startBlockPathOffset,
            startBlockPathOffset + blockLength,
            blockSignalingSystemName
        )
        startBlockPathOffset += blockLength
    }
    return pathSignalingSystem
}
