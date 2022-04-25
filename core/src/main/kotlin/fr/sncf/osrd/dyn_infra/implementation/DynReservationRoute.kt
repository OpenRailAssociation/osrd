package fr.sncf.osrd.dyn_infra.implementation

import fr.sncf.osrd.dyn_infra.api.ReservationRouteState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex

/**
 * The dynamic reservation route interacts with:
 *  - detection sections, which send state updates
 *  -
 * */
class DynReservationRoute {
    private val _state = MutableStateFlow(ReservationRouteState.FREE);
    private val _mutex = Mutex()
    val state = _state.asStateFlow()

    suspend fun changeState(newState: ReservationRouteState) {
        _state.emit(newState)
    }

    suspend fun reserve() {
        // wait for a reservation
        // wait for sections to be occupied and freed
        // loop back
        TODO("Not yet implemented")
    }
}

@JvmInline
value class Index<CollectionT>(private val value: ULong)
