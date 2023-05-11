package fr.sncf.osrd.sim

import fr.sncf.osrd.sim.interlocking.api.Train
import fr.sncf.osrd.sim.interlocking.api.MovableElementInitPolicy
import fr.sncf.osrd.sim.interlocking.impl.LocationSimImpl
import fr.sncf.osrd.sim.interlocking.impl.movableElementSim
import fr.sncf.osrd.sim.interlocking.impl.reservationSim
import fr.sncf.osrd.sim.interlocking.impl.routingSim
import fr.sncf.osrd.sim_infra.api.TrackNodePortId
import fr.sncf.osrd.sim_infra.api.increasing
import fr.sncf.osrd.sim_infra.api.decreasing
import fr.sncf.osrd.sim_infra.impl.RawInfraBuilder
import fr.sncf.osrd.utils.indexing.MutableArena
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.units.meters
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
        val builder = RawInfraBuilder()
        // region switches
        val switch = builder.movableElement(delay = 10L.milliseconds) {
            config("xy", Pair(TrackNodePortId(0u), TrackNodePortId(1u)))
            config("vy", Pair(TrackNodePortId(0u), TrackNodePortId(2u)))
        }

        // endregion

        // region zones
        val zoneA = builder.zone(listOf())
        val zoneB = builder.zone(listOf())
        val zoneC = builder.zone(listOf(switch))
        val zoneD = builder.zone(listOf())

        val detectorU = builder.detector("U")
        builder.setNextZone(detectorU.increasing, zoneA)
        val detectorV = builder.detector("V")
        builder.setNextZone(detectorV.increasing, zoneC)
        builder.setNextZone(detectorV.decreasing, zoneA)
        val detectorW = builder.detector("W")
        builder.setNextZone(detectorW.increasing, zoneB)
        val detectorX = builder.detector("X")
        builder.setNextZone(detectorX.increasing, zoneC)
        builder.setNextZone(detectorX.decreasing, zoneB)
        val detectorY = builder.detector("Y")
        builder.setNextZone(detectorY.increasing, zoneD)
        builder.setNextZone(detectorY.decreasing, zoneC)
        val detectorZ = builder.detector("Z")
        builder.setNextZone(detectorZ.decreasing, zoneD)
        // endregion

        // region routes
        // create a route from W to Z, releasing at Y and Z
        val routeWZ = builder.route("W-Z") {
            zonePath(builder.zonePath(detectorW.increasing, detectorX.increasing, 10.meters)) // zone B
            zonePath(builder.zonePath(detectorX.increasing, detectorY.increasing, 10.meters) {
                movableElement(switch, StaticIdx(0u), 5.meters)
            }) // zone C
            zonePath(builder.zonePath(detectorY.increasing, detectorZ.increasing, 10.meters)) // zone D
            // release at zone C and D
            releaseZone(1)
            releaseZone(2)
        }

        val routeUZ = builder.route("U-Z") {
            zonePath(builder.zonePath(detectorU.increasing, detectorV.increasing, 10.meters)) // zone A
            zonePath(builder.zonePath(detectorV.increasing, detectorY.increasing, 10.meters) {
                movableElement(switch, StaticIdx(1u), 5.meters)
            }) // zone C
            zonePath(builder.zonePath(detectorY.increasing, detectorZ.increasing, 10.meters)) // zone D
            // release at zone D
            releaseZone(2)
        }
        // endregion
        val infra = builder.build()
        // endregion


        // allocate train IDs
        val trainArena = MutableArena<Train>(2)
        val trainA = trainArena.allocate()
        val trainB = trainArena.allocate()

        // setup the simulation
        val locationSim = LocationSimImpl(infra)
        val simJob = Job()
        val reservationScope = CoroutineScope(coroutineContext + simJob)
        val movableElementSim = movableElementSim(infra, MovableElementInitPolicy.OPTIMISTIC)
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
