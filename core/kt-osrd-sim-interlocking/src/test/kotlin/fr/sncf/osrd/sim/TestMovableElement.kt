package fr.sncf.osrd.sim

import fr.sncf.osrd.railjson.builder.begin
import fr.sncf.osrd.railjson.builder.buildParseRJSInfra
import fr.sncf.osrd.railjson.builder.end
import fr.sncf.osrd.sim.interlocking.api.MovableElementInitPolicy
import fr.sncf.osrd.sim.interlocking.api.withLock
import fr.sncf.osrd.sim.interlocking.impl.MovableElementSimImpl
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.currentTime
import kotlinx.coroutines.test.runTest

class TestMovableElements {
    @Test
    fun lockMoveTest() = runTest {
        // setup test data
        val infra = buildParseRJSInfra {
            defaultTrackNodeDelay = 0.042
            val trackA = trackSection("a", 10.0)
            val trackB = trackSection("b", 10.0)
            val trackC = trackSection("c", 10.0)
            pointSwitch("s", trackA.end, trackB.begin, trackC.begin)
        }

        val sim = MovableElementSimImpl(infra, MovableElementInitPolicy.PESSIMISTIC)
        val movableElement = infra.trackNodes[0]
        val configs = infra.getTrackNodeConfigs(movableElement)

        // workerA moves the switch from config 0 to config 1
        val workerA = async {
            sim.withLock(movableElement) { sim.move(movableElement, configs[1]) }
        }

        // workerB attempts to do the same, but no move is needed
        val workerB = async {
            delay(5)
            sim.withLock(movableElement) { sim.move(movableElement, configs[1]) }
        }

        // workerC moves the switch back into config 0
        val workerC = async {
            delay(10)
            sim.withLock(movableElement) { sim.move(movableElement, configs[0]) }
        }

        workerA.await()
        workerB.await()
        workerC.await()
        assertEquals(42L * 2, currentTime)
    }
}
