package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.pathfinding.makeChunkPath
import fr.sncf.osrd.api.pathfinding.makePathProps
import fr.sncf.osrd.api.pathfinding.makePathWaypoint
import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.graph.Pathfinding.EdgeLocation
import fr.sncf.osrd.graph.Pathfinding.EdgeRange
import fr.sncf.osrd.graph.PathfindingEdgeRangeId
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.sim_infra.impl.ChunkPath
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test

class PathfindingResultConverterTest {
    /** Convert block ranges into a path, with the chunks going forward */
    @Test
    fun testMakePathForward() {
        val infra = Helpers.smallInfra
        val blocks = Helpers.getBlocksOnRoutes(infra, listOf("rt.DA2->DA5", "rt.DA5->DC5"))
        val ranges = ArrayList<PathfindingEdgeRangeId<Block>>()
        for (block in blocks) {
            ranges.add(EdgeRange(block, Offset(0.meters), infra.blockInfra.getBlockLength(block)))
        }
        val chunkPath = makeChunkPath(infra.rawInfra, infra.blockInfra, ranges)
        val expectedLength = 10000.meters + 1000.meters // length of route 1 + 2
        Assertions.assertEquals(Offset<Path>(0.meters), chunkPath.beginOffset)
        Assertions.assertEquals(expectedLength, chunkPath.endOffset.distance)
        checkBlocks(
            infra,
            chunkPath,
            setOf("TA0", "TA6", "TC1"),
            Direction.INCREASING,
            expectedLength
        )
    }

    /** Convert block ranges into a path, with the chunks going backward and partial ranges */
    @Test
    fun testMakePathBackward() {
        val infra = Helpers.smallInfra
        val blocks = Helpers.getBlocksOnRoutes(infra, listOf("rt.DD0->DC0", "rt.DC0->DA3"))
        assert(blocks.size == 4)
        val ranges =
            listOf(
                EdgeRange(blocks[0], Offset(10.meters), infra.blockInfra.getBlockLength(blocks[0])),
                EdgeRange(blocks[1], Offset(0.meters), infra.blockInfra.getBlockLength(blocks[1])),
                EdgeRange(blocks[2], Offset(0.meters), infra.blockInfra.getBlockLength(blocks[2])),
                EdgeRange(
                    blocks[3],
                    Offset(0.meters),
                    infra.blockInfra.getBlockLength(blocks[3]) - 10.meters
                )
            )
        val chunkPath = makeChunkPath(infra.rawInfra, infra.blockInfra, ranges)
        val expectedBlockLength = 1050.meters + 10000.meters // length of route 1 + 2
        Assertions.assertEquals(Offset<Path>(10.meters), chunkPath.beginOffset)
        Assertions.assertEquals((expectedBlockLength - 10.meters), chunkPath.endOffset.distance)
        checkBlocks(
            infra,
            chunkPath,
            setOf("TC0", "TD0", "TA6"),
            Direction.DECREASING,
            expectedBlockLength
        )
    }

    /**
     * Tests the waypoint result on a path that has one user-defined waypoint and one operational
     * point
     */
    @Test
    fun testPathWaypoint() {
        val infra = Helpers.smallInfra
        val blocks = Helpers.getBlocksOnRoutes(infra, listOf("rt.buffer_stop.0->DA2"))
        assert(blocks.size == 1)
        val ranges = listOf(EdgeRange(blocks[0], Offset<Block>(600.meters), Offset(800.meters)))
        val path = makePathProps(infra.rawInfra, infra.blockInfra, ranges)
        val rawResult =
            Pathfinding.Result(ranges, listOf(EdgeLocation(ranges[0].edge, Offset(650.meters))))
        val waypoints = makePathWaypoint(path, rawResult, infra.rawInfra, infra.blockInfra)
        Assertions.assertEquals(2, waypoints.size)
        Assertions.assertEquals("TA0", waypoints[0].location.trackSection)
        Assertions.assertEquals(650.0, waypoints[0].location.offset, 1e-5)
        Assertions.assertFalse(waypoints[0].suggestion)
        Assertions.assertNull(waypoints[0].id)
        Assertions.assertEquals("TA0", waypoints[1].location.trackSection)
        Assertions.assertEquals(700.0, waypoints[1].location.offset, 1e-5)
        Assertions.assertTrue(waypoints[1].suggestion)
        Assertions.assertEquals("West_station", waypoints[1].id)
    }

    /**
     * Test the waypoints on a path that starts and ends on the same block. This can happen in rare
     * cases with loops and can easily cause errors. The path isn't continuous in this test, we only
     * check the waypoint offsets
     */
    @Test
    fun testPathWaypointOnLoop() {
        val infra = Helpers.smallInfra
        val blocks = Helpers.getBlocksOnRoutes(infra, listOf("rt.buffer_stop.0->DA2"))
        assert(blocks.size == 1)
        val blockId = blocks[0]
        val blockLength = infra.blockInfra.getBlockLength(blockId)
        val ranges =
            listOf(
                EdgeRange(blockId, Offset(600.meters), blockLength),
                EdgeRange(blockId, Offset(0.meters), Offset(200.meters))
            )
        val rawResult =
            Pathfinding.Result(
                ranges,
                listOf(
                    EdgeLocation(ranges[0].edge, Offset(600.meters)),
                    EdgeLocation(ranges[0].edge, Offset(200.meters))
                )
            )
        val path = makePathProps(infra.rawInfra, infra.blockInfra, ranges)
        val waypoints = makePathWaypoint(path, rawResult, infra.rawInfra, infra.blockInfra)
        val userDefinedWaypoints = waypoints.stream().filter { wp -> !wp.suggestion }.toList()
        Assertions.assertEquals(2, userDefinedWaypoints.size)
        Assertions.assertEquals("TA0", userDefinedWaypoints[0].location.trackSection)
        Assertions.assertEquals(600.0, userDefinedWaypoints[0].location.offset, 1e-5)
        Assertions.assertEquals("TA0", userDefinedWaypoints[1].location.trackSection)
        Assertions.assertEquals(200.0, userDefinedWaypoints[1].location.offset, 1e-5)
    }

    companion object {
        private fun checkBlocks(
            infra: FullInfra,
            path: ChunkPath,
            allowedTracks: Set<String>,
            direction: Direction,
            length: Distance
        ) {
            var totalLength = 0.meters
            for (dirChunk in path.chunks) {
                val trackName =
                    infra.rawInfra.getTrackSectionName(
                        infra.rawInfra.getTrackFromChunk(dirChunk.value)
                    )
                Assertions.assertTrue(allowedTracks.contains(trackName))
                Assertions.assertEquals(direction, dirChunk.direction)
                totalLength += infra.rawInfra.getTrackChunkLength(dirChunk.value).distance
            }
            Assertions.assertEquals(length, totalLength)
        }
    }
}
