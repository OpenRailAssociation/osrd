package fr.sncf.osrd.trainsim

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.sim_infra.api.LogicalSignalId
import fr.sncf.osrd.sim_infra.api.SigState
import fr.sncf.osrd.sim_infra.api.getLogicalSignalName
import fr.sncf.osrd.standalone_sim.PathSignal
import fr.sncf.osrd.standalone_sim.pathSignals
import kotlinx.serialization.json.add
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray

class SignaledTrain(
    val simulator: TrainSimulator,
    val departure: PreciseDuration = 0.microseconds,
    val path: TrainPath,
    val length: PreciseDistance,
    val baseConstraints: List<Constraint>,
) {
    private val stops = mutableMapOf<PathSignal, Stop>()
    private val holds = mutableMapOf<PathSignal, HoldAt>()
    private val limits = mutableMapOf<SpeedLimitedZone, SpeedLimitedZone>()

    var lastHead: PreciseDistance? = null

    var crossed: Pair<PathSignal, String?>? = null

    fun stopAt(signal: PathSignal, duration: PreciseDuration): Stop =
        stops.getOrPut(signal) { Stop(signal.pathOffset.toPrecise(), duration) }

    fun holdAt(signal: PathSignal): HoldAt =
        holds.getOrPut(signal) { HoldAt(signal.pathOffset.toPrecise()) }

    fun limit(
        from: PreciseDistance,
        to: PreciseDistance,
        speed: PreciseSpeed,
    ): SpeedLimitedZone {
        val zone = SpeedLimitedZone(from, to, speed)
        return limits.getOrPut(zone) { zone }
    }

    fun stopsInProgress() = stops.values.filter { it.position == simulator.state.position }
}

class SignalingRegulator(
    private val fullInfra: FullInfra,
    val trains: List<SignaledTrain>,
    private val rules: Map<String, AspectRule> = BAL_RULES,
) : RecordableRegulator {
    var lastSignalStates: List<Map<LogicalSignalId, SigState>> = trains.map { mapOf() }
        private set

    private val signals = trains.map { pathSignals(it.path, fullInfra.blockInfra) }

    fun scheduledTrains(): List<ScheduledTrain> = trains.map {
        ScheduledTrain(it.simulator, it.departure)
    }

    override fun regulate() {
        for ((i, train) in trains.withIndex()) updateCrossed(train, signals[i], lastSignalStates[i])

        val occupied =
            trains
                .flatMap {
                    occupiedZones(it.path.getZoneRanges(), it.simulator.state.position, it.length)
                }
                .toSet()
        lastSignalStates = trains.map {
            if (it.simulator.isFinished) mapOf() else signalStates(fullInfra, it.path, occupied)
        }
        for ((i, train) in trains.withIndex()) {
            train.simulator.constraints =
                if (train.simulator.isFinished) train.baseConstraints
                else train.baseConstraints + signalConstraints(i)
        }
    }

    private fun updateCrossed(
        train: SignaledTrain,
        signals: List<PathSignal>,
        seen: Map<LogicalSignalId, SigState>,
    ) {
        val head = train.simulator.state.position
        val lastHead = train.lastHead
        train.lastHead = head
        if (lastHead == null) return
        val crossed = signals.lastOrNull { it.pathOffset.toPrecise() in lastHead..<head } ?: return
        train.crossed = crossed to seen[crossed.signal]?.getEnum("aspect")
    }

    private fun signalConstraints(index: Int): List<Constraint> {
        val train = trains[index]
        val tail = tailOfTrainAhead(train)
        val after =
            train.crossed?.let { (signal, aspect) ->
                aspect?.let { rules[it] }?.after?.invoke(view(index, signal, tail))
            }
        val before =
            signalsAhead(
                    fullInfra.blockInfra,
                    train.path,
                    train.simulator.state.position,
                    lastSignalStates[index],
                )
                .flatMap { (signal, state) ->
                    rules[state.getEnum("aspect")]?.before?.invoke(view(index, signal, tail))
                        ?: listOf()
                }
        return (after.orEmpty() + before + train.stopsInProgress()).distinct()
    }

    private fun view(
        index: Int,
        signal: PathSignal,
        tailOfTrainAhead: PreciseDistance?,
    ): SignalView {
        val trainSignals = signals[index]
        val next = trainSignals.getOrNull(trainSignals.indexOf(signal) + 1)
        return SignalView(trains[index], signal, next, tailOfTrainAhead)
    }

    private fun tailOfTrainAhead(train: SignaledTrain): PreciseDistance? {
        val head = train.simulator.state.position
        // TODO: this logic is not sound if trains do not share the exact same path
        return trains
            .filter { it !== train && it.path === train.path && it.simulator.state.position > head }
            .minOfOrNull { it.simulator.state.position - it.length }
    }

    override fun recordHeader(train: Int) = buildJsonObject {
        val rawInfra = fullInfra.rawInfra
        put("length", trains[train].length.meters)
        put("geo", pathGeometryJson(rawInfra, trains[train].path))
        putJsonArray("signals") {
            for (signal in signals[train]) {
                addJsonObject {
                    put("name", rawInfra.getLogicalSignalName(signal.signal))
                    put("offset", signal.pathOffset.toPrecise().meters)
                }
            }
        }
    }

    override fun recordTick(train: Int) = buildJsonObject {
        putJsonArray("aspects") {
            for (signal in signals[train]) {
                add(lastSignalStates[train][signal.signal]?.getEnum("aspect"))
            }
        }
    }
}
