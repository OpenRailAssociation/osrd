package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.*

import java.util.Comparator
import java.util.PriorityQueue


/** A type of signaling system, which is used both for blocks and signals */
sealed interface SignalingSystem
typealias SignalingSystemId = StaticIdx<SignalingSystem>

sealed interface SignalDriver
typealias SignalDriverId = StaticIdx<SignalDriver>


sealed interface SignalSettingsMarker
typealias SigSettings = SigData<SignalSettingsMarker>
typealias SigSettingsSchema = SigSchema<SignalSettingsMarker>

sealed interface SignalStateMarker
typealias SigState = SigData<SignalStateMarker>
typealias SigStateSchema = SigSchema<SignalStateMarker>


/** The signaling system manager is a repository for drivers and signaling systems */
@Suppress("INAPPLICABLE_JVM_NAME")
interface InfraSigSystemManager {
    @get:JvmName("getSignalingSystems")
    val signalingSystems: StaticIdxSpace<SignalingSystem>
    fun findSignalingSystem(sigSystem: String): SignalingSystemId
    fun getStateSchema(sigSystem: SignalingSystemId): SigStateSchema
    fun getSettingsSchema(sigSystem: SignalingSystemId): SigSettingsSchema

    val drivers: StaticIdxSpace<SignalDriver>
    fun findDriver(outputSig: SignalingSystemId, inputSig: SignalingSystemId): SignalDriverId
    fun getInputSignalingSystem(driver: SignalDriverId): SignalingSystemId
    fun getOutputSignalingSystem(driver: SignalDriverId): SignalingSystemId
    fun isBlockDelimiter(sigSystem: SignalingSystemId, settings: SigSettings): Boolean
}


interface LoadedSignalInfra {
    val physicalSignals: StaticIdxSpace<PhysicalSignal>
    val logicalSignals: StaticIdxSpace<LogicalSignal>

    fun getLogicalSignals(signal: PhysicalSignalId): StaticIdxList<LogicalSignal>
    fun getPhysicalSignal(signal: LogicalSignalId): PhysicalSignalId

    fun getSignalingSystem(signal: LogicalSignalId): SignalingSystemId
    fun getSettings(signal: LogicalSignalId): SigSettings
    fun getDrivers(signal: LogicalSignalId): StaticIdxList<SignalDriver>
    fun isBlockDelimiter(signal: LogicalSignalId): Boolean
}

@Suppress("INAPPLICABLE_JVM_NAME")
interface BlockInfra {
    @get:JvmName("getBlocks")
    val blocks: StaticIdxSpace<Block>
    @JvmName("getBlockPath")
    fun getBlockPath(block: BlockId): StaticIdxList<ZonePath>
    fun getBlockSignals(block: BlockId): StaticIdxList<LogicalSignal>
    fun blockStartAtBufferStop(block: BlockId): Boolean
    fun blockStopAtBufferStop(block: BlockId): Boolean

    fun getBlockSignalingSystem(block: BlockId): SignalingSystemId
    @JvmName("getBlocksAtDetector")
    fun getBlocksAtDetector(detector: DirDetectorId): StaticIdxList<Block>
    fun getBlocksAtSignal(signal: LogicalSignalId): StaticIdxList<Block>
    fun getSignalsPositions(block: BlockId): DistanceList
    @JvmName("getBlocksFromTrackChunk")
    fun getBlocksFromTrackChunk(trackChunk: TrackChunkId, direction: Direction): MutableStaticIdxArraySet<Block>
    @JvmName("getTrackChunksFromBlock")
    fun getTrackChunksFromBlock(block: BlockId): DirStaticIdxList<TrackChunk>
    @JvmName("getBlockLength")
    fun getBlockLength(block: BlockId): Distance
}

data class BlockPathElement(
    val prev: BlockPathElement?,
    val block: BlockId,
    val route: RouteId,
    val routeStartOffset: Int,
    val routeEndOffset: Int,
)

fun BlockPathElement.toList() : StaticIdxList<Block> {
    val res = mutableStaticIdxArrayListOf(this.block)
    var cur = this.prev
    while (cur != null) {
        res.add(cur.block)
        cur = cur.prev
    }
    return res.reversed()
}


fun filterBlocks(
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

@JvmName("findRouteBlocks")
fun findRouteBlocks(
    signalingInfra: RawSignalingInfra,
    blockInfra: BlockInfra,
    allowedSignalingSystems: StaticIdxList<SignalingSystem>,
    previousPaths: List<BlockPathElement>?,
    route: RouteId,
): List<BlockPathElement> {
    val routePath = signalingInfra.getRoutePath(route)
    var maxRouteEndOffset = 0
    val incompletePaths = PriorityQueue<BlockPathElement>(Comparator.comparing { it.routeEndOffset })
    val completePaths = mutableListOf<BlockPathElement>()

    fun addPath(path: BlockPathElement) {
        if (path.routeEndOffset == routePath.size) {
            completePaths.add(path)
            return
        }
        if (path.routeEndOffset > maxRouteEndOffset)
            maxRouteEndOffset = path.routeEndOffset
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
            addPath(BlockPathElement(prevPath, block, route, routeOffset, routeOffset + blockSize))
        }
    }

    // initialize with the BlockPathElements which are acceptable at the start of the route
    if (previousPaths == null) {
        val currentDet = signalingInfra.getZonePathEntry(routePath[0])
        val blocks = blockInfra.getBlocksAtDetector(currentDet)
        val blocksOnRoute = filterBlocks(allowedSignalingSystems, blockInfra, blocks, routePath, 0)
        for (block in blocksOnRoute) {
            val blockPath = blockInfra.getBlockPath(block)
            addPath(BlockPathElement(null, block, route, 0, blockPath.size))
        }
    } else {
        for (prevPath in previousPaths)
            findNextBlocks(prevPath, 0)
    }

    // for each block until the end of the route path,
    // filter candidates which don't match and add new candidates
    while (incompletePaths.isNotEmpty()) {
        val candidatePath = incompletePaths.poll()!!
        findNextBlocks(candidatePath, candidatePath.routeEndOffset)
    }

    assert(completePaths.isNotEmpty())

    return completePaths
}


fun getRouteBlocks(
    signalingInfra: RawSignalingInfra,
    blockInfra: BlockInfra,
    routes: StaticIdxList<Route>,
    allowedSignalingSystems: StaticIdxList<SignalingSystem>
): List<StaticIdxList<Block>> {
    var candidateBlocks: List<BlockPathElement>? = null

    for (route in routes) {
        val newCandidateBlocks = findRouteBlocks(signalingInfra, blockInfra, allowedSignalingSystems, candidateBlocks, route)
        candidateBlocks = newCandidateBlocks
    }
    return candidateBlocks!!.map { it.toList() }
}
