package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.indexing.StaticIdxSpace
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.OffsetList

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

    fun getSignalPositions(zonePath: ZonePathId): OffsetList<ZonePath>

    fun getSpeedLimits(route: RouteId): StaticIdxList<SpeedLimit>

    fun getSpeedLimitStarts(route: RouteId): OffsetList<Route>

    fun getSpeedLimitEnds(route: RouteId): OffsetList<Route>

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
