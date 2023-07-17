package fr.sncf.osrd.api.pathfinding;

import static fr.sncf.osrd.sim_infra.api.TrackInfraKt.getTrackSectionFromNameOrThrow;
import static fr.sncf.osrd.utils.KtToJavaConverter.toIntList;
import static fr.sncf.osrd.utils.KtToJavaConverter.toIntSet;
import static fr.sncf.osrd.utils.indexing.DirStaticIdxKt.toValue;

import fr.sncf.osrd.api.FullInfra;
import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra;
import fr.sncf.osrd.sim_infra_adapter.SimInfraAdapter;
import fr.sncf.osrd.utils.graph.Pathfinding;
import fr.sncf.osrd.utils.units.Distance;
import java.util.HashSet;
import java.util.Set;


/**
 * PathfindingRoutesEndpoint but with blocks.
 * TODO: finish implementing the rest of the class and modify this javadoc accordingly.
 */
public class PathfindingBlocksEndpoint {

    /**
     * Returns all the EdgeLocations of a waypoint.
     * @param infra full infra.
     * @param waypoint corresponding waypoint.
     * @return corresponding edge location, containing a block id and its offset from the waypoint.
     */
    public static Set<Pathfinding.EdgeLocation<Integer>> findWaypointBlocks(FullInfra infra,
                                                                            PathfindingWaypoint waypoint) {
        var res = new HashSet<Pathfinding.EdgeLocation<Integer>>();
        var trackSectionId = getTrackSectionFromNameOrThrow(waypoint.trackSection, infra.rawInfra());
        var trackChunkOnWaypoint = getTrackSectionChunkOnWaypoint(trackSectionId, waypoint.offset, infra.rawInfra());
        var waypointDirection = Direction.fromEdgeDir(waypoint.direction).toKtDirection();
        var blocksOnWaypoint =
                toIntSet(infra.blockInfra().getBlocksFromTrackChunk(trackChunkOnWaypoint, waypointDirection));
        blocksOnWaypoint.forEach(block -> {
            var offset = getBlockOffset(block, trackChunkOnWaypoint, waypoint.offset, infra);
            res.add(new Pathfinding.EdgeLocation<>(block, offset));
        });
        return res;
    }

    private static Integer getTrackSectionChunkOnWaypoint(int trackSectionId, double waypointOffset,
                                                          RawSignalingInfra rawInfra) {
        var waypointOffsetMilli = Distance.fromMeters(waypointOffset);
        var trackSectionChunks = toIntList(rawInfra.getTrackSectionChunks(trackSectionId));
        return trackSectionChunks.stream()
                .filter(chunk -> {
                    var startChunk = rawInfra.getTrackChunkOffset(chunk);
                    var endChunk = startChunk + rawInfra.getTrackChunkLength(chunk);
                    return waypointOffsetMilli >= startChunk && waypointOffsetMilli <= endChunk;
                })
                .findFirst()
                .orElseThrow(() -> new RuntimeException(
                        String.format("The waypoint is not located on the track section %s", trackSectionId)));

    }

    private static double getBlockOffset(int blockId, int trackChunkId, double waypointOffset, FullInfra infra) {
        var waypointOffsetMilli = Distance.fromMeters(waypointOffset);
        var startBlockToStartChunk = 0L;
        var trackChunkOffset = infra.rawInfra().getTrackChunkOffset(trackChunkId);
        var blockTrackChunks = toIntList(infra.blockInfra().getTrackChunksFromBlock(blockId));
        for (Integer blockTrackChunkDirId: blockTrackChunks) {
            var blockTrackChunkId = toValue(blockTrackChunkDirId);
            if (blockTrackChunkId == trackChunkId) {
                return Distance.toMeters(startBlockToStartChunk + waypointOffsetMilli - trackChunkOffset);
            }
            startBlockToStartChunk += infra.rawInfra().getTrackChunkLength(blockTrackChunkId);
        }
        throw new AssertionError(
                String.format("getBlockOffset: Track chunk %s not in block %s", trackChunkId, blockId));
    }
}
