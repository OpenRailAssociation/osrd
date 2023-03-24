@file:PrimitiveWrapperCollections(
    wrapper = Distance::class,
    primitive = Long::class,
    fromPrimitive = "Distance(%s)",
    toPrimitive = "%s.millimeters",
    collections = ["Array", "ArrayList"],
)

package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.fast_collections.PrimitiveWrapperCollections
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.indexing.StaticIdxSpace
import fr.sncf.osrd.utils.indexing.mutableDynIdxArrayListOf
import kotlin.math.absoluteValue

/** A fixed size signaling block */
sealed interface Block
typealias BlockId = StaticIdx<Block>
/** A speed limit */
sealed interface SpeedLimit
typealias SpeedLimitId = StaticIdx<SpeedLimit>


sealed interface PhysicalSignal
typealias PhysicalSignalId = StaticIdx<PhysicalSignal>

sealed interface LogicalSignal
typealias LogicalSignalId = StaticIdx<LogicalSignal>

@JvmInline
value class Distance(val millimeters: Long) : Comparable<Distance> {
    val absoluteValue get() = Distance(millimeters.absoluteValue)
    val meters get() = millimeters / 1000.0
    operator fun plus(value: Distance): Distance {
        return Distance(millimeters + value.millimeters)
    }

    operator fun minus(value: Distance): Distance {
        return Distance(millimeters - value.millimeters)
    }

    companion object {
        @JvmStatic
        val ZERO = Distance(millimeters = 0L)
    }

    override fun compareTo(other: Distance): Int {
        return millimeters.compareTo(other.millimeters)
    }
}

val Double.meters: Distance get() = Distance((this * 1000).toLong())
val Int.meters: Distance get() = Distance(this.toLong() * 1000)

@JvmInline
value class Speed(val value: ULong)


interface RawSignalingInfra : RoutingInfra {
    fun getSignals(zonePath: ZonePathId): StaticIdxList<PhysicalSignal>
    fun getSignalPositions(zonePath: ZonePathId): DistanceList
    fun getSpeedLimits(route: RouteId): StaticIdxList<SpeedLimit>
    fun getSpeedLimitStarts(route: RouteId): DistanceList
    fun getSpeedLimitEnds(route: RouteId): DistanceList

    val physicalSignals: StaticIdxSpace<PhysicalSignal>
    val logicalSignals: StaticIdxSpace<LogicalSignal>

    fun getLogicalSignals(signal: PhysicalSignalId): StaticIdxList<LogicalSignal>
    fun getPhysicalSignal(signal: LogicalSignalId): PhysicalSignalId
    fun getPhysicalSignalName(signal: PhysicalSignalId): String?
    fun getSignalSightDistance(signal: PhysicalSignalId): Distance
    fun getSignalingSystemId(signal: LogicalSignalId): String
    fun getRawSettings(signal: LogicalSignalId): Map<String, String>
    fun getNextSignalingSystemIds(signal: LogicalSignalId): List<String>
}

fun RawSignalingInfra.getLogicalSignalName(signal: LogicalSignalId): String? {
    return getPhysicalSignalName(getPhysicalSignal(signal))
}

typealias RawInfra = RawSignalingInfra
