package fr.sncf.osrd.utils

import com.google.common.collect.HashBiMap
import com.google.common.collect.HashMultimap
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.NeutralSection
import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.DistanceList
import fr.sncf.osrd.utils.units.Speed
import fr.sncf.osrd.utils.units.meters
import kotlin.time.Duration

/** This class is used to create a minimal infra to be used on STDCM tests, with a simple block graph.
 * Ids are all interchangeable, there's one zone, one chunk, one track, one route per block. */
@Suppress("INAPPLICABLE_JVM_NAME")
class DummyInfra : RawInfra, BlockInfra {

    private val blockPool = mutableListOf<DummyBlockDescriptor>() // A StaticPool (somehow) fails to link with java here
    private val detectorMap = HashBiMap.create<String, DirDetectorId>()
    private val entryMap = HashMultimap.create<DirDetectorId, BlockId>()
    private val exitMap = HashMultimap.create<DirDetectorId, BlockId>()

    /** get the FullInfra  */
    @JvmName("fullInfra")
    fun fullInfra(): FullInfra {
        return FullInfra(
            null,
            this,
            null,
            this,
            null
        )
    }

    /** Creates a block going from nodes `entry` to `exit` of length `length`, named $entry->$exit,
     * with the given maximum speed. Value class are used as their underlying type to use @JvmOverloads  */
    @JvmName("addBlock")
    fun addBlock(
        entry: String,
        exit: String,
    ): BlockId {
        return addBlock(entry, exit, 100.meters)
    }

    /** Creates a block going from nodes `entry` to `exit` of length `length`, named $entry->$exit,
     * with the given maximum speed. Value class are used as their underlying type to use @JvmOverloads.
     * Length is given in meters, for test backward compatibility */
    @JvmName("addBlock")
    fun addBlock(
        entry: String,
        exit: String,
        length: Distance
    ): BlockId {
        return addBlock(entry, exit, length, Double.POSITIVE_INFINITY)
    }

    /** Creates a block going from nodes `entry` to `exit` of length `length`, named $entry->$exit,
     * with the given maximum speed. */
    @JvmName("addBlock")
    fun addBlock(
        entry: String,
        exit: String,
        length: Distance,
        allowedSpeed: Double,
    ): BlockId {
        val name = String.format("%s->%s", entry, exit)
        val entryId = detectorMap.computeIfAbsent(entry) { DirDetectorId(detectorMap.size.toUInt() * 2u) }
        val exitId = detectorMap.computeIfAbsent(exit) { DirDetectorId(detectorMap.size.toUInt() * 2u) }
        val id = BlockId(blockPool.size.toUInt())
        blockPool.add(
            DummyBlockDescriptor(
                length,
                name,
                entryId,
                exitId,
                allowedSpeed,
            )
        )
        entryMap.put(entryId, id)
        exitMap.put(exitId, id)
        return id
    }

    class DummyBlockDescriptor(
        val length: Distance,
        val name: String,
        val entry: DirDetectorId,
        val exit: DirDetectorId,
        val allowedSpeed: Double,
    )

    // region not implemented

    override fun getSignals(zonePath: ZonePathId): StaticIdxList<PhysicalSignal> {
        TODO("Not yet implemented")
    }

    override fun getSignalPositions(zonePath: ZonePathId): DistanceList {
        TODO("Not yet implemented")
    }

    override fun getSpeedLimits(route: RouteId): StaticIdxList<SpeedLimit> {
        TODO("Not yet implemented")
    }

    override fun getSpeedLimitStarts(route: RouteId): DistanceList {
        TODO("Not yet implemented")
    }

    override fun getSpeedLimitEnds(route: RouteId): DistanceList {
        TODO("Not yet implemented")
    }

    override val physicalSignals: StaticIdxSpace<PhysicalSignal>
        get() = TODO("Not yet implemented")
    override val logicalSignals: StaticIdxSpace<LogicalSignal>
        get() = TODO("Not yet implemented")

    override fun getLogicalSignals(signal: PhysicalSignalId): StaticIdxList<LogicalSignal> {
        TODO("Not yet implemented")
    }

    override fun getPhysicalSignal(signal: LogicalSignalId): PhysicalSignalId {
        TODO("Not yet implemented")
    }

    override fun getPhysicalSignalName(signal: PhysicalSignalId): String? {
        TODO("Not yet implemented")
    }

    override fun getSignalSightDistance(signal: PhysicalSignalId): Distance {
        TODO("Not yet implemented")
    }

    override fun getSignalingSystemId(signal: LogicalSignalId): String {
        TODO("Not yet implemented")
    }

    override fun getRawSettings(signal: LogicalSignalId): Map<String, String> {
        TODO("Not yet implemented")
    }

    override fun getNextSignalingSystemIds(signal: LogicalSignalId): List<String> {
        TODO("Not yet implemented")
    }

    override val routes: StaticIdxSpace<Route>
        get() = TODO("Not yet implemented")

    override fun getRoutePath(route: RouteId): StaticIdxList<ZonePath> {
        return makeIndexList(route)
    }

    override fun getRouteName(route: RouteId): String? {
        TODO("Not yet implemented")
    }

    override fun getRouteFromName(name: String): RouteId {
        for (i in 0 until blockPool.size) {
            if (blockPool[i].name == name)
                return RouteId(i.toUInt())
        }
        return RouteId((-1).toUInt())
    }

    override fun getRouteReleaseZones(route: RouteId): IntArray {
        TODO("Not yet implemented")
    }

    override fun getChunksOnRoute(route: RouteId): DirStaticIdxList<TrackChunk> {
        TODO("Not yet implemented")
    }

    override fun getRoutesOnTrackChunk(trackChunk: DirTrackChunkId): StaticIdxList<Route> {
        TODO("Not yet implemented")
    }

    override fun getRoutesStartingAtDet(dirDetector: DirDetectorId): StaticIdxList<Route> {
        val res = mutableStaticIdxArrayListOf<Route>()
        for (x in entryMap.get(dirDetector))
            res.add(StaticIdx(x.index))
        return res
    }

    override fun getRoutesEndingAtDet(dirDetector: DirDetectorId): StaticIdxList<Route> {
        val res = mutableStaticIdxArrayListOf<Route>()
        for (x in exitMap.get(dirDetector))
            res.add(StaticIdx(x.index))
        return res
    }

    override val zonePaths: StaticIdxSpace<ZonePath>
        get() = TODO("Not yet implemented")

    override fun findZonePath(
        entry: DirDetectorId,
        exit: DirDetectorId,
        movableElements: StaticIdxList<TrackNode>,
        trackNodeConfigs: StaticIdxList<TrackNodeConfig>
    ): ZonePathId? {
        TODO("Not yet implemented")
    }

    override fun getZonePathEntry(zonePath: ZonePathId): DirDetectorId {
        return blockPool[zonePath.index].entry
    }

    override fun getZonePathExit(zonePath: ZonePathId): DirDetectorId {
        return blockPool[zonePath.index].exit
    }

    override fun getZonePathLength(zonePath: ZonePathId): Distance {
        return blockPool[zonePath.index].length
    }

    override fun getZonePathMovableElements(zonePath: ZonePathId): StaticIdxList<TrackNode> {
        TODO("Not yet implemented")
    }

    override fun getZonePathMovableElementsConfigs(zonePath: ZonePathId): StaticIdxList<TrackNodeConfig> {
        TODO("Not yet implemented")
    }

    override fun getZonePathMovableElementsDistances(zonePath: ZonePathId): DistanceList {
        TODO("Not yet implemented")
    }

    override fun getZonePathChunks(zonePath: ZonePathId): DirStaticIdxList<TrackChunk> {
        return makeDirIndexList(zonePath)
    }

    override val zones: StaticIdxSpace<Zone>
        get() = TODO("Not yet implemented")

    override fun getMovableElements(zone: ZoneId): StaticIdxSortedSet<TrackNode> {
        TODO("Not yet implemented")
    }

    override fun getZoneBounds(zone: ZoneId): List<DirDetectorId> {
        TODO("Not yet implemented")
    }

    override val detectors: StaticIdxSpace<Detector>
        get() = TODO("Not yet implemented")

    override fun getNextZone(dirDet: DirDetectorId): ZoneId? {
        TODO("Not yet implemented")
    }

    override fun getPreviousZone(dirDet: DirDetectorId): ZoneId? {
        TODO("Not yet implemented")
    }

    override fun getDetectorName(det: DetectorId): String? {
        TODO("Not yet implemented")
    }

    override fun getNextTrackSection(currentTrack: DirTrackSectionId, config: TrackNodeConfigId): OptDirTrackSectionId {
        TODO("Not yet implemented")
    }

    override fun getNextTrackNode(trackSection: DirTrackSectionId): OptStaticIdx<TrackNode> {
        TODO("Not yet implemented")
    }

    override fun getNextTrackNodePort(trackSection: DirTrackSectionId): OptStaticIdx<TrackNodePort> {
        TODO("Not yet implemented")
    }

    override fun getPortConnection(trackNode: TrackNodeId, port: TrackNodePortId): EndpointTrackSectionId {
        TODO("Not yet implemented")
    }

    override fun getTrackNodeConfigs(trackNode: TrackNodeId): StaticIdxSpace<TrackNodeConfig> {
        TODO("Not yet implemented")
    }

    override fun getTrackNodePorts(trackNode: TrackNodeId): StaticIdxSpace<TrackNodePort> {
        TODO("Not yet implemented")
    }

    override fun getTrackNodeExitPort(
        trackNode: TrackNodeId,
        config: TrackNodeConfigId,
        entryPort: TrackNodePortId
    ): OptStaticIdx<TrackNodePort> {
        TODO("Not yet implemented")
    }

    override fun getTrackNodeDelay(trackNode: TrackNodeId): Duration {
        TODO("Not yet implemented")
    }

    override fun getTrackNodeConfigName(trackNode: TrackNodeId, config: TrackNodeConfigId): String {
        TODO("Not yet implemented")
    }

    override fun getTrackNodeName(trackNode: TrackNodeId): String {
        TODO("Not yet implemented")
    }

    override val trackNodes: StaticIdxSpace<TrackNode>
        get() = TODO("Not yet implemented")
    override val trackSections: StaticIdxSpace<TrackSection>
        get() = TODO("Not yet implemented")

    override fun getTrackSectionName(trackSection: TrackSectionId): String {
        TODO("Not yet implemented")
    }

    override fun getTrackSectionFromName(name: String): TrackSectionId? {
        TODO("Not yet implemented")
    }

    override fun getTrackSectionChunks(trackSection: TrackSectionId): StaticIdxList<TrackChunk> {
        TODO("Not yet implemented")
    }

    override fun getTrackSectionLength(trackSection: TrackSectionId): Distance {
        TODO("Not yet implemented")
    }

    override fun getTrackChunkLength(trackChunk: TrackChunkId): Distance {
        return blockPool[trackChunk.index].length
    }

    override fun getTrackChunkOffset(trackChunk: TrackChunkId): Distance {
        TODO("Not yet implemented")
    }

    override fun getTrackFromChunk(trackChunk: TrackChunkId): TrackSectionId {
        TODO("Not yet implemented")
    }

    override fun getTrackChunkSlope(trackChunk: DirTrackChunkId): DistanceRangeMap<Double> {
        TODO("Not yet implemented")
    }

    override fun getTrackChunkCurve(trackChunk: DirTrackChunkId): DistanceRangeMap<Double> {
        TODO("Not yet implemented")
    }

    override fun getTrackChunkGradient(trackChunk: DirTrackChunkId): DistanceRangeMap<Double> {
        return makeRangeMap(blockPool[trackChunk.value.index].length, 0.0)
    }

    override fun getTrackChunkLoadingGaugeConstraints(trackChunk: TrackChunkId): DistanceRangeMap<LoadingGaugeConstraint> {
        return DistanceRangeMapImpl()
    }

    override fun getTrackChunkCatenaryVoltage(trackChunk: TrackChunkId): DistanceRangeMap<String> {
        return makeRangeMap(blockPool[trackChunk.index].length, "")
    }

    override fun getTrackChunkNeutralSections(trackChunk: DirTrackChunkId): DistanceRangeMap<NeutralSection> {
        return DistanceRangeMapImpl()
    }

    override fun getTrackChunkSpeedSections(trackChunk: DirTrackChunkId, trainTag: String?): DistanceRangeMap<Speed> {
        val desc = blockPool[trackChunk.value.index]
        return makeRangeMap(desc.length, Speed.fromMetersPerSecond(desc.allowedSpeed))
    }

    override fun getTrackChunkGeom(trackChunk: TrackChunkId): LineString {
        return LineString.make(doubleArrayOf(0.0, 1.0), doubleArrayOf(0.0, 1.0))
    }

    override fun getTrackChunkElectricalProfile(
        trackChunk: TrackChunkId,
        mapping: HashMap<String, DistanceRangeMap<String>>
    ): DistanceRangeMap<String> {
        TODO("Not yet implemented")
    }

    override fun getTrackChunkOperationalPointParts(trackChunk: TrackChunkId): StaticIdxList<OperationalPointPart> {
        TODO("Not yet implemented")
    }

    override fun getOperationalPointPartChunk(operationalPoint: OperationalPointPartId): TrackChunkId {
        TODO("Not yet implemented")
    }

    override fun getOperationalPointPartChunkOffset(operationalPoint: OperationalPointPartId): Distance {
        TODO("Not yet implemented")
    }

    override fun getOperationalPointPartName(operationalPoint: OperationalPointPartId): String {
        TODO("Not yet implemented")
    }

    override val blocks: StaticIdxSpace<Block>
        get() = TODO("Not yet implemented")

    override fun getBlockPath(block: BlockId): StaticIdxList<ZonePath> {
        return makeIndexList(block)
    }

    override fun getBlockSignals(block: BlockId): StaticIdxList<LogicalSignal> {
        TODO("Not yet implemented")
    }

    override fun blockStartAtBufferStop(block: BlockId): Boolean {
        TODO("Not yet implemented")
    }

    override fun blockStopAtBufferStop(block: BlockId): Boolean {
        TODO("Not yet implemented")
    }

    override fun getBlockSignalingSystem(block: BlockId): SignalingSystemId {
        TODO("Not yet implemented")
    }

    override fun getBlocksAtDetector(detector: DirDetectorId): StaticIdxList<Block> {
        val res = mutableStaticIdxArrayListOf<Block>()
        for (x in entryMap.get(detector))
            res.add(x)
        return res
    }

    override fun getBlocksAtSignal(signal: LogicalSignalId): StaticIdxList<Block> {
        TODO("Not yet implemented")
    }

    override fun getSignalsPositions(block: BlockId): DistanceList {
        TODO("Not yet implemented")
    }

    override fun getBlocksFromTrackChunk(
        trackChunk: TrackChunkId,
        direction: Direction
    ): MutableStaticIdxArraySet<Block> {
        TODO("Not yet implemented")
    }

    override fun getTrackChunksFromBlock(block: BlockId): DirStaticIdxList<TrackChunk> {
        return makeDirIndexList(block)
    }

    @JvmName("getBlockLength")
    override fun getBlockLength(block: BlockId): Distance {
        return blockPool[block.index].length
    }
    // endregion

    // region utils
    private fun <T> makeRangeMap(length: Distance, default: T): DistanceRangeMapImpl<T> {
        val res = DistanceRangeMapImpl<T>()
        res.put(0.meters, length, default)
        return res
    }

    private fun <T, U> makeIndexList(id: StaticIdx<T>): StaticIdxList<U> {
        val res = MutableStaticIdxArrayList<U>()
        res.add(StaticIdx(id.index))
        return res
    }

    private fun <T, U> makeDirIndexList(id: StaticIdx<T>): DirStaticIdxList<U> {
        val res = MutableDirStaticIdxArrayList<U>()
        res.add(DirStaticIdx(StaticIdx(id.index), Direction.INCREASING))
        return res
    }
    // endregion

    companion object {
        /** Just for linking / symbol purpose with java interface */
        @JvmStatic
        fun make(): DummyInfra {
            return DummyInfra()
        }
    }
}
