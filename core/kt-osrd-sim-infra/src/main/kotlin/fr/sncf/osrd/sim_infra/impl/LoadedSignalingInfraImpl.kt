package fr.sncf.osrd.sim_infra.impl

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.indexing.*

class LoadedSignalingInfraImpl(
    val logicalSignalSpace: StaticIdxSpace<LogicalSignal>,
    val physicalSignalPool: StaticPool<PhysicalSignal, StaticIdxList<LogicalSignal>>,
    val signalSettingsMap: IdxMap<LogicalSignalId, SigSettings>,
    val signalingSystemMap: IdxMap<LogicalSignalId, SignalingSystemId>,
    val driverMap: IdxMap<LogicalSignalId, StaticIdxList<SignalDriver>>,
    val blockDelimiterMap: IdxMap<LogicalSignalId, Boolean>,
) : LoadedSignalInfra{
    private val parentSignalMap: IdxMap<LogicalSignalId, PhysicalSignalId> = IdxMap()

    init {
        // initialize the physical signal to logical signal map
        for (physicalSignal in physicalSignalPool)
            for (child in physicalSignalPool[physicalSignal])
                parentSignalMap[child] = physicalSignal
    }

    override val physicalSignals: StaticIdxSpace<PhysicalSignal>
        get() = physicalSignalPool.space()

    override val logicalSignals: StaticIdxSpace<LogicalSignal>
        get() = logicalSignalSpace

    override fun getLogicalSignals(signal: PhysicalSignalId): StaticIdxList<LogicalSignal> {
        return physicalSignalPool[signal]
    }

    override fun getPhysicalSignal(signal: LogicalSignalId): PhysicalSignalId {
        return parentSignalMap[signal]!!
    }

    override fun getSignalingSystem(signal: LogicalSignalId): SignalingSystemId {
        return signalingSystemMap[signal]!!
    }

    override fun getSettings(signal: LogicalSignalId): SigSettings {
        return signalSettingsMap[signal]!!
    }

    override fun getDrivers(signal: LogicalSignalId): StaticIdxList<SignalDriver> {
        return driverMap[signal]!!
    }

    override fun isBlockDelimiter(signal: LogicalSignalId): Boolean {
        return blockDelimiterMap[signal]!!
    }
}
