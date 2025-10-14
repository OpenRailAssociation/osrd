package fr.sncf.osrd.utils

import fr.sncf.osrd.path.implementations.ChunkPath
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.test.assertEquals
import org.junit.jupiter.api.Test

class OffsetConversionTests {
    val infra = DummyInfra()
    val blocks = (0..<10).map { infra.addBlock(it.toString(), (it + 1).toString(), 1_000.meters) }
    val zones = blocks.flatMap { infra.getBlockZonePaths(it) }
    val chunks = zones.flatMap { infra.getZonePathChunks(it) }

    @Test
    fun testStartOnFirstZone() {
        val chunkPath = ChunkPath(chunks, Offset(500.meters), Offset(950.meters))
        val res = trainPathZonePathOffset(infra, zones, chunkPath)
        assertEquals(Offset(500.meters), res)
    }

    @Test
    fun testStartOnSecondZone() {
        val partialChunks = chunks.subList(1, chunks.size)
        val chunkPath = ChunkPath(partialChunks, Offset(500.meters), Offset(850.meters))
        val res = trainPathZonePathOffset(infra, zones, chunkPath)
        assertEquals(Offset(1_500.meters), res)
    }

    @Test
    fun testStartEndOfZone() {
        val chunkPath = ChunkPath(chunks, Offset(1_000.meters), Offset(10_000.meters))
        val res = trainPathZonePathOffset(infra, zones, chunkPath)
        assertEquals(Offset(1_000.meters), res)
    }

    @Test
    fun testStartNotIncludedInZonePath() {
        val partialZones = zones.subList(1, zones.size)
        val chunkPath = ChunkPath(chunks, Offset(1_000.meters), Offset(850.meters))
        val res = trainPathZonePathOffset(infra, partialZones, chunkPath)
        assertEquals(Offset(0.meters), res)
    }

    @Test
    fun testSingleZone() {
        // Not necessarily a use case we want to support (0 length path),
        // but it's nice to know that it works
        val partialZones = zones.subList(0, 1)
        val partialChunks = chunks.subList(0, 1)
        val chunkPath = ChunkPath(partialChunks, Offset(1_000.meters), Offset(1_000.meters))
        val res = trainPathZonePathOffset(infra, partialZones, chunkPath)
        assertEquals(Offset(1_000.meters), res)
    }
}
