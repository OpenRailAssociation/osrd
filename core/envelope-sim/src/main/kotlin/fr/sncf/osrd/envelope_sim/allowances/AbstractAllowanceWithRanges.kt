package fr.sncf.osrd.envelope_sim.allowances

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.Envelope.Companion.make
import fr.sncf.osrd.envelope.EnvelopeBuilder
import fr.sncf.osrd.envelope.EnvelopeSpeedCap
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint
import fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraint
import fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType
import fr.sncf.osrd.envelope.part.constraints.PositionConstraint
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue.FixedTime
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeAcceleration
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration
import fr.sncf.osrd.envelope_utils.DoubleBinarySearch
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.utils.SelfTypeHolder
import fr.sncf.osrd.utils.areSpeedsEqual
import fr.sncf.osrd.utils.areTimesEqual
import kotlin.math.abs
import org.slf4j.Logger
import org.slf4j.LoggerFactory

abstract class AbstractAllowanceWithRanges
protected constructor(
    val beginPos: Double,
    val endPos: Double, // potential speed limit under which the train would use too much capacity
    val capacitySpeedLimit: Double,
    var ranges: MutableList<AllowanceRange>,
) : Allowance {
    init {
        for (range in ranges) {
            if (range.beginPos < beginPos || range.endPos > endPos) {
                throw OSRDError(ErrorType.AllowanceRangeOutOfBounds)
            }
        }
    }

    protected abstract fun computeCore(
        base: Envelope,
        context: EnvelopeSimContext,
        speedCap: Double,
    ): Envelope

    protected abstract fun computeInitialHighBound(
        envelopeSection: Envelope,
        rollingStock: PhysicsRollingStock,
    ): Double

    protected abstract fun computeInitialLowBound(envelopeSection: Envelope): Double

    class CapacitySpeedLimit : SelfTypeHolder {
        override val selfType: Class<out SelfTypeHolder>
            get() = CapacitySpeedLimit::class.java
    }

    val distance: Double
        /** Get the total distance the allowance covers */
        get() = endPos - beginPos

    /** Get the total added time of the allowance region */
    fun getAddedTime(base: Envelope): Double {
        var addedTime = 0.0
        for (range in ranges) {
            val baseTime = base.getTimeBetween(range.beginPos, range.endPos)
            val distance = range.endPos - range.beginPos
            addedTime += range.value.getAllowanceTime(baseTime, distance)
        }
        return addedTime
    }

    /** Get the total target time of the allowance region */
    fun getTargetTime(base: Envelope): Double {
        return base.totalTime + getAddedTime(base)
    }

    private fun findStops(base: Envelope): List<Double> {
        return base.filter { it.endSpeed == 0.0 }.map { it.endPos }
    }

    /** Apply the allowance to a given envelope. */
    override fun apply(base: Envelope, context: EnvelopeSimContext): Envelope {
        if (base.beginPos > beginPos || base.endPos < endPos) {
            throw OSRDError(ErrorType.AllowanceOutOfBounds)
        }

        assert(base.continuous)

        // get only the region on which the allowance applies
        val region = make(*base.slice(beginPos, endPos))

        // slice parts that are not modified and run the allowance algorithm on the allowance region
        while (true) {
            try {
                val builder = EnvelopeBuilder()
                builder.addParts(base.slice(Double.NEGATIVE_INFINITY, beginPos))
                val allowanceRegion = computeAllowanceRegion(region, context)
                for (envelope in allowanceRegion) builder.addEnvelope(envelope)
                builder.addParts(base.slice(endPos, Double.POSITIVE_INFINITY))
                val res = builder.build()
                assert(res.continuous) { "Discontinuity on the edges of the allowance region" }
                return res
            } catch (e: OSRDError) {
                if (
                    e.osrdErrorType == ErrorType.AllowanceConvergenceTooMuchTime ||
                        e.osrdErrorType == ErrorType.AllowanceConvergenceNotEnoughTime
                ) {
                    // The ranges are too short and the constraints too important:
                    // we can try to merge ranges together to find a realistic
                    // solution that would follow most of the constraints,
                    // to be returned with a warning
                    var rangeIndex = e.context.getOrDefault("allowance_range_index", 0) as Int
                    if (rangeIndex >= ranges.size - 1) {
                        if (rangeIndex > 0) rangeIndex-- else throw e
                    }
                    mergeRangesAtIndex(base, rangeIndex)
                    // TODO raise warning
                } else {
                    throw e
                }
            }
        }
    }

    /**
     * Merge together the envelope ranges at index `rangeIndex` and `rangeIndex + 1`. The time over
     * the two ranges is kept, but the transition time will not be enforced.
     */
    private fun mergeRangesAtIndex(base: Envelope, rangeIndex: Int) {
        val prevRange = ranges[rangeIndex]
        val nextRange = ranges[rangeIndex + 1]
        val prevRangeTime =
            prevRange.value.getAllowanceTime(
                base.getTimeBetween(prevRange.beginPos, prevRange.endPos),
                prevRange.endPos - prevRange.beginPos,
            )
        val nextRangeTime =
            nextRange.value.getAllowanceTime(
                base.getTimeBetween(nextRange.beginPos, nextRange.endPos),
                nextRange.endPos - nextRange.beginPos,
            )
        val newRange =
            AllowanceRange(
                prevRange.beginPos,
                nextRange.endPos,
                FixedTime(prevRangeTime + nextRangeTime),
            )
        ranges = ArrayList(ranges)
        ranges[rangeIndex] = newRange
        ranges.removeAt(rangeIndex + 1)
    }

    @JvmRecord private data class RangeBaseTime(val range: AllowanceRange, val baseTime: Double)

    /**
     * Apply the allowance to the region affected by the allowance. The region is split in ranges
     * asked by the user and independently computed. Ranges are computed in a specific order : from
     * the lowest to the highest allowance value. Once a range is computed, its beginning and end
     * speeds are memorized and imposed to the left and right side ranges respectively. This process
     * ensures the continuity of the final envelope.
     */
    private fun computeAllowanceRegion(
        envelopeRegion: Envelope,
        context: EnvelopeSimContext,
    ): List<Envelope> {
        // build an array of the imposed speeds between ranges
        // every time a range is computed, the imposed left and right speeds are memorized

        val imposedTransitionSpeeds = DoubleArray(ranges.size + 1)
        imposedTransitionSpeeds[0] = envelopeRegion.beginSpeed
        for (i in 1..<ranges.size) imposedTransitionSpeeds[i] = Double.NaN
        imposedTransitionSpeeds[ranges.size] = envelopeRegion.endSpeed

        // Set the transitions speeds on allowance ranges that don't add any time
        // (the speed at the border of those allowances has to match the base envelope)
        for (i in ranges.indices) {
            val range = ranges[i]
            val addedTime =
                range.value.getAllowanceTime(
                    envelopeRegion.getTimeBetween(range.beginPos, range.endPos),
                    range.endPos - range.beginPos,
                )
            if (areTimesEqual(0.0, addedTime)) {
                imposedTransitionSpeeds[i] = envelopeRegion.interpolateSpeed(range.beginPos)
                imposedTransitionSpeeds[i + 1] = envelopeRegion.interpolateSpeed(range.endPos)
            }
        }

        // build an array of (range, baseTime) in order to sort the array rangeOrder by ascending
        // base time
        val baseTimes =
            ranges.map { range ->
                val baseTime = envelopeRegion.getTimeBetween(range.beginPos, range.endPos)
                RangeBaseTime(range, baseTime)
            }

        // the order in which the ranges should be computed
        // ranges are computed with increasing baseTime values
        val rangeOrder = ranges.indices.sortedBy { baseTimes[it].baseTime }

        val res = arrayOfNulls<Envelope>(ranges.size)

        // compute ranges one by one in the right order
        for (rangeIndex in rangeOrder) {
            try {
                val range = ranges[rangeIndex]
                val envelopeRange = make(*envelopeRegion.slice(range.beginPos, range.endPos))
                val imposedBeginSpeed = imposedTransitionSpeeds[rangeIndex]
                val imposedEndSpeed = imposedTransitionSpeeds[rangeIndex + 1]
                val rangeRatio = envelopeRange.totalTime / envelopeRegion.totalTime
                val tolerance = context.timeStep * rangeRatio
                val allowanceRange =
                    computeAllowanceRange(
                        envelopeRange,
                        context,
                        range.value,
                        imposedBeginSpeed,
                        imposedEndSpeed,
                        tolerance,
                    )
                // memorize the beginning and end speeds
                imposedTransitionSpeeds[rangeIndex] = allowanceRange.beginSpeed
                imposedTransitionSpeeds[rangeIndex + 1] = allowanceRange.endSpeed
                res[rangeIndex] = allowanceRange
            } catch (e: OSRDError) {
                e.context["allowance_range_index"] = rangeIndex
                throw e
            }
        }

        return res.map { it!! }
    }

    /**
     * Apply the allowance to the given range. Split the range into sections, separated by stops,
     * which are independently computed.
     */
    private fun computeAllowanceRange(
        envelopeRange: Envelope,
        context: EnvelopeSimContext,
        value: AllowanceValue,
        imposedRangeBeginSpeed: Double,
        imposedRangeEndSpeed: Double,
        tolerance: Double,
    ): Envelope {
        // compute the added time for all the allowance range
        val baseTime = envelopeRange.totalTime
        val baseDistance = envelopeRange.totalDistance
        val addedTime = value.getAllowanceTime(baseTime, baseDistance)
        // if no time is added, just return the base envelope without performing binary search
        if (areTimesEqual(0.0, addedTime)) {
            return envelopeRange
        }
        assert(addedTime > 0) {
            String.format("Adding negative time from allowance %s (%s seconds)", value, addedTime)
        }

        // compute the slowest running time, given the capacity speed limit,
        // to make sure the user asked for a margin that is actually possible
        val totalTargetTime = baseTime + addedTime
        var slowestRunningTime = Double.POSITIVE_INFINITY
        if (capacitySpeedLimit > 0) {
            val slowestEnvelope =
                EnvelopeSpeedCap.from(
                    envelopeRange,
                    listOf(CapacitySpeedLimit()),
                    capacitySpeedLimit,
                )
            slowestRunningTime = slowestEnvelope.totalTime
        }
        // if the total target time isn't actually reachable, throw error
        if (totalTargetTime > slowestRunningTime)
            throw OSRDError(ErrorType.AllowanceConvergenceTooMuchTime)

        val rangeBeginPos = envelopeRange.beginPos
        val rangeEndPos = envelopeRange.endPos

        // build a list of point between which the computation is divided
        // each division is a section
        val splitPoints = mutableListOf<Double>()
        splitPoints.add(rangeBeginPos)
        splitPoints.addAll(findStops(envelopeRange))
        if (splitPoints[splitPoints.size - 1] != rangeEndPos) splitPoints.add(rangeEndPos)

        val builder = EnvelopeBuilder()
        // apply the allowance on each section of the allowance range
        for (i in 0..<splitPoints.size - 1) {
            val sectionBeginPos = splitPoints[i]
            val sectionEndPos = splitPoints[i + 1]
            val section = make(*envelopeRange.slice(sectionBeginPos, sectionEndPos))
            val sectionTime = section.totalTime
            val sectionDistance = section.totalDistance
            val sectionRatio =
                value.getSectionRatio(sectionTime, baseTime, sectionDistance, baseDistance)
            val targetTime = sectionTime + addedTime * sectionRatio

            // the imposed begin and end speeds only apply to the first and last section of the
            // range respectively
            val imposedBeginSpeed =
                if (sectionBeginPos == rangeBeginPos) imposedRangeBeginSpeed else Double.NaN
            val imposedEndSpeed =
                if (sectionEndPos == rangeEndPos) imposedRangeEndSpeed else Double.NaN

            val distributedTolerance = tolerance * sectionRatio
            val allowanceSection =
                computeAllowanceSection(
                    section,
                    context,
                    targetTime,
                    imposedBeginSpeed,
                    imposedEndSpeed,
                    distributedTolerance,
                )
            assert(abs(allowanceSection!!.totalTime - targetTime) <= context.timeStep)
            builder.addEnvelope(allowanceSection)
        }
        return builder.build()
    }

    /** Iteratively apply the allowance on the given section, until the target time is reached */
    private fun computeAllowanceSection(
        envelopeSection: Envelope,
        context: EnvelopeSimContext,
        targetTime: Double,
        imposedBeginSpeed: Double,
        imposedEndSpeed: Double,
        tolerance: Double,
    ): Envelope? {
        // perform a binary search
        val initialLowBound = computeInitialLowBound(envelopeSection)
        val initialHighBound = computeInitialHighBound(envelopeSection, context.rollingStock)
        if (initialLowBound > initialHighBound) {
            // This can happen when capacity speed limit > max speed. We know in advance no solution
            // can be found.
            throw OSRDError(ErrorType.AllowanceConvergenceTooMuchTime)
        }

        var res: Envelope? = null
        var lastError: OSRDError? = null
        val search =
            DoubleBinarySearch(initialLowBound, initialHighBound, targetTime, tolerance, true)
        var lastTime = 0.0
        var i = 1
        while (i < 30 && !search.complete()) {
            val input = search.input
            try {
                res =
                    computeIteration(
                        envelopeSection,
                        context,
                        input,
                        imposedBeginSpeed,
                        imposedEndSpeed,
                    )
                lastTime = res.totalTime
                search.feedback(lastTime)
            } catch (allowanceError: OSRDError) {
                logger.debug("    couldn't build an envelope ({})", allowanceError.toString())
                lastError = allowanceError
                when (allowanceError.osrdErrorType) {
                    ErrorType
                        .AllowanceConvergenceTooMuchTime // Can't go slow enough to even build a
                    // valid envelope: we need to go faster
                    -> search.feedback(Double.POSITIVE_INFINITY)
                    ErrorType
                        .AllowanceConvergenceNotEnoughTime // Can't go fast enough to even build a
                    // valid envelope: we need to go slower
                    -> search.feedback(0.0)
                    else // Internal error, can't be handled here, rethrown
                    -> throw allowanceError
                }
            }
            i++
        }

        if (!search.complete()) {
            if (res != null && abs(lastTime - targetTime) <= context.timeStep) {
                // We couldn't match the distributed tolerance, but we're still within one timestep.
                // This sometimes happen when the path is very long with many scheduled points. Most
                // of the time the error isn't significant in this context, we can log a warning and
                // move on.
                logger.warn(
                    "Couldn't reach target time for allowance section " +
                        "with distributed tolerance. Using closest result."
                )
                logger.warn(
                    "Closest time = {}, target time = {} +- {}",
                    lastTime,
                    targetTime,
                    tolerance,
                )
                // TODO: raise a warning to be included in the response
            } else {
                logger.error("Couldn't reach target time for allowance section.")
                logger.error(
                    "Closest time = {}, target time = {} +- {}",
                    lastTime,
                    targetTime,
                    tolerance,
                )
                if (lastError != null) {
                    // If we couldn't converge and an error happened, it has more info
                    // than a generic error
                    throw lastError
                } else {
                    throw makeError(search)
                }
            }
        }
        return res
    }

    /** Compute one iteration of the binary search */
    fun computeIteration(base: Envelope, context: EnvelopeSimContext, input: Double): Envelope {
        return computeIteration(base, context, input, Double.NaN, Double.NaN)
    }

    /** Compute one iteration of the binary search, with specified speeds on the edges */
    private fun computeIteration(
        base: Envelope,
        context: EnvelopeSimContext,
        input: Double,
        imposedBeginSpeed: Double,
        imposedEndSpeed: Double,
    ): Envelope {
        // The part of the envelope on which the margin is applied is split in 3:
        // left junction, then core phase, then right junction.
        // The junction parts are needed to transition to keep the total envelope continuous
        // when beginning or end speeds are imposed

        val coreEnvelope = computeCore(base, context, input)

        // 1) compute the potential junction parts (slowdown or speedup)
        val leftPart = computeLeftJunction(base, coreEnvelope, context, imposedBeginSpeed)

        val leftPartEndPos = leftPart?.endPos ?: base.beginPos
        val coreEnvelopeWithLeft = computeEnvelopeWithLeftJunction(base, coreEnvelope, leftPart)

        val rightPart = computeRightJunction(base, coreEnvelopeWithLeft, context, imposedEndSpeed)
        val rightPartBeginPos = rightPart?.beginPos ?: base.endPos

        if (rightPartBeginPos <= leftPartEndPos) {
            // if the junction parts touch or intersect, there is no core phase
            return intersectLeftRightParts(leftPart!!, rightPart!!)
        }

        // 2) stick phases back together
        val builder = EnvelopeBuilder()
        var leftPartEndSpeed = Double.NaN
        var rightPartBeginSpeed = Double.NaN
        if (leftPart != null) {
            builder.addPart(leftPart)
            leftPartEndSpeed = leftPart.endSpeed
            assert(areSpeedsEqual(coreEnvelope.interpolateSpeed(leftPartEndPos), leftPartEndSpeed))
        }
        if (rightPart != null) {
            rightPartBeginSpeed = rightPart.beginSpeed
            assert(
                areSpeedsEqual(
                    coreEnvelope.interpolateSpeed(rightPartBeginPos),
                    rightPartBeginSpeed,
                )
            )
        }

        // We force the left part end speed and right part begin speed, to avoid epsilon differences
        // that would cause errors later on.
        // The previous asserts are here to ensure we don't force speed values that are too
        // different
        builder.addParts(
            coreEnvelope.slice(
                leftPartEndPos,
                leftPartEndSpeed,
                rightPartBeginPos,
                rightPartBeginSpeed,
            )
        )
        if (rightPart != null) builder.addPart(rightPart)
        val result = builder.build()

        // 3) check for continuity of the section
        assert(result.continuous) { "Discontinuity in allowance section" }
        return result
    }

    /**
     * Compute the left junction of the section if a beginning speed is imposed. This junction can
     * be a slow-down or a speed-up phase, depending on the imposed begin speed and the target
     * envelope
     */
    private fun computeLeftJunction(
        envelopeSection: Envelope,
        envelopeTarget: Envelope,
        context: EnvelopeSimContext,
        imposedBeginSpeed: Double,
    ): EnvelopePart? {
        // if there is no imposed begin speed, no junction needs to be computed
        if (java.lang.Double.isNaN(imposedBeginSpeed)) return null

        val constraints = ArrayList<EnvelopePartConstraint>()
        constraints.add(PositionConstraint(envelopeSection.beginPos, envelopeSection.endPos))

        val partBuilder = EnvelopePartBuilder()
        var lastIntersection = -1
        // if the imposed speed is above the target, compute slowdown, else, compute speedup
        if (imposedBeginSpeed > envelopeTarget.beginSpeed) {
            constraints.add(EnvelopeConstraint(envelopeTarget, EnvelopePartConstraintType.FLOOR))
            val constrainedBuilder =
                ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    *constraints.toTypedArray<EnvelopePartConstraint>(),
                )
            EnvelopeDeceleration.decelerate(
                context,
                envelopeSection.beginPos,
                imposedBeginSpeed,
                constrainedBuilder,
                1.0,
            )
            partBuilder.setAttr(EnvelopeProfile.BRAKING)
            lastIntersection = constrainedBuilder.lastIntersection
        } else if (imposedBeginSpeed < envelopeSection.beginSpeed) {
            constraints.add(EnvelopeConstraint(envelopeTarget, EnvelopePartConstraintType.CEILING))
            constraints.add(EnvelopeConstraint(envelopeSection, EnvelopePartConstraintType.CEILING))
            constraints.add(SpeedConstraint(0.0, EnvelopePartConstraintType.FLOOR))
            val constrainedBuilder =
                ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    *constraints.toTypedArray<EnvelopePartConstraint>(),
                )
            EnvelopeAcceleration.accelerate(
                context,
                envelopeSection.beginPos,
                imposedBeginSpeed,
                constrainedBuilder,
                1.0,
            )
            partBuilder.setAttr(EnvelopeProfile.ACCELERATING)
            lastIntersection = constrainedBuilder.lastIntersection
        }
        if (lastIntersection == 0) {
            // The end of the part has been reached without crossing the target envelope
            // The resulting envelope won't be continuous in this case, the allowance is too
            // restrictive
            throw OSRDError(ErrorType.AllowanceConvergenceTooMuchTime)
        }
        if (partBuilder.isEmpty) return null
        return partBuilder.build()
    }

    /**
     * Compute the right junction of the section if an end speed is imposed. This junction can be a
     * speed-up or a slow-down phase, depending on the imposed end speed and the target envelope
     */
    private fun computeRightJunction(
        envelopeSection: Envelope,
        envelopeTarget: Envelope,
        context: EnvelopeSimContext,
        imposedEndSpeed: Double,
    ): EnvelopePart? {
        if (java.lang.Double.isNaN(imposedEndSpeed)) return null

        val constraints = ArrayList<EnvelopePartConstraint>()
        constraints.add(PositionConstraint(envelopeSection.beginPos, envelopeSection.endPos))

        var lastIntersection = -1
        val partBuilder = EnvelopePartBuilder()
        // if the imposed speed is above the target compute speed-up, else, compute slow-down
        if (imposedEndSpeed > envelopeTarget.endSpeed) {
            constraints.add(EnvelopeConstraint(envelopeTarget, EnvelopePartConstraintType.FLOOR))
            val constrainedBuilder =
                ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    *constraints.toTypedArray<EnvelopePartConstraint>(),
                )
            EnvelopeAcceleration.accelerate(
                context,
                envelopeSection.endPos,
                imposedEndSpeed,
                constrainedBuilder,
                -1.0,
            )
            partBuilder.setAttr(EnvelopeProfile.ACCELERATING)
            lastIntersection = constrainedBuilder.lastIntersection
        } else if (imposedEndSpeed < envelopeSection.endSpeed) {
            constraints.add(SpeedConstraint(0.0, EnvelopePartConstraintType.FLOOR))
            constraints.add(EnvelopeConstraint(envelopeTarget, EnvelopePartConstraintType.CEILING))
            val constrainedBuilder =
                ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    *constraints.toTypedArray<EnvelopePartConstraint>(),
                )
            EnvelopeDeceleration.decelerate(
                context,
                envelopeSection.endPos,
                imposedEndSpeed,
                constrainedBuilder,
                -1.0,
            )
            partBuilder.setAttr(EnvelopeProfile.BRAKING)
            lastIntersection = constrainedBuilder.lastIntersection
        }
        if (lastIntersection == 0) {
            // The end of the part has been reached without crossing the target envelope
            // The resulting envelope won't be continuous in this case, the allowance is too
            // restrictive
            throw OSRDError(ErrorType.AllowanceConvergenceTooMuchTime)
        }
        if (partBuilder.isEmpty) return null
        return partBuilder.build()
    }

    /**
     * Transform leftJunction into an envelope that spans from the beginning to the end of
     * envelopeSection, filling the gap with the core envelope
     */
    private fun computeEnvelopeWithLeftJunction(
        envelopeSection: Envelope,
        coreEnvelope: Envelope,
        leftJunction: EnvelopePart?,
    ): Envelope {
        val builder = EnvelopeBuilder()
        if (leftJunction == null) return coreEnvelope
        builder.addPart(leftJunction)
        if (leftJunction.endPos < envelopeSection.endPos)
            builder.addParts(coreEnvelope.slice(leftJunction.endPos, Double.POSITIVE_INFINITY))
        return builder.build()
    }

    /** If the left and right part intersect, build an envelope with the intersection */
    private fun intersectLeftRightParts(
        leftPart: EnvelopePart?,
        rightPart: EnvelopePart?,
    ): Envelope {
        if (rightPart == null || leftPart == null)
            throw OSRDError(ErrorType.AllowanceConvergenceTooMuchTime)
        val slicedLeftPart =
            leftPart.sliceWithSpeeds(
                Double.NEGATIVE_INFINITY,
                Double.NaN,
                rightPart.beginPos,
                rightPart.beginSpeed,
            )
        if (slicedLeftPart == null || slicedLeftPart.endPos != rightPart.beginPos) {
            // The curves don't intersect at all
            // This sometimes happens when one part is very short compared to the time step
            // When it happens we have very little margin to add time, so we throw a `tooMuchTime`
            // error
            throw OSRDError(ErrorType.AllowanceConvergenceTooMuchTime)
        }
        return make(slicedLeftPart, rightPart)
    }

    companion object {
        val logger: Logger = LoggerFactory.getLogger(Allowance::class.java)

        private fun makeError(search: DoubleBinarySearch): RuntimeException {
            if (!search.hasRaisedLowBound())
                throw OSRDError(ErrorType.AllowanceConvergenceTooMuchTime)
            else if (!search.hasLoweredHighBound())
                throw OSRDError(ErrorType.AllowanceConvergenceNotEnoughTime)
            else throw OSRDError(ErrorType.AllowanceConvergenceDiscontinuity)
        }
    }
}
