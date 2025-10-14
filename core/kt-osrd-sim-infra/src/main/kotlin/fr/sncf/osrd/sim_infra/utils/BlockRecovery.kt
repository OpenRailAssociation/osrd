package fr.sncf.osrd.sim_infra.utils

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import java.util.*

data class BlockPathElement(
    val prev: BlockPathElement?,
    val block: BlockId,
    // the index of the route in the path
    val routeIndex: Int,
    // the offset of the block in the route's zones + number of zones in the block
    val routeEndZoneOffset: Int,
)

fun BlockPathElement.toBlockList(): List<BlockId> {
    val res = mutableStaticIdxArrayListOf(this.block)
    var cur = this.prev
    while (cur != null) {
        res.add(cur.block)
        cur = cur.prev
    }
    return res.reversed()
}

private fun filterBlocks(
    allowedSignalingSystems: List<SignalingSystemId>?,
    blockInfra: BlockInfra,
    blocks: List<BlockId>,
    routePath: List<ZonePathId>,
    routeOffset: Int,
): List<BlockId> {
    val remainingZonePaths = routePath.size - routeOffset
    val res = mutableStaticIdxArrayListOf<Block>()
    blockLoop@ for (block in blocks) {
        if (
            allowedSignalingSystems != null &&
                !allowedSignalingSystems.contains(blockInfra.getBlockSignalingSystem(block))
        )
            continue
        val blockZonePaths = blockInfra.getBlockZonePaths(block)
        if (blockZonePaths.size > remainingZonePaths) continue
        for (i in 0 until blockZonePaths.size) if (routePath[routeOffset + i] != blockZonePaths[i])
            continue@blockLoop
        res.add(block)
    }
    return res
}

private fun findRouteBlocks(
    signalingInfra: RawSignalingInfra,
    blockInfra: BlockInfra,
    allowedSignalingSystems: List<SignalingSystemId>?,
    previousPaths: List<BlockPathElement>?,
    route: RouteId,
    routeIndex: Int,
): List<BlockPathElement> {
    val routePath = signalingInfra.getRoutePath(route)
    var maxRouteEndOffset = 0
    val incompletePaths =
        PriorityQueue<BlockPathElement>(Comparator.comparing { it.routeEndZoneOffset })
    val completePaths = mutableListOf<BlockPathElement>()

    fun addPath(path: BlockPathElement) {
        if (path.routeEndZoneOffset == routePath.size) {
            completePaths.add(path)
            return
        }
        if (path.routeEndZoneOffset > maxRouteEndOffset) maxRouteEndOffset = path.routeEndZoneOffset
        incompletePaths.add(path)
    }

    fun findNextBlocks(prevPath: BlockPathElement, routeOffset: Int) {
        val lastBlock = prevPath.block
        if (blockInfra.blockStopAtBufferStop(lastBlock)) return
        val blockSignals = blockInfra.getBlockSignals(lastBlock)
        val curSignal = blockSignals[blockSignals.size - 1]
        val blocks = blockInfra.getBlocksAtSignal(curSignal)
        val blocksOnRoute =
            filterBlocks(allowedSignalingSystems, blockInfra, blocks, routePath, routeOffset)
        for (block in blocksOnRoute) {
            val blockSize = blockInfra.getBlockZonePaths(block).size
            addPath(BlockPathElement(prevPath, block, routeIndex, routeOffset + blockSize))
        }
    }

    // initialize with the BlockPathElements which are acceptable at the start of the route
    if (previousPaths == null) {
        val currentDet = signalingInfra.getZonePathEntry(routePath[0])
        val blocks = blockInfra.getBlocksStartingAtDetector(currentDet)
        val blocksOnRoute = filterBlocks(allowedSignalingSystems, blockInfra, blocks, routePath, 0)
        for (block in blocksOnRoute) {
            val blockPath = blockInfra.getBlockZonePaths(block)
            addPath(BlockPathElement(null, block, routeIndex, blockPath.size))
        }
    } else {
        for (prevPath in previousPaths) findNextBlocks(prevPath, 0)
    }

    // for each block until the end of the route path,
    // filter candidates which don't match and add new candidates
    while (incompletePaths.isNotEmpty()) {
        val candidatePath = incompletePaths.poll()!!
        findNextBlocks(candidatePath, candidatePath.routeEndZoneOffset)
    }

    return completePaths
}

/** Recovers possible block paths from a route path */
fun recoverBlocks(
    sigInfra: RawSignalingInfra,
    blockInfra: BlockInfra,
    routes: List<RouteId>,
    allowedSigSystems: List<SignalingSystemId>?,
): List<BlockPathElement> {
    var candidates: List<BlockPathElement>? = null

    for (routeIndex in 0 until routes.size) {
        val route = routes[routeIndex]
        val newCandidates =
            findRouteBlocks(sigInfra, blockInfra, allowedSigSystems, candidates, route, routeIndex)
        candidates = newCandidates
    }
    return candidates!!
}
