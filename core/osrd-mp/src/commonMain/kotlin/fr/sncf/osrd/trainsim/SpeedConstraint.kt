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
}

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

    if (currentState.speed == startSpeedLimit) {
        // The stock is on the curve, so we return the next point on the curve.

        // Snap on the curve
        val startSpeed = startSpeedLimit

        val nextPointIndex =
            curve.firstStrictlyAfter(currentState.position.micrometers) ?: return null
        val endPosition = curve.xs[nextPointIndex].micrometers
        val endSpeed = curve.ys[nextPointIndex].micrometersPerSecond
        val positionDelta = endPosition - currentState.position
        val timeDelta =
            if (endSpeed + startSpeed == 0.micrometersPerSecond) {
                return TrainState(
                    time = currentState.time + context.timeStep.seconds,
                    position = currentState.position,
                    speed = 0.micrometersPerSecond,
                )
            } else {
                (2 * positionDelta) / (endSpeed + startSpeed)
            }
        return currentState
            .accelerate(context)
            .copy(time = currentState.time + timeDelta, position = endPosition, speed = endSpeed)
            .truncate(currentState, currentState.time + context.timeStep.seconds)
    } else if (currentState.speed < startSpeedLimit) {
        // The stock is below the curve

        return currentState.accelerate(context).truncate(currentState, curve)
    } else {
        // The stock is above the curve

        return currentState.brake(context).truncate(currentState, curve)
    }
}
