package fr.sncf.osrd.sim

import fr.sncf.osrd.dyn_infra.api.ReservationRouteState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

class DynReservationRoute {
    private val _state = MutableStateFlow(ReservationRouteState.Summary.FREE);
    val state = _state.asStateFlow()

    suspend fun changeState(newState: ReservationRouteState.Summary) {
        _state.emit(newState)
    }
}