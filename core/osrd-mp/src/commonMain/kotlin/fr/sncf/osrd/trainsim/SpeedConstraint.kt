package fr.sncf.osrd.trainsim

import fr.sncf.osrd.envelope_sim.EnvelopeSimContext

/**
 * A driving constraint that only constrains the speed of the train.
 *
 * Implementers of this interface only need to implement [speedCurves], and the constraint will
 * limit the speed of the train to below the curve.
 */
interface SpeedConstraint : Constraint {
    /**
     * The speed constraint represented as zero or more curves where X is the position and Y is the
     * speed.
     *
     * It may depend on the [currentState] of the train, for example if the curves evolve over time.
     */
    fun speedCurves(context: EnvelopeSimContext, currentState: TrainState): List<Curve>

    override fun enactDecision(
        context: EnvelopeSimContext,
        currentState: TrainState,
    ): List<TrainState> =
        speedCurves(context, currentState).mapNotNull { curve ->
            enactCurveDecision(context, currentState, curve)
        }

    override fun truncateStep(
        context: EnvelopeSimContext,
        currentState: TrainState,
        mergedState: TrainState,
    ): TrainState =
        speedCurves(context, currentState)
            .asSequence()
            .map { curve ->
                if (
                    curve.lerp(currentState.position.micrometers) ==
                        currentState.speed.micrometersPerSecond
                ) {
                    val i =
                        curve.firstStrictlyAfter(currentState.position.micrometers)
                            ?: return@map mergedState
                    val nextPosition = curve.xs[i].micrometers
                    val nextSpeed = curve.ys[i].micrometersPerSecond
                    if (
                        nextPosition < mergedState.position &&
                            arePointsAligned(
                                currentState.position.micrometers,
                                currentState.speed.micrometersPerSecond,
                                nextPosition.micrometers,
                                nextSpeed.micrometersPerSecond,
                                mergedState.position.micrometers,
                                mergedState.speed.micrometersPerSecond,
                            )
                    ) {
                        return@map curve.advance(
                            currentState,
                            currentState.time + context.timeStep.seconds,
                        )!!
                    } else {
                        return@map mergedState
                    }
                }

                mergedState.truncate(currentState, curve)
            }
            .minByOrNull { state -> state.time } ?: mergedState
}

private fun arePointsAligned(
    x0: Long,
    y0: Long,
    x1: Long,
    y1: Long,
    x2: Long,
    y2: Long,
): Boolean = if (x1 == x0 || x2 == x0) x1 == x2 else (y1 - y0) / (x1 - x0) == (y2 - y0) / (x2 - x0)

fun enactCurveDecision(
    context: EnvelopeSimContext,
    currentState: TrainState,
    curve: Curve,
): TrainState? {
    val accelerateState = currentState.accelerate(context)
    if (
        (currentState.position.micrometers < curve.start) ==
            (accelerateState.position.micrometers < curve.start) &&
            currentState.position.micrometers !in curve.start..<curve.end &&
            accelerateState.position.micrometers !in curve.start..<curve.end
    ) {
        // [currentState;accelerateState] doesn't intersect with the curve
        return null
    }

    var nextState = tryEnactCurveDecision(context, currentState, curve) ?: return null

    if (nextState.time > currentState.time) {
        return nextState
    }

    // The previous call to tryEnactDecision didn't advance time, try with currentState
    // snapped to the curve
    // The lerp call cannot return `null` because of the `!in` check above
    val currentSpeedLimit = curve.lerp(currentState.position.micrometers)!!.micrometersPerSecond
    val snappedState = currentState.copy(speed = currentSpeedLimit)

    // This call cannot return `null` because the previous one didn't return `null` and
    // we're calling with the same position
    nextState = tryEnactCurveDecision(context, snappedState, curve)!!

    if (nextState.time > currentState.time) {
        // currentState must be really close to the speed limit. In this case, return the
        // state computed from snappedState
        return nextState
    }

    // currentState must be really close to the position of the end of the curve. In this
    // case, assume the speed limit has been passed.
    return null
}

private fun tryEnactCurveDecision(
    context: EnvelopeSimContext,
    currentState: TrainState,
    curve: Curve,
): TrainState? {
    val startSpeedLimit =
        curve.lerp(currentState.position.micrometers)?.micrometersPerSecond ?: return null

    return if (currentState.speed == startSpeedLimit) {
        // The stock is on the curve, so we return the next point on the curve.
        curve.advance(currentState, currentState.time + context.timeStep.seconds)
    } else if (currentState.speed < startSpeedLimit) {
        // The stock is below the curve
        currentState.accelerate(context).truncate(currentState, curve)
    } else {
        // The stock is above the curve
        currentState.brake(context).truncate(currentState, curve)
    }
}

/**
 * Assuming this is a speed curve, fast-forward to the next point, up to the given time [to], from
 * the given state [from].
 *
 * [from] must be on the curve, and must be strictly before [to].
 */
private fun Curve.advance(from: TrainState, to: PreciseDuration): TrainState? {
    require(from.time < to)

    val fromSpeed = lerp(from.position.micrometers)?.micrometersPerSecond ?: return null
    require(fromSpeed == from.speed)

    val nextPointIndex = firstStrictlyAfter(from.position.micrometers) ?: return null
    val toPosition = xs[nextPointIndex].micrometers
    val toSpeed = ys[nextPointIndex].micrometersPerSecond

    val positionDelta = toPosition - from.position
    val timeDelta =
        if (toSpeed + from.speed == 0.micrometersPerSecond) {
            return TrainState(
                time = to,
                position = from.position,
                speed = 0.micrometersPerSecond,
            )
        } else {
            (2 * positionDelta) / (toSpeed + from.speed)
        }

    return TrainState(
            time = from.time + timeDelta,
            position = toPosition,
            speed = toSpeed,
        )
        .truncate(from, to)
}
