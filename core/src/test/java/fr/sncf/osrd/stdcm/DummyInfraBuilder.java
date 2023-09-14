package fr.sncf.osrd.stdcm;

import com.google.common.graph.ImmutableNetwork;
import com.google.common.graph.NetworkBuilder;
import fr.sncf.osrd.api.FullInfra;
import fr.sncf.osrd.geom.LineString;
import fr.sncf.osrd.sim_infra.api.*;
import fr.sncf.osrd.sim_infra.impl.NeutralSection;
import fr.sncf.osrd.utils.Direction;
import fr.sncf.osrd.utils.DistanceRangeMap;
import fr.sncf.osrd.utils.indexing.*;
import fr.sncf.osrd.utils.units.DistanceList;
import fr.sncf.osrd.utils.units.Speed;
import kotlin.NotImplementedError;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** This class is used to create a minimal infra to be used on STDCM tests, with a simple block graph. */
public class DummyInfraBuilder {

    public final RawSignalingInfra rawInfra = new DummyRawInfra();
    public final BlockInfra blockInfra = new DummyBlockInfra();

    /** get the FullInfra */
    public FullInfra fullInfra() {
        return new FullInfra(
                null,
                new DummyRawInfra(),
                null,
                new DummyBlockInfra(),
                null
        );
    }

    /** Creates a block going from nodes `entry` to `exit` of length 100, named $entry->$exit */
    public int addBlock(String entry, String exit) {
        return addBlock(entry, exit, 100);
    }

    /** Creates a block going from nodes `entry` to `exit` of length `length`, named $entry->$exit */
    public int addBlock(String entry, String exit, long length) {
        return addBlock(entry, exit, length, Double.POSITIVE_INFINITY);
    }

    /** Creates a block going from nodes `entry` to `exit` of length `length`, named $entry->$exit,
     * with the given maximum speed */
    public int addBlock(String entry, String exit, long length, double allowedSpeed) {
        var name = String.format("%s->%s", entry, exit);
        throw new NotImplementedError();
    }

    public static class DummyRawInfra implements RawSignalingInfra {

        @Override
        public int getZones() {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public StaticIdxSortedSet<TrackNode> getMovableElements(int zone) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public List<DirStaticIdx<Detector>> getZoneBounds(int zone) {
            throw new NotImplementedError();
        }

        @Override
        public int getDetectors() {
            throw new NotImplementedError();
        }

        @Nullable
        @Override
        public StaticIdx<Zone> getNextZone(int dirDet) {
            throw new NotImplementedError();
        }

        @Nullable
        @Override
        public StaticIdx<Zone> getPreviousZone(int dirDet) {
            throw new NotImplementedError();
        }

        @Nullable
        @Override
        public String getDetectorName(int det) {
            throw new NotImplementedError();
        }

        @Override
        public int getZonePaths() {
            throw new NotImplementedError();
        }

        @Nullable
        @Override
        public StaticIdx<ZonePath> findZonePath(int entry, int exit, @NotNull StaticIdxList<TrackNode> movableElements, @NotNull StaticIdxList<TrackNodeConfig> trackNodeConfigs) {
            throw new NotImplementedError();
        }

        @Override
        public int getZonePathEntry(int zonePath) {
            throw new NotImplementedError();
        }

        @Override
        public int getZonePathExit(int zonePath) {
            throw new NotImplementedError();
        }

        @Override
        public long getZonePathLength(int zonePath) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public StaticIdxList<TrackNode> getZonePathMovableElements(int zonePath) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public StaticIdxList<TrackNodeConfig> getZonePathMovableElementsConfigs(int zonePath) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public DistanceList getZonePathMovableElementsDistances(int zonePath) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public DirStaticIdxList<TrackChunk> getZonePathChunks(int zonePath) {
            throw new NotImplementedError();
        }

        @Override
        public int getRoutes() {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public StaticIdxList<ZonePath> getRoutePath(int route) {
            throw new NotImplementedError();
        }

        @Nullable
        @Override
        public String getRouteName(int route) {
            throw new NotImplementedError();
        }

        @Override
        public int getRouteFromName(@NotNull String name) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public int[] getRouteReleaseZones(int route) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public DirStaticIdxList<TrackChunk> getChunksOnRoute(int route) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public StaticIdxList<Route> getRoutesOnTrackChunk(int trackChunk) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public StaticIdxList<Route> getRoutesStartingAtDet(int dirDetector) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public StaticIdxList<Route> getRoutesEndingAtDet(int dirDetector) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public StaticIdxList<PhysicalSignal> getSignals(int zonePath) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public DistanceList getSignalPositions(int zonePath) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public StaticIdxList<SpeedLimit> getSpeedLimits(int route) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public DistanceList getSpeedLimitStarts(int route) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public DistanceList getSpeedLimitEnds(int route) {
            throw new NotImplementedError();
        }

        @Override
        public int getPhysicalSignals() {
            throw new NotImplementedError();
        }

        @Override
        public int getLogicalSignals() {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public StaticIdxList<LogicalSignal> getLogicalSignals(int signal) {
            throw new NotImplementedError();
        }

        @Override
        public int getPhysicalSignal(int signal) {
            throw new NotImplementedError();
        }

        @Nullable
        @Override
        public String getPhysicalSignalName(int signal) {
            throw new NotImplementedError();
        }

        @Override
        public long getSignalSightDistance(int signal) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public String getSignalingSystemId(int signal) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public Map<String, String> getRawSettings(int signal) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public List<String> getNextSignalingSystemIds(int signal) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public String getTrackSectionName(int trackSection) {
            throw new NotImplementedError();
        }

        @Nullable
        @Override
        public StaticIdx<TrackSection> getTrackSectionFromName(@NotNull String name) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public StaticIdxList<TrackChunk> getTrackSectionChunks(int trackSection) {
            throw new NotImplementedError();
        }

        @Override
        public long getTrackSectionLength(int trackSection) {
            throw new NotImplementedError();
        }

        @Override
        public int getNextTrackSection(int currentTrack, int config) {
            throw new NotImplementedError();
        }

        @Override
        public int getNextTrackNode(int trackSection) {
            throw new NotImplementedError();
        }

        @Override
        public int getNextTrackNodePort(int trackSection) {
            throw new NotImplementedError();
        }

        @Override
        public int getPortConnection(int trackNode, int port) {
            throw new NotImplementedError();
        }

        @Override
        public int getTrackNodeConfigs(int trackNode) {
            throw new NotImplementedError();
        }

        @Override
        public int getTrackNodePorts(int trackNode) {
            throw new NotImplementedError();
        }

        @Override
        public int getTrackNodeExitPort(int trackNode, int config, int entryPort) {
            throw new NotImplementedError();
        }

        @Override
        public long getTrackNodeDelay(int trackNode) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public String getTrackNodeConfigName(int trackNode, int config) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public String getTrackNodeName(int trackNode) {
            throw new NotImplementedError();
        }

        @Override
        public int getTrackNodes() {
            throw new NotImplementedError();
        }

        @Override
        public int getTrackSections() {
            throw new NotImplementedError();
        }

        @Override
        public long getTrackChunkLength(int trackChunk) {
            throw new NotImplementedError();
        }

        @Override
        public long getTrackChunkOffset(int trackChunk) {
            throw new NotImplementedError();
        }

        @Override
        public int getTrackFromChunk(int trackChunk) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public DistanceRangeMap<Double> getTrackChunkSlope(int trackChunk) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public DistanceRangeMap<Double> getTrackChunkCurve(int trackChunk) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public DistanceRangeMap<Double> getTrackChunkGradient(int trackChunk) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public DistanceRangeMap<LoadingGaugeConstraint> getTrackChunkLoadingGaugeConstraints(int trackChunk) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public DistanceRangeMap<String> getTrackChunkCatenaryVoltage(int trackChunk) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public DistanceRangeMap<NeutralSection> getTrackChunkNeutralSections(int trackChunk) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public DistanceRangeMap<Speed> getTrackChunkSpeedSections(int trackChunk, @Nullable String trainTag) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public LineString getTrackChunkGeom(int trackChunk) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public DistanceRangeMap<String> getTrackChunkElectricalProfile(int trackChunk, @NotNull HashMap<String, DistanceRangeMap<String>> mapping) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public StaticIdxList<OperationalPointPart> getTrackChunkOperationalPointParts(int trackChunk) {
            throw new NotImplementedError();
        }

        @Override
        public int getOperationalPointPartChunk(int operationalPoint) {
            throw new NotImplementedError();
        }

        @Override
        public long getOperationalPointPartChunkOffset(int operationalPoint) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public String getOperationalPointPartName(int operationalPoint) {
            throw new NotImplementedError();
        }
    }

    public static class DummyBlockInfra implements BlockInfra {

        @Override
        public int getBlocks() {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public StaticIdxList<ZonePath> getBlockPath(int block) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public StaticIdxList<LogicalSignal> getBlockSignals(int block) {
            throw new NotImplementedError();
        }

        @Override
        public boolean blockStartAtBufferStop(int block) {
            throw new NotImplementedError();
        }

        @Override
        public boolean blockStopAtBufferStop(int block) {
            throw new NotImplementedError();
        }

        @Override
        public int getBlockSignalingSystem(int block) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public StaticIdxList<Block> getBlocksAtDetector(int detector) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public StaticIdxList<Block> getBlocksAtSignal(int signal) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public DistanceList getSignalsPositions(int block) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public MutableStaticIdxArraySet<Block> getBlocksFromTrackChunk(int trackChunk, @NotNull Direction direction) {
            throw new NotImplementedError();
        }

        @NotNull
        @Override
        public DirStaticIdxList<TrackChunk> getTrackChunksFromBlock(int block) {
            throw new NotImplementedError();
        }

        @Override
        public long getBlockLength(int block) {
            throw new NotImplementedError();
        }
    }
}
