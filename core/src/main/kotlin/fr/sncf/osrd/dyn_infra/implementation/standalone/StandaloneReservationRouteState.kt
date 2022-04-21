package fr.sncf.osrd.dyn_infra.implementation.standalone

import fr.sncf.osrd.infra.api.reservation.ReservationRoute
import fr.sncf.osrd.dyn_infra.api.ReservationTrain
import fr.sncf.osrd.dyn_infra.api.ReservationRouteState

class StandaloneReservationRouteState(
    private val summary: ReservationRouteState.Summary,
    override val train: ReservationTrain?,
    override val route: ReservationRoute?
) : ReservationRouteState {

    /** Constructor  */
    init {
        assert(summary == ReservationRouteState.Summary.FREE == (train == null)) { "reservation train must be null if and only if section is free" }
    }

    override fun summarize(): ReservationRouteState.Summary? {
        return summary
    }
}