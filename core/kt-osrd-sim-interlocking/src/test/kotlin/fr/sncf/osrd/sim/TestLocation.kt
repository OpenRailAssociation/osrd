package fr.sncf.osrd.sim

import fr.sncf.osrd.railjson.builder.begin
import fr.sncf.osrd.railjson.builder.buildParseRJSInfra
import fr.sncf.osrd.railjson.builder.end
import fr.sncf.osrd.sim.interlocking.api.Train
import fr.sncf.osrd.sim.interlocking.api.ZoneOccupation
import fr.sncf.osrd.sim.interlocking.impl.locationSim
import fr.sncf.osrd.utils.indexing.MutableArena
import fr.sncf.osrd.utils.indexing.dynIdxArraySetOf
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlinx.coroutines.*

class TestLocation {
    @Test
    fun lockOccupyLeave() = runBlocking {
        // setup test data
        val infra = buildParseRJSInfra {
            defaultTrackNodeDelay = 0.042
            val trackA = trackSection("a", 10.0)
            val trackB = trackSection("b", 10.0)
            val trackC = trackSection("c", 10.0)
            pointSwitch("s", trackA.end, trackB.begin, trackC.begin)
            bufferStop("start_a", trackA.begin)
            bufferStop("end_b", trackB.end)
            bufferStop("end_c", trackC.end)
        }

        val sim = locationSim(infra)
        val trainArena = MutableArena<Train>(2)
        val trainA = trainArena.allocate()
        val trainB = trainArena.allocate()
        val zone = infra.zones[0]

        val occupationHistory: MutableList<ZoneOccupation> = mutableListOf()

        val watchJob =
            launch(Dispatchers.Unconfined) {
                sim.watchZoneOccupation(zone).collect { occupationHistory.add(it) }
            }

        sim.enterZone(zone, trainB)
        sim.enterZone(zone, trainA)
        sim.leaveZone(zone, trainB)
        sim.leaveZone(zone, trainA)

        val reference: List<ZoneOccupation> =
            listOf(
                dynIdxArraySetOf(),
                dynIdxArraySetOf(trainB),
                dynIdxArraySetOf(trainB, trainA),
                dynIdxArraySetOf(trainA),
                dynIdxArraySetOf()
            )

        assertEquals(reference, occupationHistory)
        watchJob.cancelAndJoin()
    }
}
