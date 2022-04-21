package fr.sncf.osrd.sim

import fr.sncf.osrd.infra.api.reservation.ReservationRoute
import fr.sncf.osrd.infra.api.signaling.Signal
import fr.sncf.osrd.infra.api.signaling.SignalState
import fr.sncf.osrd.infra.implementation.signaling.SignalingInfraBuilder
import fr.sncf.osrd.infra.implementation.signaling.modules.bal3.BAL3
import fr.sncf.osrd.dyn_infra.api.ReservationRouteState
import fr.sncf.osrd.railjson.parser.RJSParser
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch


enum class SimpleSignalState(private val rgb: Int, private val isFree: Boolean) : SignalState {
    RED(0xFF0000, false),
    YELLOW(0xFFFF00, false),
    GREEN(0x00FF00, true);

    override fun getRGBColor(): Int {
        return rgb
    }

    override fun isFree(): Boolean {
        return isFree
    }
}

fun signalSelectReservedRoute(infra: DynInfra, routes: Array<ReservationRoute>): Flow<ReservationRoute?> {
    val routeStateFlows = routes.map { route -> infra.getDyn(route).state }
    return combineTransform(routeStateFlows) { routeStates ->
        var reservedRoute: ReservationRoute? = null
        routeStates.forEachIndexed { index, summary ->
            if (summary == ReservationRouteState.Summary.RESERVED)
                reservedRoute = routes[index]
        }
        emit(reservedRoute)
    }.distinctUntilChanged()
}

class DynSimpleSignal(
    val routes: Array<ReservationRoute>,
    private val routeToSignal: Map<ReservationRoute, Signal<SimpleSignalState>>
) : DynSignal<SimpleSignalState> {
    private val _state: MutableStateFlow<SimpleSignalState> = MutableStateFlow(SimpleSignalState.GREEN)
    override val state: StateFlow<SimpleSignalState> = _state.asStateFlow()

    override suspend fun evaluate(infra: DynInfra) {
        signalSelectReservedRoute(infra, routes).collectLatest { route ->
            // if no route is reserved, default to red
            if (route == null) {
                _state.emit(SimpleSignalState.RED)
                return@collectLatest
            }

            // if there is no next signal, emit a yellow
            val nextSignal = routeToSignal[route]
            if (nextSignal == null) {
                _state.emit(SimpleSignalState.YELLOW)
                return@collectLatest
            }

            // otherwise, emit the lower signal state
            val nextDynSignal = infra.getDyn(nextSignal)
            nextDynSignal.state.collect { state ->
                _state.emit(when (state) {
                    SimpleSignalState.RED -> SimpleSignalState.YELLOW
                    SimpleSignalState.YELLOW -> SimpleSignalState.GREEN
                    SimpleSignalState.GREEN -> SimpleSignalState.GREEN
                })
            }
        }
    }
}

fun main(args: Array<String>) {
    val rjsInfra = RJSParser.parseRailJSONFromFile(args[0])
    val infra = SignalingInfraBuilder.fromRJSInfra(rjsInfra, setOf(BAL3()))

    runSimulation(0) {
        val exampleSignal = DynSimpleSignal(arrayOf(), mapOf())
        val infra = DynInfraImpl()

        launch { exampleSignal.evaluate(infra) }
        print("hello world")
    }
}