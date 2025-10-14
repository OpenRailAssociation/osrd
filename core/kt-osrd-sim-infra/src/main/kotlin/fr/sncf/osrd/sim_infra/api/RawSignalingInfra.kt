package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdxSpace
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
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

data class RawSignalParameters(
    val default: Map<String, String>,
    val conditional: Map<RouteId, Map<String, String>>,
)

interface RawSignalingInfra : RoutingInfra {
    fun getSignals(zonePath: ZonePathId): List<PhysicalSignalId>

    fun getSignalPositions(zonePath: ZonePathId): OffsetList<ZonePath>

    fun getSpeedLimits(route: RouteId): List<SpeedLimitId>

    fun getSpeedLimitStarts(route: RouteId): OffsetList<Route>

    fun getSpeedLimitEnds(route: RouteId): OffsetList<Route>

    val physicalSignals: StaticIdxSpace<PhysicalSignal>
    val logicalSignals: StaticIdxSpace<LogicalSignal>

    fun getLogicalSignals(signal: PhysicalSignalId): List<LogicalSignalId>

    fun getPhysicalSignal(signal: LogicalSignalId): PhysicalSignalId

    fun getPhysicalSignalTrack(signal: PhysicalSignalId): TrackSectionId

    /** This offset is undirected */
    fun getPhysicalSignalTrackOffset(signal: PhysicalSignalId): Offset<TrackSection>

    fun getPhysicalSignalName(signal: PhysicalSignalId): String?

    fun getSignalSightDistance(signal: PhysicalSignalId): Distance

    fun getSignalingSystemId(signal: LogicalSignalId): String

    fun getRawSettings(signal: LogicalSignalId): Map<String, String>

    fun getRawParameters(signal: LogicalSignalId): RawSignalParameters

    fun getNextSignalingSystemIds(signal: LogicalSignalId): List<String>

    fun findDetector(detectorName: String): DetectorId?
}

fun RawSignalingInfra.getLogicalSignalName(signal: LogicalSignalId): String? {
    return getPhysicalSignalName(getPhysicalSignal(signal))
}

typealias RawInfra = RawSignalingInfra
