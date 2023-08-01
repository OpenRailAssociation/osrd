package fr.sncf.osrd.api.pathfinding;

import static fr.sncf.osrd.Helpers.getBlocksOnRoutes;
import static fr.sncf.osrd.api.pathfinding.PathfindingResultConverter.makePath;
import static fr.sncf.osrd.api.pathfinding.PathfindingResultConverter.makePathWaypoint;
import static fr.sncf.osrd.api.pathfinding.PathfindingResultConverter.makeRoutePath;
import static fr.sncf.osrd.utils.KtToJavaConverter.toIntList;
import static fr.sncf.osrd.utils.indexing.DirStaticIdxKt.toDirection;
import static fr.sncf.osrd.utils.indexing.DirStaticIdxKt.toValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.api.FullInfra;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
import fr.sncf.osrd.sim_infra.impl.PathImpl;
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
                "rt.DA2->DA6_1",
                "rt.DA6_1->DA6_2"
        ));
        var ranges = new ArrayList<Pathfinding.EdgeRange<Integer>>();
        for (var block : blocks) {
            ranges.add(new Pathfinding.EdgeRange<>(block, 0, infra.blockInfra().getBlockLength(block)));
        }
        var path = makePath(infra.rawInfra(), infra.blockInfra(), ranges);
        var pathImpl = (PathImpl) path;

        var expectedLength = 1980000 + 1600000; // length of route 1 + 2
        assertEquals(0, pathImpl.getBeginOffset());
        assertEquals(expectedLength, pathImpl.getEndOffset());
        checkBlocks(infra, pathImpl, Set.of("TA0", "TA6"), Direction.INCREASING, expectedLength);
    }

    /** Convert block ranges into a path, with the chunks going backward and partial ranges */
    @Test
    public void testMakePathBackward() {
        var infra = Helpers.getSmallInfra();
        var blocks = getBlocksOnRoutes(infra, List.of(
                "rt.DD0_11->DD0_8",
                "rt.DD0_8->DD0_5"
        ));
        assert blocks.size() == 2;
        var ranges = List.of(
                new Pathfinding.EdgeRange<>(blocks.get(0), 10_000,
                        infra.blockInfra().getBlockLength(blocks.get(0))),
                new Pathfinding.EdgeRange<>(blocks.get(1), 0,
                        infra.blockInfra().getBlockLength(blocks.get(1)) - 10_000)
        );
        var path = makePath(infra.rawInfra(), infra.blockInfra(), ranges);
        var pathImpl = (PathImpl) path;

        var expectedBlockLength = 4612500 + 4612500; // length of route 1 + 2
        assertEquals(10_000, pathImpl.getBeginOffset());
        assertEquals(expectedBlockLength - 10_000, pathImpl.getEndOffset());
        checkBlocks(infra, pathImpl, Set.of("TD0"), Direction.DECREASING, expectedBlockLength);
    }

    /** Tests the waypoint result on a path that has one user-defined waypoint and one operational point */
    @Test
    public void testPathWaypoint() {
        var infra = Helpers.getSmallInfra();
        var blocks = getBlocksOnRoutes(infra, List.of(
                "rt.DD1_8->DD1_11"
        ));
        assert blocks.size() == 1;
        var ranges = List.of(new Pathfinding.EdgeRange<>(blocks.get(0), 5_000,
                infra.blockInfra().getBlockLength(blocks.get(0))));
        var path = makePath(infra.rawInfra(), infra.blockInfra(), ranges);
        var rawResult = new Pathfinding.Result<>(ranges, List.of(
                new Pathfinding.EdgeLocation<>(ranges.get(0).edge(), 10_000)
        ));
        var waypoints = makePathWaypoint(
                path, rawResult, infra.rawInfra(), infra.blockInfra()
        );

        assertEquals(2, waypoints.size());

        assertEquals("TD1", waypoints.get(0).location.trackSection);
        assertEquals(12_510, waypoints.get(0).location.offset, 1e-5);
        assertFalse(waypoints.get(0).suggestion);
        assertNull(waypoints.get(0).id);

        assertEquals("TD1", waypoints.get(1).location.trackSection);
        assertEquals(14_000, waypoints.get(1).location.offset, 1e-5);
        assertTrue(waypoints.get(1).suggestion);
        assertEquals("Mid_East_station", waypoints.get(1).id);
    }

    @Test
    public void testRoutePath() {
        var infra = Helpers.getSmallInfra();
        var blocks = getBlocksOnRoutes(infra, List.of(
                "rt.DA2->DA6_1",
                "rt.DA6_1->DA6_2"
        ));
        var ranges = new ArrayList<Pathfinding.EdgeRange<Integer>>();
        for (var block : blocks) {
            ranges.add(new Pathfinding.EdgeRange<>(block, 0, infra.blockInfra().getBlockLength(block)));
        }
        var routePath = makeRoutePath(infra.blockInfra(), infra.rawInfra(), ranges);

        assertEquals(2, routePath.size());
        System.out.println(routePath);
        assertEquals("rt.DA2->DA6_1", routePath.get(0).route);
        assertEquals(2, routePath.get(0).trackSections.size());
        assertEquals(1820, routePath.get(0).trackSections.get(0).begin);
        assertEquals(2000, routePath.get(0).trackSections.get(0).end);
        assertEquals("TA0", routePath.get(0).trackSections.get(0).trackSectionID);
        assertEquals(EdgeDirection.START_TO_STOP, routePath.get(0).trackSections.get(0).direction);

        assertEquals(0, routePath.get(0).trackSections.get(1).begin);
        assertEquals(1800, routePath.get(0).trackSections.get(1).end);
        assertEquals("TA6", routePath.get(0).trackSections.get(1).trackSectionID);
        assertEquals(EdgeDirection.START_TO_STOP, routePath.get(0).trackSections.get(1).direction);

        assertEquals("rt.DA6_1->DA6_2", routePath.get(1).route);
        assertEquals(1, routePath.get(1).trackSections.size());
        assertEquals(1800, routePath.get(1).trackSections.get(0).begin);
        assertEquals(3400, routePath.get(1).trackSections.get(0).end);
        assertEquals("TA6", routePath.get(1).trackSections.get(0).trackSectionID);
        assertEquals(EdgeDirection.START_TO_STOP, routePath.get(1).trackSections.get(0).direction);
    }

    /** Tests the whole conversion process. This is more of a smoke test, the values have been checked in other tests */
    @Test
    public void testConvert() {
        var infra = Helpers.getSmallInfra();
        var blocks = getBlocksOnRoutes(infra, List.of(
                "rt.DD0_11->DD0_8",
                "rt.DD0_8->DD0_5"
        ));
        assert blocks.size() == 2;
        var ranges = List.of(
                new Pathfinding.EdgeRange<>(blocks.get(0), 10_000,
                        infra.blockInfra().getBlockLength(blocks.get(0))),
                new Pathfinding.EdgeRange<>(blocks.get(1), 0,
                        infra.blockInfra().getBlockLength(blocks.get(1)) - 10_000)
        );
        var rawResult = new Pathfinding.Result<>(ranges, List.of());
        var res = PathfindingResultConverter.convert(infra.blockInfra(), infra.rawInfra(),
                rawResult, new DiagnosticRecorderImpl(false));
        assertNotNull(res);
    }

    private static void checkBlocks(
            FullInfra infra,
            PathImpl path,
            Set<String> allowedTracks,
            Direction direction,
            long length
    ) {
        var totalLength = 0;
        for (Integer dirChunk : toIntList(path.getChunks())) {
            var trackName = infra.rawInfra().getTrackSectionName(infra.rawInfra().getTrackFromChunk(toValue(dirChunk)));
            assertTrue(allowedTracks.contains(trackName));
            assertEquals(direction, toDirection(dirChunk));
            totalLength += infra.rawInfra().getTrackChunkLength(toValue(dirChunk));
        }
        assertEquals(length, totalLength);
    }
}
