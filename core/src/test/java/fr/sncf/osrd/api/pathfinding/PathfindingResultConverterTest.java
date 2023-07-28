package fr.sncf.osrd.api.pathfinding;

import static fr.sncf.osrd.Helpers.getBlocksOnRoutes;
import static fr.sncf.osrd.api.pathfinding.PathfindingResultConverter.*;
import static fr.sncf.osrd.utils.KtToJavaConverter.toIntList;
import static fr.sncf.osrd.utils.indexing.DirStaticIdxKt.toDirection;
import static fr.sncf.osrd.utils.indexing.DirStaticIdxKt.toValue;
import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.api.FullInfra;
import fr.sncf.osrd.sim_infra.impl.PathPropertiesImpl;
import fr.sncf.osrd.api.utils.PathPropUtils;
import fr.sncf.osrd.utils.Direction;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

public class PathfindingResultConverterTest {

    /** Convert block ranges into a path, with the chunks going forward */
    @Test
    public void testMakePathForward() {
        var infra = Helpers.getSmallInfra();
        var blocks = getBlocksOnRoutes(infra, List.of(
                "rt.DA2->DA5",
                "rt.DA5->DC5"
        ));
        var ranges = new ArrayList<Pathfinding.EdgeRange<Integer>>();
        for (var block : blocks) {
            ranges.add(new Pathfinding.EdgeRange<>(block, 0,
                    infra.blockInfra().getBlockLength(block)));
        }
        var path = PathPropUtils.makePathProps(infra.rawInfra(), infra.blockInfra(), ranges);
        var pathImpl = (PathPropertiesImpl) path;

        var expectedLength = 10_000_000 + 1_000_000; // length of route 1 + 2
        assertEquals(0, pathImpl.getBeginOffset());
        assertEquals(expectedLength, pathImpl.getEndOffset());
        checkBlocks(infra, pathImpl, Set.of("TA0", "TA6", "TC1"), Direction.INCREASING, expectedLength);
    }

    /** Convert block ranges into a path, with the chunks going backward and partial ranges */
    @Test
    public void testMakePathBackward() {
        var infra = Helpers.getSmallInfra();
        var blocks = getBlocksOnRoutes(infra, List.of(
                "rt.DD0->DC0",
                "rt.DC0->DA3"
        ));
        assert blocks.size() == 4;
        var ranges = List.of(
                new Pathfinding.EdgeRange<>(blocks.get(0), 10_000,
                        infra.blockInfra().getBlockLength(blocks.get(0))),
                new Pathfinding.EdgeRange<>(blocks.get(1), 0,
                        infra.blockInfra().getBlockLength(blocks.get(1))),
                new Pathfinding.EdgeRange<>(blocks.get(2), 0,
                        infra.blockInfra().getBlockLength(blocks.get(2))),
                new Pathfinding.EdgeRange<>(blocks.get(3), 0,
                        infra.blockInfra().getBlockLength(blocks.get(3)) - 10_000)
        );
        var path = PathPropUtils.makePathProps(infra.rawInfra(), infra.blockInfra(), ranges);
        var pathImpl = (PathPropertiesImpl) path;

        var expectedBlockLength = 1_050_000 + 10_000_000; // length of route 1 + 2
        assertEquals(10_000, pathImpl.getBeginOffset());
        assertEquals(expectedBlockLength - 10_000, pathImpl.getEndOffset());
        checkBlocks(infra, pathImpl, Set.of("TC0", "TD0", "TA6"), Direction.DECREASING, expectedBlockLength);
    }

    /** Tests the waypoint result on a path that has one user-defined waypoint and one operational point */
    @Test
    public void testPathWaypoint() {
        var infra = Helpers.getSmallInfra();
        var blocks = getBlocksOnRoutes(infra, List.of(
                "rt.buffer_stop.0->DA2"
        ));
        assert blocks.size() == 1;
        var ranges = List.of(new Pathfinding.EdgeRange<>(blocks.get(0), 600_000, 800_000));
        var path = PathPropUtils.makePathProps(infra.rawInfra(), infra.blockInfra(), ranges);
        var rawResult = new Pathfinding.Result<>(ranges, List.of(
                new Pathfinding.EdgeLocation<>(ranges.get(0).edge(), 650_000)
        ));
        var waypoints = makePathWaypoint(
                path, rawResult, infra.rawInfra(), infra.blockInfra()
        );

        assertEquals(2, waypoints.size());

        assertEquals("TA0", waypoints.get(0).location.trackSection);
        assertEquals(650.0, waypoints.get(0).location.offset, 1e-5);
        assertFalse(waypoints.get(0).suggestion);
        assertNull(waypoints.get(0).id);

        assertEquals("TA0", waypoints.get(1).location.trackSection);
        assertEquals(700, waypoints.get(1).location.offset, 1e-5);
        assertTrue(waypoints.get(1).suggestion);
        assertEquals("South_West_station", waypoints.get(1).id);
    }

    /** Test the waypoints on a path that starts and ends on the same block. This can happen in rare cases with loops
     * and can easily cause errors. The path isn't continuous in this test, we only check the waypoint offsets */
    @Test
    public void testPathWaypointOnLoop() {
        var infra = Helpers.getSmallInfra();
        var blocks = getBlocksOnRoutes(infra, List.of(
                "rt.buffer_stop.0->DA2"
        ));
        assert blocks.size() == 1;
        var blockId = blocks.get(0);
        var blockLength = infra.blockInfra().getBlockLength(blockId);
        var ranges = List.of(
                new Pathfinding.EdgeRange<>(blockId, 600_000, blockLength),
                new Pathfinding.EdgeRange<>(blockId, 0, 200_000)
        );
        var rawResult = new Pathfinding.Result<>(ranges, List.of(
                new Pathfinding.EdgeLocation<>(ranges.get(0).edge(), 600_000),
                new Pathfinding.EdgeLocation<>(ranges.get(0).edge(), 200_000)
        ));
        var path = PathPropUtils.makePathProps(infra.rawInfra(), infra.blockInfra(), ranges);
        var waypoints = makePathWaypoint(
                path, rawResult, infra.rawInfra(), infra.blockInfra()
        );

        var userDefinedWaypoints = waypoints.stream()
                .filter(wp -> !wp.suggestion)
                .toList();

        assertEquals(2, userDefinedWaypoints.size());

        assertEquals("TA0", userDefinedWaypoints.get(0).location.trackSection);
        assertEquals(600.0, userDefinedWaypoints.get(0).location.offset, 1e-5);
        assertEquals("TA0", userDefinedWaypoints.get(1).location.trackSection);
        assertEquals(200.0, userDefinedWaypoints.get(1).location.offset, 1e-5);
    }

    private static void checkBlocks(
            FullInfra infra,
            PathPropertiesImpl path,
            Set<String> allowedTracks,
            Direction direction,
            long length
    ) {
        long totalLength = 0;
        for (Integer dirChunk : toIntList(path.getChunks())) {
            var trackName = infra.rawInfra().getTrackSectionName(infra.rawInfra().getTrackFromChunk(toValue(dirChunk)));
            assertTrue(allowedTracks.contains(trackName));
            assertEquals(direction, toDirection(dirChunk));
            totalLength += infra.rawInfra().getTrackChunkLength(toValue(dirChunk));
        }
        assertEquals(length, totalLength);
    }
}
