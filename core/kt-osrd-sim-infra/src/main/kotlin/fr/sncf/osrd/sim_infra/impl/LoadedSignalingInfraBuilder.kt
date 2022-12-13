package fr.sncf.osrd.sim_infra.impl

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.indexing.*

inline fun loadedSignalInfra(sigSystemManager: InfraSigSystemManager, init: LoadedSignalingInfraBuilder.() -> Unit): LoadedSignalInfra {
    val infraBuilder = LoadedSignalingInfraBuilderImpl(sigSystemManager)
    infraBuilder.init()
    return infraBuilder.build()
}

interface LoadedSignalingInfraBuilder {
    fun physicalSignal(init: LoadedPhysicalSignalBuilder.() -> Unit): PhysicalSignalId
}

interface LoadedPhysicalSignalBuilder {
    fun logicalSignal(init: LoadedLogicalSignalBuilder.() -> Unit): LogicalSignalId
}

interface LoadedLogicalSignalBuilder {
    fun driver(driver: SignalDriverId)
    fun sigSettings(sigSettings: SigSettings)
    fun signalingSystemId(signalingSystemId: SignalingSystemId)
}

private class LoadedPhysicalSignalBuilderImpl(private val infraBuilderImpl: LoadedSignalingInfraBuilderImpl) : LoadedPhysicalSignalBuilder {
    private val children: MutableStaticIdxArrayList<LogicalSignal> = MutableStaticIdxArrayList()
    override fun logicalSignal(init: LoadedLogicalSignalBuilder.() -> Unit): LogicalSignalId {
        val builder = LoadedLogicalSignalBuilderImpl(infraBuilderImpl)
        builder.init()
        val id = builder.build()
        children.add(id)
        return id
    }

    fun build(): StaticIdxList<LogicalSignal> {
        return children
    }
}

private class LoadedLogicalSignalBuilderImpl(var sigSettings: SigSettings?,
                                     var signalingSystemId: SignalingSystemId?,
                                     val drivers: MutableStaticIdxArrayList<SignalDriver>,
                                     private val infraBuilderImpl: LoadedSignalingInfraBuilderImpl)
    : LoadedLogicalSignalBuilder {
        constructor(infraBuilderImpl: LoadedSignalingInfraBuilderImpl) : this(
            null,
            null,
            mutableStaticIdxArrayListOf(),
            infraBuilderImpl)

    override fun driver(driver: SignalDriverId) {
        drivers.add(driver)
    }

    override fun sigSettings(sigSettings: SigSettings) {
        this.sigSettings = sigSettings
    }

    override fun signalingSystemId(signalingSystemId: SignalingSystemId) {
        this.signalingSystemId = signalingSystemId
    }

    fun build(): LogicalSignalId {
        val id = LogicalSignalId(infraBuilderImpl.logicalSignalSpace++)
        infraBuilderImpl.signalSettingsMap[id] = sigSettings!!
        infraBuilderImpl.signalingSystemMap[id] = signalingSystemId!!
        infraBuilderImpl.driverMap[id] = drivers
        return id
    }
}

class LoadedSignalingInfraBuilderImpl internal constructor(
    val sigSystemManager: InfraSigSystemManager,
    var logicalSignalSpace: UInt,
    val physicalSignalPool: StaticPool<PhysicalSignal, StaticIdxList<LogicalSignal>>,
    val signalSettingsMap: IdxMap<LogicalSignalId, SigSettings>,
    val signalingSystemMap: IdxMap<LogicalSignalId, SignalingSystemId>,
    val driverMap: IdxMap<LogicalSignalId, StaticIdxList<SignalDriver>>
) : LoadedSignalingInfraBuilder {
    constructor(sigSystemManager: InfraSigSystemManager) : this(
        sigSystemManager,
        0u,
        StaticPool(),
        IdxMap(),
        IdxMap(),
        IdxMap(),
    )

    override fun physicalSignal(init: LoadedPhysicalSignalBuilder.() -> Unit): PhysicalSignalId {
        val builder = LoadedPhysicalSignalBuilderImpl(this)
        builder.init()
        return physicalSignalPool.add(builder.build())
    }

    fun build(): LoadedSignalInfra {
        val logicalSignalSpace = StaticIdxSpace<LogicalSignal>(logicalSignalSpace)

        // query the signaling system manager to cache whether each signal is a block delimiter
        val delimiterMap = IdxMap<LogicalSignalId, Boolean>()
        for (logSignal in logicalSignalSpace) {
            val sigSystem = signalingSystemMap[logSignal]!!
            val settings = signalSettingsMap[logSignal]!!
            delimiterMap[logSignal] = sigSystemManager.isBlockDelimiter(sigSystem, settings)
        }

        return LoadedSignalingInfraImpl(
            logicalSignalSpace,
            physicalSignalPool,
            signalSettingsMap,
            signalingSystemMap,
            driverMap,
            delimiterMap,
        )
    }
}
