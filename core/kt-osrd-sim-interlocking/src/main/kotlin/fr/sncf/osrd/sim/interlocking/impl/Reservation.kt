package fr.sncf.osrd.sim.interlocking.impl

import fr.sncf.osrd.sim.interlocking.api.*
import fr.sncf.osrd.sim.interlocking.api.ZoneReservationStatus.*
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.indexing.*
import kotlinx.coroutines.CoroutineName
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.reporting.exceptions.ErrorType

import kotlinx.coroutines.sync.Mutex
import mu.KotlinLogging


private val logger = KotlinLogging.logger {}


/**
 * The reservation state of a zone.
 * At any given time, multiple actors (trains) can hold reservations for this zone.
 */
internal data class ZoneStateImpl(override val reservations: ArenaMap<ZoneReservation, ZoneReservation>) : ZoneState

fun ZoneState.requirements(): ZoneRequirements? {
    if (reservations.isEmpty())
        return null

    val iterator = reservations.iterator()
    val first = reservations[iterator.next()]

    val entry = first.requirements.entry
    val exit = first.requirements.exit
    val movableElements = HashMap(first.requirements.movableElements)

    while (iterator.hasNext()) {
        val cur = reservations[iterator.next()]
        movableElements.putAll(cur.requirements.movableElements)
    }
    return ZoneRequirementsImpl(entry, exit, movableElements)
}


fun zoneState(reservations: ArenaMap<ZoneReservation, ZoneReservation>): ZoneState {
    return ZoneStateImpl(reservations)
}

fun ReservationInfra.getRequirements(zonePath: ZonePathId): ZoneRequirements {
    val entry = getZonePathEntry(zonePath)
    val exit = getZonePathExit(zonePath)
    val movableElements = getZonePathMovableElements(zonePath)
    val movableElementsConfigs = getZonePathMovableElementsConfigs(zonePath)
    val movableElementRequirements = HashMap<TrackNodeId, TrackNodeConfigId>(movableElements.size)
    for (i in 0 until movableElements.size)
        movableElementRequirements[movableElements[i]] = movableElementsConfigs[i]
    return ZoneRequirementsImpl(
        entry,
        exit,
        movableElementRequirements,
    )
}

/** A zone reservation by some actor */
internal data class ZoneReservationImpl(
    override val train: TrainId,
    override val requirements: ZoneRequirements,
    override val status: ZoneReservationStatus,
) : ZoneReservation

fun zoneReservation(train: TrainId, requirements: ZoneRequirements, status: ZoneReservationStatus): ZoneReservation {
    return ZoneReservationImpl(train, requirements, status)
}

/** Zone requirements are constraints on what the reservation state of a zone can be */
internal data class ZoneRequirementsImpl(
    override val entry: DirDetectorId,
    override val exit: DirDetectorId,
    override val movableElements: Map<TrackNodeId, TrackNodeConfigId>,
) : ZoneRequirements

fun zoneRequirements(
    entry: DirDetectorId,
    exit: DirDetectorId,
    movableElements: Map<TrackNodeId, TrackNodeConfigId>
): ZoneRequirements {
    return ZoneRequirementsImpl(entry, exit, movableElements)
}

fun reservationSim(
    infra: ReservationInfra,
    location: LocationSim,
    scope: CoroutineScope,
): ReservationSim {
    return ReservationSimImpl(infra, location, scope)
}

internal class ReservationSimImpl(
    private val infra: ReservationInfra,
    private val location: LocationSim,
    private val scope: CoroutineScope,
) : ReservationSim {
    private val states = infra.zones.map { MutableStateFlow(zoneState(mutableArenaMap())) }
    private val locks = infra.zones.map { Mutex() }

    override fun watchZoneConfig(zone: ZoneId): StateFlow<ZoneState> {
        return states[zone.index]
    }

    override suspend fun lockZone(zone: ZoneId) {
        locks[zone.index].lock()
    }

    override suspend fun unlockZone(zone: ZoneId) {
        locks[zone.index].unlock()
    }

    /**
     * This job starts when the reservation is confirmed,
     * and makes the reservation go occupied, then pending release.
     */
    private fun startReservationStatusUpdater(zone: ZoneId, reservation: ZoneReservationId, train: TrainId) {
        scope.launch(Dispatchers.Unconfined + CoroutineName("status updater")) {
            // wait for the train to enter the zone
            logger.debug {"waiting for train $train to occupy zone $zone" }
            location.watchZoneOccupation(zone).filter { it.contains(train) }.first()
            logger.debug {"updating reservation status of zone $zone to OCCUPIED" }
            updateReservation(zone, reservation) { prevReservation ->
                if (prevReservation.status != RESERVED)
                    throw OSRDError.newUnexpectedReservationStatusError("train entered a zone")
                ZoneReservationImpl(prevReservation.train, prevReservation.requirements, OCCUPIED)
            }

            // wait for the train to leave the zone
            logger.debug {"waiting for train $train to leave zone $zone" }
            location.watchZoneOccupation(zone).filter { !it.contains(train) }.first()
            logger.debug { "updating the reservation status of zone $zone to PENDING_RELEASE" }
            updateReservation(zone, reservation) { prevReservation ->
                if (prevReservation.status != OCCUPIED)
                    throw OSRDError.newUnexpectedReservationStatusError("train left a zone")
                ZoneReservationImpl(prevReservation.train, prevReservation.requirements, PENDING_RELEASE)
            }
        }
    }

    private fun updateReservation(zone: ZoneId, reservation: ZoneReservationId, updater: (ZoneReservation) -> ZoneReservation) {
        states[zone.index].update { prevState ->
            zoneState(prevState.reservations.update(reservation, updater))
        }
    }

    override fun preReserve(zone: ZoneId, zonePath: ZonePathId, train: TrainId): ZoneReservationId {
        if (!locks[zone.index].isLocked)
            throw OSRDError(ErrorType.ActionLockRequired)

        var reservationIndex: ZoneReservationId? = null
        states[zone.index].update { prevState ->
            val curRequirements = prevState.requirements()
            val newRequirements = infra.getRequirements(zonePath)
            if (curRequirements != null && !curRequirements.compatibleWith(newRequirements))
                throw OSRDError.newIncompatibleZoneRequirementsError(curRequirements, newRequirements)

            val newReservation = zoneReservation(train, newRequirements, PRE_RESERVED)
            ZoneStateImpl(prevState.reservations.update {
                reservationIndex = it.allocate(newReservation)
            })
        }
        return reservationIndex!!
    }

    override fun confirm(zone: ZoneId, reservation: ZoneReservationId) {
        updateReservation(zone, reservation) { prevReservation ->
            if (prevReservation.status != PRE_RESERVED)
                throw OSRDError.newUnexpectedReservationStatusError(PRE_RESERVED, prevReservation.status)
            startReservationStatusUpdater(zone, reservation, prevReservation.train)
            ZoneReservationImpl(prevReservation.train, prevReservation.requirements, RESERVED)
        }
    }

    override suspend fun awaitPendingRelease(zone: ZoneId, reservation: ZoneReservationId) {
        watchZoneConfig(zone)
            .filter { it.reservations[reservation].status == PENDING_RELEASE }
            .first()
    }

    override fun release(zone: ZoneId, reservation: ZoneReservationId) {
        states[zone.index].update { prevState ->
            ZoneStateImpl(prevState.reservations.update { arena ->
                val reservationData = arena[reservation]
                if (reservationData.status != PENDING_RELEASE)
                    throw OSRDError.newUnexpectedReservationStatusError(PENDING_RELEASE, reservationData.status)
                arena.release(reservation)
            })
        }
    }
}
