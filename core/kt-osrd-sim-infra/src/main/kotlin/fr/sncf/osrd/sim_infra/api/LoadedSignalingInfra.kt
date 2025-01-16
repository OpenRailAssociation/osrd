package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.impl.SignalParameters
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.OffsetList

/** A type of signaling system, which is used both for blocks and signals */
sealed interface SignalingSystem

typealias SignalingSystemId = StaticIdx<SignalingSystem>

sealed interface SignalDriver

typealias SignalDriverId = StaticIdx<SignalDriver>

sealed interface SignalSettingsMarker

typealias SigSettings = SigData<SignalSettingsMarker>

typealias SigSettingsSchema = SigSchema<SignalSettingsMarker>

sealed interface SignalParametersMarker

typealias SigParametersSchema = SigSchema<SignalParametersMarker>

typealias SigParameters = SigData<SignalParametersMarker>

sealed interface SignalStateMarker

typealias SigState = SigData<SignalStateMarker>

typealias SigStateSchema = SigSchema<SignalStateMarker>

/** The signaling system manager is a repository for drivers and signaling systems */
interface InfraSigSystemManager {
    val signalingSystems: StaticIdxSpace<SignalingSystem>

    fun findSignalingSystem(sigSystem: String): SignalingSystemId?

    fun getStateSchema(sigSystem: SignalingSystemId): SigStateSchema

    fun getSettingsSchema(sigSystem: SignalingSystemId): SigSettingsSchema

    fun getParametersSchema(sigSystem: SignalingSystemId): SigParametersSchema

    fun getName(sigSystem: SignalingSystemId): String

    val drivers: StaticIdxSpace<SignalDriver>

    fun findDriver(outputSig: SignalingSystemId, inputSig: SignalingSystemId): SignalDriverId

    fun getInputSignalingSystem(driver: SignalDriverId): SignalingSystemId

    fun getOutputSignalingSystem(driver: SignalDriverId): SignalingSystemId

    fun isBlockDelimiter(sigSystem: SignalingSystemId, settings: SigSettings): Boolean

    fun isRouteDelimiter(sigSystem: SignalingSystemId, settings: SigSettings): Boolean
}

interface LoadedSignalInfra {
    val physicalSignals: StaticIdxSpace<PhysicalSignal>
    val logicalSignals: StaticIdxSpace<LogicalSignal>

    fun getLogicalSignals(signal: PhysicalSignalId): StaticIdxList<LogicalSignal>

    fun getPhysicalSignal(signal: LogicalSignalId): PhysicalSignalId

    fun getSignalingSystem(signal: LogicalSignalId): SignalingSystemId

    fun getSettings(signal: LogicalSignalId): SigSettings

    fun getParameters(signal: StaticIdx<LogicalSignal>): SignalParameters

    fun getDrivers(signal: LogicalSignalId): StaticIdxList<SignalDriver>

    fun isBlockDelimiter(signal: LogicalSignalId): Boolean
}

@Suppress("INAPPLICABLE_JVM_NAME")
interface BlockInfra {
    val blocks: StaticIdxSpace<Block>

    fun getBlockPath(block: BlockId): StaticIdxList<ZonePath>

    fun getBlocksInZone(zone: ZoneId): StaticIdxList<Block>

    fun getBlockSignals(block: BlockId): StaticIdxList<LogicalSignal>

    fun blockStartAtBufferStop(block: BlockId): Boolean

    fun blockStopAtBufferStop(block: BlockId): Boolean

    fun getBlockSignalingSystem(block: BlockId): SignalingSystemId

    fun getBlocksStartingAtDetector(detector: DirDetectorId): StaticIdxList<Block>

    fun getBlocksEndingAtDetector(detector: DirDetectorId): StaticIdxList<Block>

    fun getBlocksAtSignal(signal: LogicalSignalId): StaticIdxList<Block>

    fun getSignalsPositions(block: BlockId): OffsetList<Block>

    fun getBlocksFromTrackChunk(
        trackChunk: TrackChunkId,
        direction: Direction
    ): MutableStaticIdxArraySet<Block>

    fun getTrackChunksFromBlock(block: BlockId): DirStaticIdxList<TrackChunk>

    @JvmName("getBlockLength") fun getBlockLength(block: BlockId): Length<Block>

    /** Returns a unique and stable string identifier for the given block. */
    fun getBlockName(block: BlockId): String

    /** Find the block with the given string identifier, or null if not found. */
    fun getBlockFromName(name: String): BlockId?
}

fun InfraSigSystemManager.findSignalingSystemOrThrow(sigSystem: String): SignalingSystemId {
    return findSignalingSystem(sigSystem) ?: throw OSRDError.newSignalingError(sigSystem)
}

fun BlockInfra.convertBlockPath(blocks: List<String>): StaticIdxList<Block> {
    val res = mutableStaticIdxArrayListOf<Block>()
    for (block in blocks) res.add(getBlockFromName(block)!!)
    return res
}
