package fr.sncf.osrd.sim

import fr.sncf.osrd.sim.api.Train
import fr.sncf.osrd.sim.impl.*
import fr.sncf.osrd.sim_infra.api.ZonePath
import fr.sncf.osrd.sim_infra.api.normal
import fr.sncf.osrd.sim_infra.api.reverse
import fr.sncf.osrd.sim_infra.impl.SimInfraBuilder
import fr.sncf.osrd.utils.indexing.MutableArena
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import kotlinx.coroutines.*
import kotlinx.coroutines.test.currentTime
import kotlinx.coroutines.test.runTest
import mu.KLogger
import mu.KotlinLogging
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.time.Duration.Companion.milliseconds

private val loggerA = KotlinLogging.logger("trainA")
private val loggerB = KotlinLogging.logger("trainB")


class TestRouting {
    @Test
    fun switchConflict() = runTest(CoroutineName("test body")) {
        // All "I" mark the location of detectors, which delimit zones.
        //
        // u      v
        // I---A--I-+
        //           \
        // w       x  \    y       z
        // I---B---I---C---I---D---I
        //
        //  <-- reverse     normal -->

        // region build the test infrastructure
        val builder = SimInfraBuilder()
        // region switches
        val switch = builder.movableElement(delay = 10L.milliseconds) {
            defaultConfig = config("xy")
            config("vy")
        }

        // endregion

        // region zones
        val zoneA = builder.zone(listOf())
        val zoneB = builder.zone(listOf())
        val zoneC = builder.zone(listOf(switch))
        val zoneD = builder.zone(listOf())

        val detectorU = builder.detector()
        builder.setNextZone(detectorU.normal, zoneA)
        val detectorV = builder.detector()
        builder.setNextZone(detectorV.normal, zoneC)
        builder.setNextZone(detectorV.reverse, zoneA)
        val detectorW = builder.detector()
        builder.setNextZone(detectorW.normal, zoneB)
        val detectorX = builder.detector()
        builder.setNextZone(detectorX.normal, zoneC)
        builder.setNextZone(detectorX.reverse, zoneB)
        val detectorY = builder.detector()
        builder.setNextZone(detectorY.normal, zoneD)
        builder.setNextZone(detectorY.reverse, zoneC)
        val detectorZ = builder.detector()
        builder.setNextZone(detectorZ.reverse, zoneD)
        val infra = builder.build()
        // endregion

        // region routes
        // create a route from W to Z, releasing at Y and Z
        val routeWZ = builder.route(
            listOf(
                ZonePath(detectorW.normal, detectorX.normal), // zone B
                ZonePath(detectorX.normal, detectorY.normal, mutableStaticIdxArrayListOf(switch), mutableStaticIdxArrayListOf(StaticIdx(0u))), // zone C
                ZonePath(detectorY.normal, detectorZ.normal), // zone D
            ),
            // release at zone C and D
            intArrayOf(1, 2),
        )

        val routeUZ = builder.route(
            listOf(
                ZonePath(detectorU.normal, detectorV.normal), // zone A
                ZonePath(detectorV.normal, detectorY.normal, mutableStaticIdxArrayListOf(switch), mutableStaticIdxArrayListOf(StaticIdx(1u))), // zone C
                ZonePath(detectorY.normal, detectorZ.normal), // zone D
            ),
            // release at zone D
            intArrayOf(2),
        )
        // endregion
        // endregion

        // allocate train IDs
        val trainArena = MutableArena<Train>(2)
        val trainA = trainArena.allocate()
        val trainB = trainArena.allocate()

        // setup the simulation
        val locationSim = LocationSimImpl(infra)
        val simJob = Job()
        val reservationScope = CoroutineScope(coroutineContext + simJob)
        val movableElementSim = movableElementSim(infra)
        val reservationSim = reservationSim(infra, locationSim, reservationScope)
        val routingSim = routingSim(infra, movableElementSim, reservationSim, reservationScope)

        // create an event log
        data class Event(val time: Long, val event: String)
        val eventLog = mutableListOf<Event>()
        fun KLogger.logEvent(event: String) {
            this.info(event)
            eventLog.add(Event(currentTime, event))
        }

        val trainAJob = launch {
            loggerA.logEvent("called route A")
            val routeHandleA = routingSim.call(routeWZ, trainA)
            loggerA.logEvent("route A call complete")
            locationSim.enterZone(zoneB, trainA)

            delay(50)
            loggerA.logEvent("train A cleared the switch")
            locationSim.enterZone(zoneC, trainA)
            locationSim.leaveZone(zoneB, trainA)
            locationSim.enterZone(zoneD, trainA)
            locationSim.leaveZone(zoneC, trainA)
            delay(50)
            loggerA.logEvent("train A left the infra")
            locationSim.leaveZone(zoneD, trainA)
            routingSim.waitDestroyed(routeHandleA)
            loggerA.logEvent("route A was destroyed")
        }

        val trainBJob = launch {
            delay(10)
            loggerB.logEvent("called route B")
            val routeHandleB = routingSim.call(routeUZ, trainB)
            loggerB.logEvent("route B call complete")
            delay(50)
            locationSim.enterZone(zoneA, trainB)
            locationSim.enterZone(zoneC, trainB)
            locationSim.leaveZone(zoneA, trainB)
            locationSim.enterZone(zoneD, trainB)
            locationSim.leaveZone(zoneC, trainB)
            locationSim.leaveZone(zoneD, trainB)
            routingSim.waitDestroyed(routeHandleB)
            loggerB.logEvent("route B was destroyed")
        }

        trainAJob.join()
        trainBJob.join()

        val expected = listOf(
            Event(0L, "called route A"),
            Event(0L, "route A call complete"), // no need to move the switch
            Event(10L, "called route B"),
            Event(50L, "train A cleared the switch"),
            Event(60L, "route B call complete"),
            Event(100L, "train A left the infra"),
            Event(100L, "route A was destroyed"),
            Event(110L, "route B was destroyed"),
        )
        assertEquals(expected, eventLog)
        simJob.complete()
        simJob.join()
    }
}
