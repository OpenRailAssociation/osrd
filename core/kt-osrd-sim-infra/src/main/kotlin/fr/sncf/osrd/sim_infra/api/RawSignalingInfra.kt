package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.utils.units.*
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.indexing.StaticIdxSpace

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
