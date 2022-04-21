package fr.sncf.osrd.dyn_infra.api

import fr.sncf.osrd.infra.api.reservation.ReservationRoute
import fr.sncf.osrd.infra.api.reservation.DetectionSection

/** Encodes the state of the detection section  */
interface DetectionSectionState {
    enum class Summary {
        FREE, RESERVED, OCCUPIED
    }

    fun summarize(): Summary

    /** Returns the route for which this detection state is currently reserved for  */
    val route: ReservationRoute?

    /** Returns the train which currently occupies the detection section  */
    val occupyingTrain: ReservationTrain?

    /** Returns the immutable detection section object  */
    val detectionSection: DetectionSection?
}