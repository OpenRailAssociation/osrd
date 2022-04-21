package fr.sncf.osrd.dyn_infra.api

import fr.sncf.osrd.infra.api.reservation.ReservationRoute

interface ReservationRouteState {
    enum class Summary {
        /** The route can be requested  */
        FREE,

        /** The route is in the process of becoming available  */
        REQUESTED,

        /** The route is ready to be used  */
        RESERVED,

        /** The route is occupied  */
        OCCUPIED,

        /** The route cannot be activated because of a conflict  */
        CONFLICT
    }

    /** Returns a summary of the state of the route  */
    fun summarize(): Summary?

    /** Returns the train associated with the route  */
    val train: ReservationTrain?

    /** Returns the immutable route object  */
    val route: ReservationRoute?
}