package fr.sncf.osrd.api.pathfinding

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.graph.*
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.pathfinding.Pathfinding
import fr.sncf.osrd.pathfinding.constraints.ElectrificationConstraints
import fr.sncf.osrd.pathfinding.constraints.LoadingGaugeConstraints
import fr.sncf.osrd.pathfinding.constraints.SignalingSystemConstraints
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.filterIntersection
import fr.sncf.osrd.utils.units.Offset

fun buildIncompatibleConstraintsResponse(
    infra: FullInfra,
    possiblePathWithoutErrorNoConstraints: ProcessedPathfindingResponse,
    constraints: Collection<PathfindingConstraint<Block>>,
    initialRequest: PathfindingBlockRequest,
): IncompatibleConstraintsPathResponse? {
    val path = possiblePathWithoutErrorNoConstraints.path
    if (hasDuplicateTracks(infra, path)) return null

    val elecConstraints = constraints.filterIsInstance<ElectrificationConstraints>()
    assert(elecConstraints.size < 2)
    val elecBlockedRangeValues =
        getConstraintsDistanceRange(path, path.getElectrification(), elecConstraints.firstOrNull())
            .map {
                RangeValue(
                    Pathfinding.Range(Offset(it.lower), Offset(it.upper)),
                    it.value.joinToString(","),
                )
            }

    val gaugeConstraints = constraints.filterIsInstance<LoadingGaugeConstraints>()
    assert(gaugeConstraints.size < 2)
    val gaugeBlockedRanges =
        getConstraintsDistanceRange(path, path.getLoadingGauge(), gaugeConstraints.firstOrNull())
            .map { RangeValue<String>(Pathfinding.Range(Offset(it.lower), Offset(it.upper)), null) }

    val signalingSystemConstraints = constraints.filterIsInstance<SignalingSystemConstraints>()
    assert(signalingSystemConstraints.size < 2)
    val pathSignalingSystem = getPathSignalingSystems(infra, path)
    val signalingSystemBlockedRangeValues =
        getConstraintsDistanceRange(
                path,
                pathSignalingSystem,
                signalingSystemConstraints.firstOrNull(),
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
            signalingSystemBlockedRangeValues,
        ),
    )
}

private fun <T> getConstraintsDistanceRange(
    path: TrainPath,
    pathConstrainedValues: DistanceRangeMap<T>,
    constraint: PathfindingConstraint<Block>?,
): DistanceRangeMap<T> {
    if (constraint == null) {
        return distanceRangeMapOf()
    }

    val blockedRanges = getBlockedRanges(path, constraint)
    val filteredRangeValues = filterIntersection(pathConstrainedValues, blockedRanges)
    return filteredRangeValues
}

private fun getBlockedRanges(
    path: TrainPath,
    currentConstraint: PathfindingConstraint<Block>,
): DistanceRangeMap<Boolean> {
    val blockList = path.getBlocks()
    val blockedRanges = distanceRangeMapOf<Boolean>()
    for (blockRange in blockList) {
        currentConstraint.apply(blockRange.value).map {
            blockedRanges.put(
                blockRange.offsetToTrainPath(it.start).distance,
                blockRange.offsetToTrainPath(it.end).distance,
                true,
            )
        }
    }
    return blockedRanges
}

private fun getPathSignalingSystems(infra: FullInfra, path: TrainPath): DistanceRangeMap<String> {
    val pathSignalingSystem = distanceRangeMapOf<String>()
    for (blockRange in path.getBlocks()) {
        val blockSignalingSystemIdx = infra.blockInfra.getBlockSignalingSystem(blockRange.value)
        val blockSignalingSystemName =
            infra.signalingSimulator.sigModuleManager.getName(blockSignalingSystemIdx)
        pathSignalingSystem.put(
            blockRange.pathBegin.distance,
            blockRange.pathEnd.distance,
            blockSignalingSystemName,
        )
    }
    return pathSignalingSystem
}
