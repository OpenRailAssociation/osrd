package fr.sncf.osrd.sim

import fr.sncf.osrd.sim.interlocking.impl.MovableElementSimImpl
import fr.sncf.osrd.sim.interlocking.api.withLock
import fr.sncf.osrd.sim_infra.impl.simInfra
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.currentTime
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.time.Duration.Companion.milliseconds

class TestMovableElements {
    @Test
    fun lockMoveTest() = runTest {
        // setup test data
        val infra = simInfra {
            movableElement(delay = 42L.milliseconds) {
                defaultConfig = config("a")
                config("b")
            }
        }

        val sim = MovableElementSimImpl(infra)
        val movableElement = infra.movableElements[0]
        val configs = infra.getMovableElementConfigs(movableElement)

        // workerA moves the switch from config 0 to config 1
        val workerA = async {
            sim.withLock(movableElement) {
                sim.move(movableElement, configs[1])
            }
        }

        // workerB attempts to do the same, but no move is needed
        val workerB = async {
            delay(5)
            sim.withLock(movableElement) {
                sim.move(movableElement, configs[1])
            }
        }

        // workerC moves the switch back into config 0
        val workerC = async {
            delay(10)
            sim.withLock(movableElement) {
                sim.move(movableElement, configs[0])
            }
        }

        workerA.await()
        workerB.await()
        workerC.await()
        assertEquals(42L * 2, currentTime)
    }
}
