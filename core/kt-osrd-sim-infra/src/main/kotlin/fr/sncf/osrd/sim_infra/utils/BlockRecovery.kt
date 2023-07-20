package fr.sncf.osrd.sim_infra.utils

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import java.util.*


data class BlockPathElement(
    val prev: BlockPathElement?,
    val block: BlockId,
    // the index of the route in the path
    val routeIndex: Int,
    // the position of the block in the route
    val blockRouteOffset: Int,
    // the offset of the block in the route's zones
    val routeStartZoneOffset: Int,
    // always equal to routeStartZoneOffset + number of zones in the block
    val routeEndZoneOffset: Int,
)

fun BlockPathElement.toList() : List<BlockPathElement> {
    val res = mutableListOf(this)
    var cur = this.prev
    while (cur != null) {
        res.add(cur)
        cur = cur.prev
    }
    return res.reversed()
}

fun BlockPathElement.toBlockList() : StaticIdxList<Block> {
    val res = mutableStaticIdxArrayListOf(this.block)
    var cur = this.prev
    while (cur != null) {
        res.add(cur.block)
        cur = cur.prev
    }
    return res.reversed()
}


private fun filterBlocks(
    allowedSignalingSystems: StaticIdxList<SignalingSystem>,
    blockInfra: BlockInfra,
    blocks: StaticIdxList<Block>,
    routePath: StaticIdxList<ZonePath>,
    routeOffset: Int,
): StaticIdxList<Block> {
    val remainingZonePaths = routePath.size - routeOffset
    val res = mutableStaticIdxArrayListOf<Block>()
    blockLoop@ for (block in blocks) {
        if (!allowedSignalingSystems.contains(blockInfra.getBlockSignalingSystem(block)))
            continue
        val blockPath = blockInfra.getBlockPath(block)
        if (blockPath.size > remainingZonePaths)
            continue
        for (i in 0 until blockPath.size)
            if (routePath[routeOffset + i] != blockPath[i])
                continue@blockLoop
        res.add(block)
    }
    return res
}


private fun findRouteBlocks(
    signalingInfra: RawSignalingInfra,
    blockInfra: BlockInfra,
    allowedSignalingSystems: StaticIdxList<SignalingSystem>,
    previousPaths: List<BlockPathElement>?,
    route: RouteId,
    routeIndex: Int,
): List<BlockPathElement> {
    val routePath = signalingInfra.getRoutePath(route)
    var maxRouteEndOffset = 0
    val incompletePaths = PriorityQueue<BlockPathElement>(Comparator.comparing { it.routeEndZoneOffset })
    val completePaths = mutableListOf<BlockPathElement>()

    fun addPath(path: BlockPathElement) {
        if (path.routeEndZoneOffset == routePath.size) {
            completePaths.add(path)
            return
        }
        if (path.routeEndZoneOffset > maxRouteEndOffset)
            maxRouteEndOffset = path.routeEndZoneOffset
        incompletePaths.add(path)
    }

    fun findNextBlocks(prevPath: BlockPathElement, routeOffset: Int) {
        val lastBlock = prevPath.block
        if (blockInfra.blockStopAtBufferStop(lastBlock))
            return
        val blockSignals = blockInfra.getBlockSignals(lastBlock)
        val curSignal = blockSignals[blockSignals.size - 1]
        val blocks = blockInfra.getBlocksAtSignal(curSignal)
        val blocksOnRoute = filterBlocks(allowedSignalingSystems, blockInfra, blocks, routePath, routeOffset)
        for (block in blocksOnRoute) {
            val blockSize = blockInfra.getBlockPath(block).size
            addPath(BlockPathElement(
                prevPath,
                block, routeIndex,
                prevPath.blockRouteOffset + 1,
                routeOffset, routeOffset + blockSize
            ))
        }
    }

    // initialize with the BlockPathElements which are acceptable at the start of the route
    if (previousPaths == null) {
        val currentDet = signalingInfra.getZonePathEntry(routePath[0])
        val blocks = blockInfra.getBlocksAtDetector(currentDet)
        val blocksOnRoute = filterBlocks(allowedSignalingSystems, blockInfra, blocks, routePath, 0)
        for (block in blocksOnRoute) {
            val blockPath = blockInfra.getBlockPath(block)
            addPath(BlockPathElement(null, block, routeIndex, 0, 0, blockPath.size))
        }
    } else {
        for (prevPath in previousPaths)
            findNextBlocks(prevPath, 0)
    }

    // for each block until the end of the route path,
    // filter candidates which don't match and add new candidates
    while (incompletePaths.isNotEmpty()) {
        val candidatePath = incompletePaths.poll()!!
        findNextBlocks(candidatePath, candidatePath.routeEndZoneOffset)
    }

    assert(completePaths.isNotEmpty())

    return completePaths
}

/** Recovers possible block paths from a route path */
fun recoverBlocks(
    sigInfra: RawSignalingInfra,
    blockInfra: BlockInfra,
    routes: StaticIdxList<Route>,
    allowedSigSystems: StaticIdxList<SignalingSystem>
): List<BlockPathElement> {
    var candidates: List<BlockPathElement>? = null

    for (routeIndex in 0 until routes.size) {
        val route = routes[routeIndex]
        val newCandidates = findRouteBlocks(sigInfra, blockInfra, allowedSigSystems, candidates, route, routeIndex)
        candidates = newCandidates
    }
    return candidates!!
}
