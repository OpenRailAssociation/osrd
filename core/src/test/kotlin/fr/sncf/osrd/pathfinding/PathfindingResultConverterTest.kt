package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.pathfinding.makePathItemPositions
import fr.sncf.osrd.path.implementations.ChunkPath
import fr.sncf.osrd.path.interfaces.BlockPath
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.makeChunkPath
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class PathfindingResultConverterTest {
    /** Convert block ranges into a path, with the chunks going forward */
    @Test
    fun testMakePathForward() {
        val infra = Helpers.smallInfra
        val blocks = Helpers.getBlocksOnRoutes(infra, listOf("rt.DA2->DA5", "rt.DA5->DC5"))
        val ranges = ArrayList<PathfindingEdgeRangeId<Block>>()
        for (block in blocks) {
            ranges.add(Pathfinding.EdgeRange(block, Offset(0.meters), infra.blockInfra.getBlockLength(block)))
        }
        val chunkPath = makeChunkPath(infra.rawInfra, infra.blockInfra, ranges)
        val expectedLength = 10000.meters + 1000.meters // length of route 1 + 2
        assertEquals(Offset<BlockPath>(0.meters), chunkPath.beginOffset)
        assertEquals(expectedLength, chunkPath.endOffset.distance)
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
                Pathfinding.EdgeRange(blocks[0], Offset(10.meters), infra.blockInfra.getBlockLength(blocks[0])),
                Pathfinding.EdgeRange(blocks[1], Offset(0.meters), infra.blockInfra.getBlockLength(blocks[1])),
                Pathfinding.EdgeRange(blocks[2], Offset(0.meters), infra.blockInfra.getBlockLength(blocks[2])),
                Pathfinding.EdgeRange(
                    blocks[3],
                    Offset(0.meters),
                    infra.blockInfra.getBlockLength(blocks[3]) - 10.meters
                )
            )
        val chunkPath = makeChunkPath(infra.rawInfra, infra.blockInfra, ranges)
        val expectedBlockLength = 1050.meters + 10000.meters // length of route 1 + 2
        assertEquals(Offset<BlockPath>(10.meters), chunkPath.beginOffset)
        assertEquals((expectedBlockLength - 10.meters), chunkPath.endOffset.distance)
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
        val ranges = listOf(Pathfinding.EdgeRange(blocks[0], Offset<Block>(600.meters), Offset(800.meters)))
        val path =
            Pathfinding.Result(ranges, listOf(Pathfinding.EdgeLocation(ranges[0].edge, Offset(650.meters))))
        val pathItemPositions = makePathItemPositions(path)
        assertEquals(2, pathItemPositions.size)
        assertEquals(650.0, pathItemPositions[0].distance.meters, 1e-5)
        assertEquals(700.0, pathItemPositions[1].distance.meters, 1e-5)
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
            listOf(Pathfinding.EdgeRange(blockId, Offset(600.meters), blockLength),
                Pathfinding.EdgeRange(blockId, Offset(0.meters), Offset(200.meters))
            )
        val path =
            Pathfinding.Result(
                ranges,
                listOf(
                    Pathfinding.EdgeLocation(ranges[0].edge, Offset(600.meters)),
                    Pathfinding.EdgeLocation(ranges[0].edge, Offset(200.meters))
                )
            )
        val waypoints = makePathItemPositions(path)
        assertEquals(2, waypoints.size)
        assertEquals(600.0, waypoints[0].distance.meters, 1e-5)
        assertEquals(200.0, waypoints[1].distance.meters, 1e-5)
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
                assertTrue(allowedTracks.contains(trackName))
                assertEquals(direction, dirChunk.direction)
                totalLength += infra.rawInfra.getTrackChunkLength(dirChunk.value).distance
            }
            assertEquals(length, totalLength)
        }
    }
}
