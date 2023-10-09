package fr.sncf.osrd.api.utils;

import static fr.sncf.osrd.sim_infra.api.PathPropertiesKt.buildPathPropertiesFrom;
import static fr.sncf.osrd.sim_infra.api.PathPropertiesKt.makePathProperties;
import static fr.sncf.osrd.sim_infra.api.TrackInfraKt.getTrackSectionFromNameOrThrow;
import static fr.sncf.osrd.sim_infra.impl.PathPropertiesImplKt.buildChunkPath;
import static fr.sncf.osrd.utils.KtToJavaConverter.toIntList;
import static fr.sncf.osrd.utils.units.Distance.fromMeters;

import com.google.common.collect.Iterables;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSDirectionalTrackRange;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPath;
import fr.sncf.osrd.sim_infra.api.BlockInfra;
import fr.sncf.osrd.sim_infra.api.PathProperties;
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra;
import fr.sncf.osrd.sim_infra.api.TrackChunk;
import fr.sncf.osrd.sim_infra.impl.ChunkPath;
import fr.sncf.osrd.utils.Direction;
import fr.sncf.osrd.utils.graph.Pathfinding;
import fr.sncf.osrd.utils.indexing.DirStaticIdxKt;
import fr.sncf.osrd.utils.indexing.MutableDirStaticIdxArrayList;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class PathPropUtils {

    public static PathProperties makePathProps(BlockInfra blockInfra, RawSignalingInfra rawInfra,
                                               Integer blockIdx) {
        return makePathProps(blockInfra, rawInfra, blockIdx, 0, blockInfra.getBlockLength(blockIdx));
    }

    /** Creates the path from a given block id */
    public static PathProperties makePathProps(BlockInfra blockInfra, RawSignalingInfra rawInfra, Integer blockIdx,
                                               long beginOffset, long endOffset) {
        return buildPathPropertiesFrom(rawInfra, blockInfra.getTrackChunksFromBlock(blockIdx), beginOffset, endOffset);
    }


    /**
     * Creates the path from given blocks.
     * @param rawInfra RawSignalingInfra
     * @param blockInfra BlockInfra
     * @param blockIds the blocks in the order they are encountered
     * @param offsetFirstBlock the path offset on the first block in millimeters
     * @return corresponding path
     */
    public static PathProperties makePathProps(RawSignalingInfra rawInfra, BlockInfra blockInfra,
                                               List<Integer> blockIds, long offsetFirstBlock) {
        var chunks = new MutableDirStaticIdxArrayList<TrackChunk>();
        long totalLength = 0;
        for (var blockId : blockIds) {
            for (var zoneId : toIntList(blockInfra.getBlockPath(blockId))) {
                chunks.addAll(rawInfra.getZonePathChunks(zoneId));
                totalLength += rawInfra.getZonePathLength(zoneId);
            }
        }
        return buildPathPropertiesFrom(rawInfra, chunks, offsetFirstBlock, totalLength);
    }

    /** Creates a `Path` instance from a list of block ranges */
    public static PathProperties makePathProps(RawSignalingInfra rawInfra, BlockInfra blockInfra,
                                               List<Pathfinding.EdgeRange<Integer>> blockRanges) {
        var chunkPath = makeChunkPath(rawInfra, blockInfra, blockRanges);
        return makePathProperties(rawInfra, chunkPath);
    }

    /** Builds a PathProperties from an RJSTrainPath */
    public static PathProperties makePathProps(RawSignalingInfra rawInfra, RJSTrainPath rjsPath) {
        var chunkPath = makeChunkPath(rawInfra, rjsPath);
        return makePathProperties(rawInfra, chunkPath);
    }

    /** Creates a ChunkPath from a list of block ranges */
    public static ChunkPath makeChunkPath(RawSignalingInfra rawInfra, BlockInfra blockInfra,
                                          List<Pathfinding.EdgeRange<Integer>> blockRanges) {
        assert !blockRanges.isEmpty();
        long totalBlockPathLength = 0;
        var chunks = new MutableDirStaticIdxArrayList<TrackChunk>();
        for (var range : blockRanges) {
            var zonePaths = blockInfra.getBlockPath(range.edge());
            for (var zonePath : toIntList(zonePaths)) {
                chunks.addAll(rawInfra.getZonePathChunks(zonePath));
                var zoneLength = rawInfra.getZonePathLength(zonePath);
                totalBlockPathLength += zoneLength;
            }
        }
        long startOffset = blockRanges.get(0).start();
        var lastRange = blockRanges.get(blockRanges.size() - 1);
        var lastBlockLength = blockInfra.getBlockLength(lastRange.edge());
        var endOffset = totalBlockPathLength - lastBlockLength + lastRange.end();
        return buildChunkPath(rawInfra, chunks, startOffset, endOffset);
    }

    /** Builds a ChunkPath from an RJSTrainPath */
    public static ChunkPath makeChunkPath(RawSignalingInfra rawInfra, RJSTrainPath rjsPath) {
        var trackRanges = new ArrayList<RJSDirectionalTrackRange>();
        for (var routePath : rjsPath.routePath) {
            for (var trackRange : routePath.trackSections) {
                var lastTrackRange = Iterables.getLast(trackRanges, null);
                if (lastTrackRange != null && lastTrackRange.trackSectionID.equals(trackRange.trackSectionID)) {
                    assert lastTrackRange.getEnd() == trackRange.getBegin();
                    assert lastTrackRange.direction == trackRange.direction;
                    if (trackRange.direction == EdgeDirection.START_TO_STOP)
                        lastTrackRange.end = trackRange.end;
                    else
                        lastTrackRange.begin = trackRange.begin;
                } else {
                    trackRanges.add(trackRange);
                }
            }
        }
        var chunks = new MutableDirStaticIdxArrayList<TrackChunk>();
        for (var trackRange : trackRanges) {
            var trackId = getTrackSectionFromNameOrThrow(trackRange.trackSectionID, rawInfra);
            var dir = trackRange.direction == EdgeDirection.START_TO_STOP ? Direction.INCREASING : Direction.DECREASING;
            var chunksOnTrack = toIntList(rawInfra.getTrackSectionChunks(trackId));
            if (dir == Direction.DECREASING)
                Collections.reverse(chunksOnTrack);
            for (var chunk : chunksOnTrack)
                chunks.add(DirStaticIdxKt.from(chunk, dir));
        }
        var firstRange = trackRanges.get(0);
        var startOffset = fromMeters(firstRange.begin);
        if (firstRange.direction == EdgeDirection.STOP_TO_START) {
            var firstTrackId = getTrackSectionFromNameOrThrow(trackRanges.get(0).trackSectionID, rawInfra);
            startOffset = rawInfra.getTrackSectionLength(firstTrackId) - fromMeters(firstRange.end);
        }
        var endOffset = startOffset + fromMeters(
                trackRanges.stream()
                        .mapToDouble(r -> r.end - r.begin)
                        .sum()
        );
        return buildChunkPath(rawInfra, chunks, startOffset, endOffset);
    }
}
