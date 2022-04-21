package fr.sncf.osrd.dyn_infra.implementation.standalone

import fr.sncf.osrd.infra.api.reservation.ReservationRoute
import fr.sncf.osrd.dyn_infra.api.ReservationTrain
import fr.sncf.osrd.infra.api.reservation.DetectionSection
import fr.sncf.osrd.dyn_infra.api.DetectionSectionState

class StandaloneDetectionSectionState(
    private val summary: DetectionSectionState.Summary,
    override val route: ReservationRoute?,
    override val occupyingTrain: ReservationTrain?,
    override val detectionSection: DetectionSection?
) : DetectionSectionState {

    /** Constructor  */
    init {
        assert(summary == DetectionSectionState.Summary.FREE == (occupyingTrain == null)) { "occupying train must be null if and only if section is free" }
        assert(summary == DetectionSectionState.Summary.FREE == (route == null)) { "route must be null if and only if section is free" }
    }

    override fun summarize(): DetectionSectionState.Summary {
        return summary
    }
}