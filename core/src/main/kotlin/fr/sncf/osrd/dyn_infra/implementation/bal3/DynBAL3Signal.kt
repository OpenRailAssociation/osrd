package fr.sncf.osrd.dyn_infra.implementation.bal3

import fr.sncf.osrd.dyn_infra.api.DynInfra
import fr.sncf.osrd.dyn_infra.api.ReservationRouteState
import fr.sncf.osrd.infra.api.signaling.Signal
import fr.sncf.osrd.dyn_infra.implementation.DynSignal
import fr.sncf.osrd.infra.implementation.signaling.modules.bal3.BAL3
import kotlinx.coroutines.flow.*

fun signalSelectReservedRoute(infra: DynInfra, routes: Array<BAL3.BAL3Route>): Flow<BAL3.BAL3Route?> {
    val routeStateFlows = routes.map { route -> infra.watch(route.infraRoute) }
    return combineTransform(routeStateFlows) { routeStates ->
        var reservedRoute: BAL3.BAL3Route? = null
        routeStates.forEachIndexed { index, summary ->
            if (summary == ReservationRouteState.RESERVED)
                reservedRoute = routes[index]
        }
        emit(reservedRoute)
    }.distinctUntilChanged()
}

class DynBAL3Signal(
    val routes: Array<BAL3.BAL3Route>,
    private val routeToSignal: Map<BAL3.BAL3Route, Signal<BAL3SignalState>>
) : DynSignal<BAL3SignalState> {
    private val _state: MutableStateFlow<BAL3SignalState> = MutableStateFlow(BAL3SignalState.GREEN)
    override val state: StateFlow<BAL3SignalState> = _state.asStateFlow()

    override suspend fun run(infra: DynInfra) {
        signalSelectReservedRoute(infra, routes).collectLatest { route ->
            // if no route is reserved, default to red
            if (route == null) {
                _state.emit(BAL3SignalState.RED)
                return@collectLatest
            }

            // if there is no next signal, emit a yellow
            val nextSignal = routeToSignal[route]
            if (nextSignal == null) {
                _state.emit(BAL3SignalState.YELLOW)
                return@collectLatest
            }

            // otherwise, emit the lower signal state
            infra.watch(nextSignal).collect { state ->
                _state.emit(when (state) {
                    BAL3SignalState.RED -> BAL3SignalState.YELLOW
                    BAL3SignalState.YELLOW -> BAL3SignalState.GREEN
                    BAL3SignalState.GREEN -> BAL3SignalState.GREEN
                })
            }
        }
    }
}
