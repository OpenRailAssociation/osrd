package fr.sncf.osrd.trainsim

import fr.sncf.osrd.envelope_sim.EnvelopeSimContext

/**
 * Runs a single train forward, one integration step at a time.
 *
 * The simulation can be stopped and resumed, should be useful to run trains together (if I am not
 * going in the wrong way).
 */
class TrainSimulator(
    val context: EnvelopeSimContext,
    val constraints: List<Constraint>,
    initialState: TrainState = TrainState.zero,
    private val tracer: Tracer? = null,
    /** How many steps the train may take in one call before it is considered stuck. */
    private val maxSteps: Int = DEFAULT_MAX_STEPS,
) {
    var state: TrainState = initialState
        private set

    private val mutableStates = mutableListOf(initialState)

    /**
     * Every state the train went through, starting with the state it was created with.
     *
     * Kept to debug. This gives kind of an history that we can look at and use to assert in the
     * tests. Most likely temporary
     */
    val states: List<TrainState>
        get() = mutableStates

    private val pathLength = context.path.length.meters

    val isFinished: Boolean
        get() = state.position >= pathLength

    fun advance() {
        val nextState = step(context, constraints, state, tracer)

        for (constraint in constraints) {
            if (constraint is Updatable) {
                constraint.update(state, nextState)
            }
        }

        state = nextState
        mutableStates.add(nextState)
    }

    /**
     * Advance the train until it reaches [time], or the end of its path.
     *
     * Careful: The train overshoots by at most one [step]
     */
    fun advanceUntil(time: PreciseDuration) = advanceWhile("reach $time") { state.time < time }

    /**
     * Advance the train until it reaches [position], or the end of its path.
     *
     * Careful: The train overshoots by at most one [step]
     */
    fun advanceUntilPosition(position: PreciseDistance) =
        advanceWhile("reach $position") { state.position < position }

    fun runToEnd() = advanceWhile("reach the end of its path") { true }

    /** Advance the train while [condition] holds and it hasn't reached the end of its path. */
    private inline fun advanceWhile(goal: String, condition: () -> Boolean) {
        var steps = 0
        while (!isFinished && condition()) {
            check(steps < maxSteps) { "train took more than $maxSteps steps to $goal: $state" }
            steps++
            advance()
        }
    }

    companion object {
        const val DEFAULT_MAX_STEPS: Int = 20_000
    }
}
