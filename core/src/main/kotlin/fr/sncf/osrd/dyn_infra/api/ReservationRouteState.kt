package fr.sncf.osrd.dyn_infra.api

enum class ReservationRouteState {
    /** The route can be requested */
    FREE,
    /** The route is ready to be used */
    RESERVED,
    /** The route is occupied */
    OCCUPIED,
    /** The route cannot be activated because of a conflict */
    CONFLICT,
}