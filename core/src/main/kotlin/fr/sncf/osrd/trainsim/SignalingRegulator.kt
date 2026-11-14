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

// TODO: BAL only for now
private val STOP_ASPECTS = setOf("S", "C")

class SignaledTrain(
    val simulator: TrainSimulator,
    val departure: PreciseDuration = 0.microseconds,
    val path: TrainPath,
    val length: PreciseDistance,
    val baseConstraints: List<Constraint>,
) {
    private val holds = mutableMapOf<PathSignal, HoldAt>()

    internal fun holdAt(signal: PathSignal): Constraint =
        holds.getOrPut(signal) { HoldAt(signal.pathOffset.toPrecise()) }
}

class SignalingRegulator(
    private val fullInfra: FullInfra,
    val trains: List<SignaledTrain>,
) : RecordableRegulator {
    var lastSignalStates: List<Map<LogicalSignalId, SigState>> = trains.map { mapOf() }
        private set

    fun scheduledTrains(): List<ScheduledTrain> = trains.map {
        ScheduledTrain(it.simulator, it.departure)
    }

    override fun regulate() {
        val occupied =
            trains
                .flatMap {
                    occupiedZones(it.path.getZoneRanges(), it.simulator.state.position, it.length)
                }
                .toSet()

        for (train in trains) {
            train.simulator.constraints = train.baseConstraints
        }
        lastSignalStates = trains.map {
            if (it.simulator.isFinished) mapOf() else signalStates(fullInfra, it.path, occupied)
        }
        for ((train, states) in trains.zip(lastSignalStates)) {
            if (train.simulator.isFinished) continue
            val ahead =
                signalsAhead(
                    fullInfra.blockInfra,
                    train.path,
                    train.simulator.state.position,
                    states,
                )
            val stop = ahead.entries.firstOrNull { it.value.getEnum("aspect") in STOP_ASPECTS }
            if (stop != null) {
                train.simulator.constraints = train.baseConstraints + train.holdAt(stop.key)
            }
        }
    }

    private val recordedSignals by lazy {
        trains.map { pathSignals(it.path, fullInfra.blockInfra) }
    }

    override fun recordHeader(train: Int) = buildJsonObject {
        val rawInfra = fullInfra.rawInfra
        put("length", trains[train].length.meters)
        put("geo", pathGeometryJson(rawInfra, trains[train].path))
        putJsonArray("signals") {
            for (signal in recordedSignals[train]) {
                addJsonObject {
                    put("name", rawInfra.getLogicalSignalName(signal.signal))
                    put("offset", signal.pathOffset.toPrecise().meters)
                }
            }
        }
    }

    override fun recordTick(train: Int) = buildJsonObject {
        putJsonArray("aspects") {
            for (signal in recordedSignals[train]) {
                add(lastSignalStates[train][signal.signal]?.getEnum("aspect"))
            }
        }
    }
}
