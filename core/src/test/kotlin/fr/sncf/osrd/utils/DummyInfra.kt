package fr.sncf.osrd.utils

import com.google.common.collect.HashBiMap
import com.google.common.collect.HashMultimap
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.makeSignalingSimulator
import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.geom.Point
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.NeutralSection
import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.*
import kotlin.time.Duration

/**
 * This class is used to create a minimal infra to be used on unit tests, with a simple block graph.
 * Ids are all interchangeable: there's one zone, one chunk, one track, one route, one signal per
 * block, each having the same id as the block. Block descriptor can be edited when we need to set
 * data that isn't included in the method parameters. Not all methods are implemented, but it can be
 * added when relevant.
 */
class DummyInfra : RawInfra, BlockInfra {

    val blockPool =
        mutableListOf<DummyBlockDescriptor>() // A StaticPool (somehow) fails to link with java here
    val detectorGeoPoint = HashMap<String, Point>()
    private val detectorMap = HashBiMap.create<String, DirDetectorId>()
    private val entryMap = HashMultimap.create<DirDetectorId, BlockId>()
    private val exitMap = HashMultimap.create<DirDetectorId, BlockId>()
    private val signalingSimulator = makeSignalingSimulator()

    /** get the FullInfra */
    fun fullInfra(): FullInfra {
        return FullInfra(this, signalingSimulator.loadSignals(this), this, signalingSimulator)
    }

    /**
     * Creates a block going from nodes `entry` to `exit` of length `length`, named $entry->$exit,
     * with the given maximum speed and signaling system. If the nodes do not exist they are
     * created.
     */
    fun addBlock(
        entry: String,
        exit: String,
        length: Distance = 100.meters,
        allowedSpeed: Double = Double.POSITIVE_INFINITY,
        signalingSystemName: String = "BAL"
    ): BlockId {
        val name = String.format("%s->%s", entry, exit)
        val entryId =
            detectorMap.computeIfAbsent(entry) { DirDetectorId(detectorMap.size.toUInt() * 2u) }
        val exitId =
            detectorMap.computeIfAbsent(exit) { DirDetectorId(detectorMap.size.toUInt() * 2u) }
        val id = BlockId(blockPool.size.toUInt())
        val signalingSystemId = getSignalingSystemIdfromName(signalingSystemName)
        blockPool.add(
            DummyBlockDescriptor(
                length,
                name,
                entryId,
                exitId,
                allowedSpeed,
                0.0,
                signalingSystemId,
                signalingSystemName
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
        var gradient: Double,
        var signalingSystemId: SignalingSystemId,
        var signalingSystemName: String,
        var voltage: String = "",
        var neutralSectionForward: NeutralSection? = null,
        var neutralSectionBackward: NeutralSection? = null,
    )

    // region inherited

    override fun getSignals(zonePath: ZonePathId): StaticIdxList<PhysicalSignal> {
        return makeIndexList(zonePath)
    }

    override fun getSignalPositions(zonePath: ZonePathId): OffsetList<ZonePath> {
        return mutableOffsetArrayListOf(Offset(0.meters))
    }

    override fun getSpeedLimits(route: RouteId): StaticIdxList<SpeedLimit> {
        TODO("Not yet implemented")
    }

    override fun getSpeedLimitStarts(route: RouteId): OffsetList<Route> {
        TODO("Not yet implemented")
    }

    override fun getSpeedLimitEnds(route: RouteId): OffsetList<Route> {
        TODO("Not yet implemented")
    }

    override val physicalSignals: StaticIdxSpace<PhysicalSignal>
        get() = StaticIdxSpace(blockPool.size.toUInt())

    override val logicalSignals: StaticIdxSpace<LogicalSignal>
        get() = StaticIdxSpace(blockPool.size.toUInt())

    override fun getLogicalSignals(signal: PhysicalSignalId): StaticIdxList<LogicalSignal> {
        return makeIndexList(signal)
    }

    override fun getPhysicalSignal(signal: LogicalSignalId): PhysicalSignalId {
        return convertId(signal)
    }

    override fun getPhysicalSignalName(signal: PhysicalSignalId): String {
        return "BAL"
    }

    override fun getSignalSightDistance(signal: PhysicalSignalId): Distance {
        return 400.meters
    }

    override fun getSignalingSystemId(signal: LogicalSignalId): String {
        return blockPool[signal.index].signalingSystemName
    }

    private fun getSignalingSystemIdfromName(signalingSystemName: String): SignalingSystemId {
        return this.signalingSimulator.sigModuleManager.findSignalingSystem(signalingSystemName)
    }

    override fun getRawSettings(signal: LogicalSignalId): Map<String, String> {
        return mapOf("Nf" to "false")
    }

    override fun getRawParameters(signal: LogicalSignalId): RawSignalParameters {
        return RawSignalParameters(mapOf("jaune_cli" to "false"), mapOf())
    }

    override fun getNextSignalingSystemIds(signal: LogicalSignalId): List<String> {
        val sigSystemName = blockPool[signal.index].signalingSystemName
        return listOf(sigSystemName)
    }

    override val routes: StaticIdxSpace<Route>
        get() = TODO("Not yet implemented")

    override fun getRoutePath(route: RouteId): StaticIdxList<ZonePath> {
        return makeIndexList(route)
    }

    override fun getRouteName(route: RouteId): String {
        return blockPool[route.index].name
    }

    override fun getRouteLength(route: RouteId): Length<Route> {
        return Length(blockPool[route.index].length)
    }

    override fun getRouteFromName(name: String): RouteId {
        for (i in 0 until blockPool.size) {
            if (blockPool[i].name == name) return RouteId(i.toUInt())
        }
        return RouteId((-1).toUInt())
    }

    override fun getRouteReleaseZones(route: RouteId): IntArray {
        TODO("Not yet implemented")
    }

    override fun getChunksOnRoute(route: RouteId): DirStaticIdxList<TrackChunk> {
        return makeDirIndexList(route)
    }

    override fun getRoutesOnTrackChunk(trackChunk: DirTrackChunkId): StaticIdxList<Route> {
        return makeIndexList(trackChunk.value)
    }

    override fun getRoutesStartingAtDet(dirDetector: DirDetectorId): StaticIdxList<Route> {
        val res = mutableStaticIdxArrayListOf<Route>()
        for (x in entryMap.get(dirDetector)) res.add(StaticIdx(x.index))
        return res
    }

    override fun getRoutesEndingAtDet(dirDetector: DirDetectorId): StaticIdxList<Route> {
        val res = mutableStaticIdxArrayListOf<Route>()
        for (x in exitMap.get(dirDetector)) res.add(StaticIdx(x.index))
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

    override fun getZonePathLength(zonePath: ZonePathId): Length<ZonePath> {
        return Length(blockPool[zonePath.index].length)
    }

    override fun getZonePathMovableElements(zonePath: ZonePathId): StaticIdxList<TrackNode> {
        TODO("Not yet implemented")
    }

    override fun getZonePathMovableElementsConfigs(
        zonePath: ZonePathId
    ): StaticIdxList<TrackNodeConfig> {
        TODO("Not yet implemented")
    }

    override fun getZonePathMovableElementsPositions(zonePath: ZonePathId): OffsetList<ZonePath> {
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

    override fun getZoneName(zone: ZoneId): String {
        return getRouteName(RouteId(zone.index))
    }

    override fun getZoneFromName(name: String): ZoneId {
        return ZoneId(getRouteFromName(name).index)
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
        return detectorMap.inverse()[DirDetectorId(det, Direction.INCREASING)]
    }

    override fun getNextTrackSection(
        currentTrack: DirTrackSectionId,
        config: TrackNodeConfigId
    ): OptDirTrackSectionId {
        TODO("Not yet implemented")
    }

    override fun getNextTrackNode(trackSection: DirTrackSectionId): OptStaticIdx<TrackNode> {
        TODO("Not yet implemented")
    }

    override fun getNextTrackNodePort(
        trackSection: DirTrackSectionId
    ): OptStaticIdx<TrackNodePort> {
        TODO("Not yet implemented")
    }

    override fun getPortConnection(
        trackNode: TrackNodeId,
        port: TrackNodePortId
    ): EndpointTrackSectionId {
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

    override fun getTrackSectionFromName(name: String): TrackSectionId {
        return TrackSectionId(getRouteFromName(name).index)
    }

    override fun getTrackSectionChunks(trackSection: TrackSectionId): StaticIdxList<TrackChunk> {
        return mutableStaticIdxArrayListOf(StaticIdx(trackSection.index))
    }

    override fun getTrackSectionLength(trackSection: TrackSectionId): Length<TrackSection> {
        return Length(getBlockLength(BlockId(trackSection.index)).distance)
    }

    override fun getTrackChunkLength(trackChunk: TrackChunkId): Length<TrackChunk> {
        return Length(blockPool[trackChunk.index].length)
    }

    override fun getTrackChunkOffset(trackChunk: TrackChunkId): Offset<TrackSection> {
        return Offset(0.meters)
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
        val desc = blockPool[trackChunk.value.index]
        return makeRangeMap(desc.length, desc.gradient)
    }

    override fun getTrackChunkLoadingGaugeConstraints(
        trackChunk: TrackChunkId
    ): DistanceRangeMap<LoadingGaugeConstraint> {
        return DistanceRangeMapImpl()
    }

    override fun getTrackChunkElectrificationVoltage(
        trackChunk: TrackChunkId
    ): DistanceRangeMap<String> {
        return makeRangeMap(blockPool[trackChunk.index].length, blockPool[trackChunk.index].voltage)
    }

    override fun getTrackChunkNeutralSections(
        trackChunk: DirTrackChunkId
    ): DistanceRangeMap<NeutralSection> {
        val desc = blockPool[trackChunk.value.index]
        val neutralSection =
            if (trackChunk.direction == Direction.INCREASING) desc.neutralSectionForward
            else desc.neutralSectionBackward
        return if (neutralSection == null) DistanceRangeMapImpl()
        else makeRangeMap(desc.length, neutralSection)
    }

    override fun getTrackChunkSpeedSections(
        trackChunk: DirTrackChunkId,
        trainTag: String?,
        route: String?
    ): DistanceRangeMap<Speed> {
        val desc = blockPool[trackChunk.value.index]
        return makeRangeMap(desc.length, desc.allowedSpeed.metersPerSecond)
    }

    override fun getTrackChunkGeom(trackChunk: TrackChunkId): LineString {
        val entryDetName = getDetectorName(getRouteEntry(RouteId(trackChunk.index)).value)
        val exitDetName = getDetectorName(getRouteExit(RouteId(trackChunk.index)).value)
        val entry = detectorGeoPoint.getOrDefault(entryDetName, Point(0.0, 0.0))
        val exit = detectorGeoPoint.getOrDefault(exitDetName, Point(1.0, 1.0))
        return LineString.make(entry, exit)
    }

    override fun getTrackChunkOperationalPointParts(
        trackChunk: TrackChunkId
    ): StaticIdxList<OperationalPointPart> {
        return mutableStaticIdxArrayListOf()
    }

    override fun getOperationalPointPartChunk(
        operationalPoint: OperationalPointPartId
    ): TrackChunkId {
        TODO("Not yet implemented")
    }

    override fun getOperationalPointPartChunkOffset(
        operationalPoint: OperationalPointPartId
    ): Offset<TrackChunk> {
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

    override fun getBlocksInZone(zone: ZoneId): StaticIdxList<Block> {
        return mutableStaticIdxArrayListOf(BlockId(zone.index))
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
        return blockPool[block.index].signalingSystemId
    }

    override fun getBlocksStartingAtDetector(detector: DirDetectorId): StaticIdxList<Block> {
        val res = mutableStaticIdxArrayListOf<Block>()
        for (x in entryMap.get(detector)) res.add(x)
        return res
    }

    override fun getBlocksEndingAtDetector(detector: DirDetectorId): StaticIdxList<Block> {
        val res = mutableStaticIdxArrayListOf<Block>()
        for (id in getRoutesEndingAtDet(detector)) res.add(BlockId(id.index))
        return res
    }

    override fun getBlocksAtSignal(signal: LogicalSignalId): StaticIdxList<Block> {
        TODO("Not yet implemented")
    }

    override fun getSignalsPositions(block: BlockId): OffsetList<Block> {
        TODO("Not yet implemented")
    }

    override fun getBlocksFromTrackChunk(
        trackChunk: TrackChunkId,
        direction: Direction
    ): MutableStaticIdxArraySet<Block> {
        return mutableStaticIdxArraySetOf(StaticIdx(trackChunk.index))
    }

    override fun getTrackChunksFromBlock(block: BlockId): DirStaticIdxList<TrackChunk> {
        return makeDirIndexList(block)
    }

    override fun getBlockLength(block: BlockId): Length<Block> {
        return Length(blockPool[block.index].length)
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

    private fun <T, U> convertId(id: StaticIdx<T>): StaticIdx<U> {
        return StaticIdx(id.index)
    }
    // endregion
}
