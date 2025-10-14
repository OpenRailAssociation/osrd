package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.impl.SignalParameters
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.*

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

    fun isCurveBased(sigSystem: SignalingSystemId): Boolean

    fun getCost(sigSystem: SignalingSystemId): Double

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

    fun getLogicalSignals(signal: PhysicalSignalId): List<LogicalSignalId>

    fun getPhysicalSignal(signal: LogicalSignalId): PhysicalSignalId

    fun getSignalingSystem(signal: LogicalSignalId): SignalingSystemId

    fun getSettings(signal: LogicalSignalId): SigSettings

    fun getParameters(signal: StaticIdx<LogicalSignal>): SignalParameters

    fun getDrivers(signal: LogicalSignalId): List<SignalDriverId>

    fun isBlockDelimiter(signal: LogicalSignalId): Boolean
}

@Suppress("INAPPLICABLE_JVM_NAME")
interface BlockInfra {
    val blocks: StaticIdxSpace<Block>

    fun getBlockZonePaths(block: BlockId): List<ZonePathId>

    fun getBlocksInZone(zone: ZoneId): List<BlockId>

    fun getBlockSignals(block: BlockId): List<LogicalSignalId>

    fun blockStartAtBufferStop(block: BlockId): Boolean

    fun blockStopAtBufferStop(block: BlockId): Boolean

    fun getBlockSignalingSystem(block: BlockId): SignalingSystemId

    fun getBlocksStartingAtDetector(detector: DirDetectorId): List<BlockId>

    fun getBlocksEndingAtDetector(detector: DirDetectorId): List<BlockId>

    fun getBlocksAtSignal(signal: LogicalSignalId): List<BlockId>

    fun getSignalsPositions(block: BlockId): OffsetList<Block>

    fun getBlocksFromTrackChunk(
        trackChunk: TrackChunkId,
        direction: Direction,
    ): MutableStaticIdxArraySet<Block>

    fun getTrackChunksFromBlock(block: BlockId): List<DirTrackChunkId>

    fun getBlockLength(block: BlockId): Length<Block>

    /** Returns a unique and stable string identifier for the given block. */
    fun getBlockName(block: BlockId): String

    /** Find the block with the given string identifier, or null if not found. */
    fun getBlockFromName(name: String): BlockId?
}

fun InfraSigSystemManager.findSignalingSystemOrThrow(sigSystem: String): SignalingSystemId {
    return findSignalingSystem(sigSystem) ?: throw OSRDError.newSignalingError(sigSystem)
}
