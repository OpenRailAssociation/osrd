package fr.sncf.osrd.sim

import fr.sncf.osrd.sim.interlocking.api.Train
import fr.sncf.osrd.sim.interlocking.api.ZoneReservation
import fr.sncf.osrd.sim.interlocking.api.ZoneReservationStatus.*
import fr.sncf.osrd.sim.interlocking.api.ZoneState
import fr.sncf.osrd.sim.interlocking.impl.*
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.RawInfraFromRjsBuilder
import fr.sncf.osrd.utils.indexing.MutableArena
import fr.sncf.osrd.utils.indexing.mutableArenaMap
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.meters
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.time.Duration.Companion.milliseconds
import kotlinx.coroutines.*
import kotlinx.coroutines.test.currentTime
import kotlinx.coroutines.test.runTest
import mu.KotlinLogging

private val routingLogger = KotlinLogging.logger("routing")
private val trainLogger = KotlinLogging.logger("train")

class TestReservation {
    @Test
    fun lockOccupyLeave() =
        runTest(CoroutineName("test body")) {
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
            val builder = RawInfraFromRjsBuilder()
            val switch =
                builder.movableElement("A", delay = 42L.milliseconds) {
                    config("a", Pair(TrackNodePortId(0u), TrackNodePortId(1u)))
                    config("b", Pair(TrackNodePortId(0u), TrackNodePortId(2u)))
                }

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

            val testZonePath =
                builder.zonePath(detectorU.increasing, detectorV.increasing, Length(42.meters)) {}

            val infra = builder.build()
            // endregion

            // allocate train IDs
            val trainArena = MutableArena<Train>(2)
            val trainA = trainArena.allocate()

            // instantiate the simulation
            val locationSim = LocationSimImpl(infra)
            val simJob = Job()
            val reservationScope = CoroutineScope(coroutineContext + simJob)
            val reservationSim = reservationSim(infra, locationSim, reservationScope)

            // run the test

            data class ZoneEvent(val time: Long, val state: ZoneState)
            val history: MutableList<ZoneEvent> = mutableListOf()
            val loggingProcess =
                launch(Dispatchers.Unconfined + CoroutineName("logging")) {
                    reservationSim.watchZoneConfig(zoneA).collect {
                        history.add(ZoneEvent(currentTime, it))
                    }
                }

            val routingProcess =
                launch(CoroutineName("routing")) {
                    reservationSim.lockZone(zoneA)
                    routingLogger.info(" pre-reserve")
                    val resHandle = reservationSim.preReserve(zoneA, testZonePath, trainA)
                    reservationSim.unlockZone(zoneA)
                    routingLogger.info("confirm")
                    reservationSim.confirm(zoneA, resHandle)
                    routingLogger.info("await pending release")
                    reservationSim.awaitPendingRelease(zoneA, resHandle)
                    routingLogger.info("delay 10")
                    delay(10)
                    routingLogger.info("release")
                    reservationSim.release(zoneA, resHandle)
                }

            trainLogger.info("delay 10")
            delay(10)
            trainLogger.info("entering zone")
            locationSim.enterZone(zoneA, trainA)
            trainLogger.info("delay 10")
            delay(10)
            trainLogger.info("leaving zone")
            locationSim.leaveZone(zoneA, trainA)
            trainLogger.info("awaiting routing")

            routingProcess.join()

            val reference: MutableList<ZoneEvent> = mutableListOf()
            val arena = mutableArenaMap<ZoneReservation, ZoneReservation>()

            // the reservations start empty
            reference.add(ZoneEvent(0L, zoneState(arena.clone())))

            // pre-reservation at time 0
            val requirements = zoneRequirements(detectorU.increasing, detectorV.increasing, mapOf())
            val reservationId = arena.allocate(zoneReservation(trainA, requirements, PRE_RESERVED))
            reference.add(ZoneEvent(0L, zoneState(arena.clone())))

            // reservation at time 0
            arena[reservationId] = zoneReservation(trainA, requirements, RESERVED)
            reference.add(ZoneEvent(0L, zoneState(arena.clone())))

            // trainA arrives at time 10
            arena[reservationId] = zoneReservation(trainA, requirements, OCCUPIED)
            reference.add(ZoneEvent(10L, zoneState(arena.clone())))

            // trainA leaves at time 20
            arena[reservationId] = zoneReservation(trainA, requirements, PENDING_RELEASE)
            reference.add(ZoneEvent(20L, zoneState(arena.clone())))

            // reservation is released at time 30
            arena.release(reservationId)
            reference.add(ZoneEvent(30L, zoneState(arena.clone())))

            assertEquals(reference, history)

            loggingProcess.cancelAndJoin()
            // the simulation job needs to be marked as complete before joined
            simJob.complete()
            // joining also waits for child jobs to complete
            simJob.join()
        }
}
