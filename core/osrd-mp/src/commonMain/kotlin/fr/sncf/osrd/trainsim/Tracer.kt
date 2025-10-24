package fr.sncf.osrd.trainsim

import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.DistanceRangeMapImpl
import okio.Buffer
import okio.BufferedSink
import okio.ByteString.Companion.encodeUtf8

/**
 * Prints traces to a [BufferedSink].
 *
 * # Trace format
 *
 * These types are used throughout this documentation:
 * - `u32`: a 4-byte little-endian integer
 * - `u64`: a 8-byte little-endian integer
 * - `f64`: a `binary64` as defined by IEEE 754-2008, encoded in the double format bit layout in
 *   little-endian
 * - `str`: a UTF-8-encoded string whose length depends on the context.
 * - train states are represented as follows:
 *     - `u64`: time in microseconds
 *     - `u64`: position in micrometers
 *     - `u64`: speed in micrometers per second
 *     - `f64`: a double whose absolute value is the pantograph position between 0 and 1, and its
 *       sign is whether the pantograph is going up (negative) or going down (positive)
 *
 * A trace starts with a 8-byte header composed of two `u32`s:
 * - one for TYP, the trace type
 * - one for LEN, the length of the trace data (excluding the header)
 *
 * Then follows LEN bytes of data. The format of the data depends on the value of TYP.
 *
 * ## CONSTRAINT (TYP 0)
 *
 * This trace adds a constraint to be indexed. All constraints have an index. The first constraint
 * trace creates a constraint with index ZERO, the second constraint trace creates a constraint with
 * index ONE, and so on and so forth.
 *
 * The data is a `str` representing the constraint.
 *
 * ## DECISION (TYP 1)
 *
 * This trace adds a decision taken by a constraint during the current step.
 *
 * The data is a `u32` representing the constraint index, followed by a train state.
 *
 * ## MERGED_STATE (TYP 2)
 *
 * This trace sets the merged state for the current step.
 *
 * The data is a train state.
 *
 * ## TRUNCATED_STATE (TYP 3)
 *
 * This trace sets the truncated state for the current step.
 *
 * The data is a train state.
 *
 * ## STEP_START (TYP 4)
 *
 * This trace adds a new step which begins on a given state.
 *
 * The data is a train state
 *
 * ## GRADIENTS (TYP 5)
 *
 * This trace sets the path gradients. Gradients are formatted as an array of bounds and an array of
 * values. Both arrays have the same size. For an index I, the Ith element of `values` is the
 * gradient between the Ith element of `bounds` and its predecessor (or zero, if I is zero).
 *
 * Bounds are in micrometers, values are in millimeters per meter.
 *
 * The data is a `u32` holding N, the number of bounds and values that follows.
 *
 * What follows is N `u64`s representing the array of bounds in micrometers. Then follows N `f64`s
 * representing the array of values in millimeters per meter.
 *
 * ## RUN_START (TYP 6)
 *
 * Start a separate run. The train states from before this trace are thus disconnected from those
 * that come after.
 *
 * The data is a `str` for the name of the run.
 *
 * ## SPEED_CURVE (TYP 7)
 *
 * This trace adds a speed curve.
 *
 * The data is:
 * - a `u32` holding the constraint index
 * - a `u32` holding N, the number of points on the curve
 * - N `u64`s for the X coordinates in micrometers
 * - N `u64`s for the Y coordinates in micrometers per second
 */
class Tracer(private val sink: BufferedSink) {
    private val knownConstraints: MutableList<Constraint> = mutableListOf()

    fun runStart(name: String) {
        log(TraceType.RUN_START) { it.write(name.encodeUtf8()) }
    }

    fun speedCurve(constraint: Constraint, curve: Curve) {
        val constraintIndex = addConstraint(constraint)

        log(TraceType.SPEED_CURVE) {
            it.writeIntLe(constraintIndex)
            it.writeIntLe(curve.size)

            for (x in curve.xs) {
                it.writeLongLe(x)
            }

            for (y in curve.ys) {
                it.writeLongLe(y)
            }
        }
    }

    fun gradients(g: DistanceRangeMap<Double>) {
        val g = g as DistanceRangeMapImpl<Double>

        log(TraceType.GRADIENTS) {
            it.writeIntLe(g.values.size)

            for (i in 1..<g.bounds.size) {
                it.writeLongLe(g.bounds[i].millimeters * 1000)
            }

            for (value in g.values) {
                it.writeLongLe(value?.toRawBits() ?: 0)
            }
        }
    }

    fun stepStart(state: TrainState) {
        log(TraceType.STEP_START) { it.writeTrainState(state) }
    }

    fun decisions(constraint: Constraint, decisions: Iterable<TrainState>) {
        val constraintIndex = addConstraint(constraint)

        log(TraceType.DECISION) {
            it.writeIntLe(constraintIndex)

            for (decision in decisions) {
                it.writeTrainState(decision)
            }
        }
    }

    fun mergedState(state: TrainState) {
        log(TraceType.MERGED_STATE) { it.writeTrainState(state) }
    }

    fun truncatedState(state: TrainState) {
        log(TraceType.TRUNCATED_STATE) { it.writeTrainState(state) }
    }

    private fun addConstraint(constraint: Constraint): Int {
        val i = knownConstraints.indexOf(constraint)
        if (i >= 0) {
            return i
        }

        val constraintIndex = knownConstraints.size

        log(TraceType.CONSTRAINT) { it.write(constraint.toString().encodeUtf8()) }

        knownConstraints.add(constraint)

        return constraintIndex
    }

    private val buffer = Buffer()

    private fun <R> log(traceType: Int, format: (Buffer) -> R): R {
        val r = format(buffer)

        require(buffer.size <= Int.MAX_VALUE)

        sink.writeIntLe(traceType)
        sink.writeIntLe(buffer.size.toInt())
        sink.writeAll(buffer)

        return r
    }
}

private object TraceType {
    const val CONSTRAINT: Int = 0
    const val DECISION: Int = 1
    const val MERGED_STATE: Int = 2
    const val TRUNCATED_STATE: Int = 3
    const val STEP_START: Int = 4
    const val GRADIENTS: Int = 5
    const val RUN_START: Int = 6
    const val SPEED_CURVE: Int = 7
}

fun Buffer.writeTrainState(state: TrainState) {
    writeLongLe(state.time.microseconds)
    writeLongLe(state.position.micrometers)
    writeLongLe(state.speed.micrometersPerSecond)

    var pantograph = state.pantograph.position
    if (state.pantograph.goingUp) {
        pantograph = -pantograph
    }

    writeLongLe(pantograph.toRawBits())
}
