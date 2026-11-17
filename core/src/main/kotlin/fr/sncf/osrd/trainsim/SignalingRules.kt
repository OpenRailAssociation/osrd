package fr.sncf.osrd.trainsim

import fr.sncf.osrd.standalone_sim.PathSignal

class SignalView
constructor(
    private val train: SignaledTrain,
    private val signal: PathSignal,
    nextSignal: PathSignal?,
    private val tailOfTrainAhead: PreciseDistance?,
) {
    val at = signal.pathOffset.toPrecise()

    val next = nextSignal?.pathOffset?.toPrecise()

    val nextOrEnd = next ?: train.path.getLength().distance.toPrecise()

    fun stop(duration: PreciseDuration) = train.stopAt(signal, duration)

    fun hold() = train.holdAt(signal)

    fun limit(from: PreciseDistance, to: PreciseDistance, speed: PreciseSpeed) =
        train.limit(from, to, speed)

    fun behindTrainAhead(margin: PreciseDistance): Constraint? = tailOfTrainAhead?.let {
        HoldAt(it - margin)
    }
}

class AspectRule(
    val before: (SignalView) -> List<Constraint> = { listOf() },
    val after: (SignalView) -> List<Constraint> = { listOf() },
)

/**
 * For 'S', can be read as follows:
 *
 * - `before` crossing the signal, the train must stop for 30s.
 * - `after` crossing the signal, the train must:
 *     - respect a limit of 30km/h from the signal up to the next signal or the end of the path
 *     - stay 30m behind the tail of any train that might be in front of it
 */
val BAL_RULES =
    mapOf(
        "A" to
            AspectRule(
                after = {
                    val next = it.next ?: return@AspectRule listOf()
                    listOf(it.limit(next - 200.0.meters, next, 30.0.kph))
                },
            ),
        "S" to
            AspectRule(
                before = { listOf(it.stop(30.0.seconds)) },
                after = {
                    listOfNotNull(
                        it.limit(it.at, it.nextOrEnd, 30.0.kph),
                        it.behindTrainAhead(30.0.meters),
                    )
                },
            ),
        "C" to AspectRule(before = { listOf(it.hold()) }),
    )
