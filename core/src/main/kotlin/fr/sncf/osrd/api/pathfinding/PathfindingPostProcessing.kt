package fr.sncf.osrd.api.pathfinding

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.interfaces.toJsonTrainPath
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.utils.units.Offset

fun runPathfindingPostProcessing(
    infra: FullInfra,
    initialRequest: PathfindingBlockRequest,
    rawPath: ProcessedPathfindingResponse,
): PathfindingBlockSuccess {
    val res = runPathfindingBlockPostProcessing(infra, rawPath.path, rawPath.offsets)
    validatePathfindingResponse(infra, initialRequest, res)
    return res
}

fun runPathfindingBlockPostProcessing(
    infra: FullInfra,
    trainPath: TrainPath,
    waypointOffsets: List<Offset<TrainPath>>,
): PathfindingBlockSuccess {
    return PathfindingBlockSuccess(
        trainPath.toJsonTrainPath(infra.rawInfra, infra.blockInfra),
        trainPath.getTypedLength(),
        waypointOffsets,
    )
}

private fun validatePathfindingResponse(
    infra: FullInfra,
    req: PathfindingBlockRequest,
    res: PathfindingBlockResponse,
) {
    // TODO path migrations: some of those checks won't be true anymore with backtracks
    if (res !is PathfindingBlockSuccess) return

    val trainPath = res.path.toTrainPath(infra.rawInfra, infra.blockInfra, null)
    val blocks = trainPath.getBlocks()
    for ((i, blockRange) in blocks.withIndex()) {
        val block = blockRange.value
        val stopAtBufferStop = infra.blockInfra.blockStopAtBufferStop(block)
        val isLastBlock = i == blocks.size - 1
        if (stopAtBufferStop && !isLastBlock) {
            val zonePath = infra.blockInfra.getBlockZonePaths(block).last()
            val detector = infra.rawInfra.getZonePathExit(zonePath)
            val detectorName = infra.rawInfra.getDetectorName(detector.value)
            val err = OSRDError(ErrorType.MissingSignalOnRouteTransition)
            err.context["detector"] = "detector=$detectorName, dir=${detector.direction}"
            throw err
        }
    }

    if (res.pathItemPositions.size != req.pathItems.size)
        throw OSRDError(ErrorType.PathHasInvalidItemPositions)

    if (res.pathItemPositions[0].distance.millimeters != 0L)
        throw OSRDError(ErrorType.PathHasInvalidItemPositions)

    if (res.pathItemPositions[res.pathItemPositions.size - 1] != res.length)
        throw OSRDError(ErrorType.PathHasInvalidItemPositions)
}
