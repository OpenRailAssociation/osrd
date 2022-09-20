package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.indexing.*
import kotlin.time.Duration


/* /!\ All these sealed interfaces are not meant to be implemented:
* these are used to implement type-safe numerical identifiers /!\
*/

/** Switches and crossings are movable elements */
sealed interface MovableElement
typealias MovableElementId = StaticIdx<MovableElement>

/** A possible configuration for a movable element. Each movable element has its own configuration space */
sealed interface MovableElementConfig
typealias MovableElementConfigId = StaticIdx<MovableElementConfig>


interface MovableElementsInfra {
    val movableElements: StaticIdxSpace<MovableElement>
    fun getMovableElementConfigs(movableElement: MovableElementId): StaticIdxSpace<MovableElementConfig>
    fun getMovableElementDelay(movableElement: MovableElementId): Duration
    fun getMovableElementDefaultConfig(movableElement: MovableElementId): MovableElementConfigId
    fun getMovableElementConfigName(movableElement: MovableElementId, config: MovableElementConfigId): String
}


/** Detectors are notified when trains */
sealed interface Detector
typealias DetectorId = StaticIdx<Detector>


/** A track vacancy detection section. These rely on detectors to operate. */
sealed interface Zone
typealias ZoneId = StaticIdx<Zone>


/** A directional detector encodes a direction over a detector */
@JvmInline
value class DirDetectorId private constructor(private val data: UInt) : NumIdx {
    public constructor(detector: StaticIdx<Detector>, direction: Direction) : this(
        (detector.index shl 1) or when (direction) {
            Direction.NORMAL -> 0u
            Direction.REVERSE -> 1u
        })

    override val index: UInt get() = data

    val detector: DetectorId get() = StaticIdx(data shr 1)
    val direction: Direction get() = when ((data and 1u) != 0u) {
        false -> Direction.NORMAL
        true -> Direction.REVERSE
    }

    val opposite: DirDetectorId get() = DirDetectorId(data xor 1u)
}

val DetectorId.normal get() = DirDetectorId(this, Direction.NORMAL)
val DetectorId.reverse get() = DirDetectorId(this, Direction.REVERSE)

interface LocationInfra {
    val zones: StaticIdxSpace<Zone>
    fun getMovableElements(zone: ZoneId): StaticIdxSortedSet<MovableElement>
    fun getZoneBounds(zone: ZoneId): List<DirDetectorId>

    val detectors: StaticIdxSpace<Detector>

    fun getNextZone(dirDet: DirDetectorId): ZoneId?
    fun getPreviousZone(dirDet: DirDetectorId): ZoneId?
}


/** A route is a path from detector to detector */
sealed interface Route
typealias RouteId = StaticIdx<Route>


/** Encodes a path inside a zone */
data class ZonePath(
    val entry: DirDetectorId,
    val exit: DirDetectorId,
    /** The movable elements in the order encountered when traversing the zone from entry to exit */
    val movableElements: StaticIdxList<MovableElement>,
    /** The movable element configs in the same order as movable elements */
    val movableElementConfigs: StaticIdxList<MovableElementConfig>,
)

fun ZonePath(entry: DirDetectorId, exit: DirDetectorId): ZonePath {
    return ZonePath(entry, exit, MutableStaticIdxArrayList(), MutableStaticIdxArrayList())
}

interface RoutingInfra {
    val routes: StaticIdxSpace<Route>

    fun getRoutePath(route: RouteId): List<ZonePath>

    /** Returns a list of indices of zones in the train path at which the reservations shall be released. */
    fun getRouteReleaseZones(route: RouteId): IntArray
}

val List<ZonePath>.entry get() = this[0].entry
val List<ZonePath>.exit get() = this[size - 1].exit

/** A fixed size signaling block */
sealed interface Block
typealias BlockId = StaticIdx<Block>

/** A type of signaling block */
sealed interface BlockType
typealias BlockTypeId = StaticIdx<BlockType>


interface SpacingInfra {
    val blocks: StaticIdxSpace<Block>
    val blockTypes: StaticIdxSpace<BlockType>
    fun getBlockPath(block: BlockId): List<ZonePath>
    fun getBlockType(block: BlockId): BlockTypeId
    fun getBlocksAt(detector: DirDetectorId, type: BlockTypeId): StaticIdxList<Block>
}

/** A railway signal */
sealed interface Signal
typealias SignalId = StaticIdx<Signal>


interface SignalingInfra {
    /** TODO */
}

interface SimInfra : MovableElementsInfra, LocationInfra, RoutingInfra, SpacingInfra, SignalingInfra
