package fr.sncf.osrd.sim

import fr.sncf.osrd.railjson.builder.begin
import fr.sncf.osrd.railjson.builder.buildParseRJSInfra
import fr.sncf.osrd.railjson.builder.end
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.sim.interlocking.api.MovableElementInitPolicy
import fr.sncf.osrd.sim.interlocking.api.Train
import fr.sncf.osrd.sim.interlocking.impl.LocationSimImpl
import fr.sncf.osrd.sim.interlocking.impl.movableElementSim
import fr.sncf.osrd.sim.interlocking.impl.reservationSim
import fr.sncf.osrd.sim.interlocking.impl.routingSim
import fr.sncf.osrd.sim_infra.api.decreasing
import fr.sncf.osrd.sim_infra.api.increasing
import fr.sncf.osrd.utils.indexing.MutableArena
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlinx.coroutines.*
import kotlinx.coroutines.test.currentTime
import kotlinx.coroutines.test.runTest
import mu.KLogger
import mu.KotlinLogging

private val loggerA = KotlinLogging.logger("trainA")
private val loggerB = KotlinLogging.logger("trainB")

class TestRouting {
    @Test
    fun switchConflict() =
        runTest(CoroutineName("test body")) {
            // All "I" mark the location of detectors, which delimit zones.
            //
            // u      v
            // I---A--I-+
            //           \
            // w       x  \    y       z
            // I---B---I---C---I---D---I
            //             S
            //  <-- reverse     normal -->
            val infra = buildParseRJSInfra {
                val lowerLeftTrack = trackSection("lower_left", 15.0)
                val upperLeftTrack = trackSection("upper_left", 15.0)
                val rightTrack = trackSection("right", 15.0)
                val switch =
                    pointSwitch(
                        "S",
                        rightTrack.begin,
                        lowerLeftTrack.begin,
                        upperLeftTrack.begin,
                        0.01
                    )
                val detU = bufferStop("U", upperLeftTrack.end)
                detector("V", upperLeftTrack.at(5.0))
                val detW = bufferStop("W", lowerLeftTrack.end)
                detector("X", lowerLeftTrack.at(5.0))
                val detY = detector("Y", rightTrack.at(5.0))
                val detZ = bufferStop("Z", rightTrack.end)

                route("U-Z", detU, EdgeDirection.STOP_TO_START, detZ) {
                    addTrackNodeDirection(switch, "A_B2")
                }
                route("W-Z", detW, EdgeDirection.STOP_TO_START, detZ) {
                    addReleaseDetector(detY)
                    addTrackNodeDirection(switch, "A_B1")
                }
            }
            val detectors = infra.detectors.associateBy { infra.getDetectorName(it) }
            val detU = detectors["U"]!!
            val detW = detectors["W"]!!
            val detX = detectors["X"]!!
            val detY = detectors["Y"]!!
            val zoneA = infra.getNextZone(detU.decreasing)!!
            val zoneB = infra.getNextZone(detW.decreasing)!!
            val zoneC = infra.getNextZone(detX.decreasing)!!
            val zoneD = infra.getNextZone(detY.increasing)!!

            val routeWZ = infra.getRouteFromName("W-Z")
            val routeUZ = infra.getRouteFromName("U-Z")

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

            val expected =
                listOf(
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
