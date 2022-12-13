package fr.sncf.osrd.sim.interlocking.api

import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.sim_infra.api.*
import kotlinx.coroutines.flow.StateFlow
import kotlin.contracts.InvocationKind
import kotlin.contracts.contract


// region MOVABLE ELEMENTS

/** Defines how movable elements are initialized */
enum class MovableElementInitPolicy {
    OPTIMISTIC,
    PESSIMISTIC,
}

interface MovableElementSim {
    fun watchMovableElement(movable: MovableElementId): StateFlow<MovableElementConfigId?>
    suspend fun move(movable: MovableElementId, config: MovableElementConfigId)
    suspend fun lockMovableElement(movable: MovableElementId)
    suspend fun unlockMovableElement(movable: MovableElementId)
}

suspend inline fun <T> MovableElementSim.withLock(movable: MovableElementId, action: () -> T): T {
    contract {
        callsInPlace(action, InvocationKind.EXACTLY_ONCE)
    }

    lockMovableElement(movable)
    try {
        return action()
    } finally {
        unlockMovableElement(movable)
    }
}

// endregion

sealed interface Train

typealias TrainId = DynIdx<Train>

// region LOCATION

typealias ZoneOccupation = DynIdxSortedSet<Train>

interface LocationSim {
    fun watchZoneOccupation(zone: ZoneId): StateFlow<ZoneOccupation>
    suspend fun enterZone(zone: ZoneId, train: TrainId)
    suspend fun leaveZone(zone: ZoneId, train: TrainId)
}

// endregion

// region RESERVATION

/**
 * The reservation state of a zone.
 * At any given time, multiple actors (trains) can hold reservations for this zone.
 */
interface ZoneState {
    val reservations: ArenaMap<ZoneReservation, ZoneReservation>
}


/** A zone reservation by some actor */
interface ZoneReservation {
    val train: TrainId
    val requirements: ZoneRequirements
    val status: ZoneReservationStatus
}

typealias ZoneReservationId = DynIdx<ZoneReservation>



/** Zone requirements are constraints on what the reservation state of a zone can be */
interface ZoneRequirements {
    val entry: DirDetectorId
    val exit: DirDetectorId
    val movableElements: Map<MovableElementId, MovableElementConfigId>
}

fun ZoneRequirements.compatibleWith(other: ZoneRequirements): Boolean {
    if (entry != other.entry)
        return false
    if (exit != other.exit)
        return false
    // this test may be too restrictive, but that's ok:
    // in the worst case, it restricts configurations that might be otherwise allowed,
    // such as having multiple compatible overlapping routes which actuate different
    // movable elements in the same zone
    return movableElements == other.movableElements
}


enum class ZoneReservationStatus {
    /** In the process of being reserved, but not yet ready */
    PRE_RESERVED,
    /** The train can arrive anytime */
    RESERVED,
    /** The train is inside the zone */
    OCCUPIED,
    /** The zone is pending release */
    PENDING_RELEASE,
}

class ActionLockRequired() : Exception("")

class UnexpectedReservationStatus(
    val expected: ZoneReservationStatus,
    val got: ZoneReservationStatus
) : Exception("")
class IncompatibleZoneRequirements(
    val currentRequirements: ZoneRequirements,
    val newRequirements: ZoneRequirements
) : Exception("")

interface ReservationSim {
    fun watchZoneConfig(zone: ZoneId): StateFlow<ZoneState>
    /** Get the action lock */
    suspend fun lockZone(zone: ZoneId)

    /** Release the action lock */
    suspend fun unlockZone(zone: ZoneId)
    fun preReserve(zone: ZoneId, zonePath: ZonePathId, train: TrainId): ZoneReservationId
    fun confirm(zone: ZoneId, reservation: ZoneReservationId)
    suspend fun awaitPendingRelease(zone: ZoneId, reservation: ZoneReservationId)
    fun release(zone: ZoneId, reservation: ZoneReservationId)
}

suspend inline fun <T> ReservationSim.withLock(zone: ZoneId, action: () -> T): T {
    contract {
        callsInPlace(action, InvocationKind.EXACTLY_ONCE)
    }

    lockZone(zone)
    try {
        return action()
    } finally {
        unlockZone(zone)
    }
}

// endregion

// region ROUTING

interface RouteCallHandle

interface RoutingSim {
    /**
     * Returns when the route is established.
     * When the route is established, a background destruction process starts.
     * This process releases zone reservations at the train stops occupying zones.
     * @return a handle which can be used to wait for the destruction process to complete
     */
    suspend fun call(route: RouteId, train: TrainId): DynIdx<RouteCallHandle>

    /** Waits for a given route to be destroyed */
    suspend fun waitDestroyed(routeHandle: DynIdx<RouteCallHandle>)
}

// endregion

interface Sim : MovableElementSim, LocationSim, ReservationSim, RoutingSim
