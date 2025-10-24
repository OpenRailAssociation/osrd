package fr.sncf.osrd.envelope_sim.etcs

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.minEnvelopes
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint
import fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType
import fr.sncf.osrd.envelope.part.constraints.PositionConstraint
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator
import fr.sncf.osrd.envelope_sim.etcs.BrakingType.*
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration
import java.util.*
import kotlin.math.max
import kotlin.math.min
import org.slf4j.Logger
import org.slf4j.LoggerFactory

/**
 * Formulas are found in `SUBSET-026-3v400.pdf` from the file at
 * https://www.era.europa.eu/system/files/2023-09/index004_-_SUBSET-026_v400.zip
 */
enum class BrakingType {
    CONSTANT, // Constant deceleration
    EBD, // Emergency Brake Deceleration
    EBI, // Emergency Brake Intervention
    SBD, // Service Brake Deceleration
    SBI_1, // Service Brake Intervention 1 - SBI curve computed from SBD
    SBI_2, // Service Brake Intervention 2 - SBI curve computed from EBD
    GUI, // Guidance
    PRE_PS, // Permitted Speed before applying minimum with guidance
    PS, // Permitted Speed
    IND, // Indication
}

val etcsBrakingCurvesLogger: Logger = LoggerFactory.getLogger("EtcsBrakingCurves")

/** Compute LoA braking curves: compute EBD-based curves for LoA. */
fun computeBrakingCurvesAtLOA(
    limitOfAuthority: LimitOfAuthority,
    context: EnvelopeSimContext,
    maxSpeedEnvelope: Envelope,
    beginPos: Double,
): BrakingCurves {
    val targetPosition = limitOfAuthority.offset.meters
    assert(targetPosition > 0.0)
    val targetSpeed = limitOfAuthority.speed
    assert(targetSpeed > 0.0)
    val ebdBrakingCurves =
        computeEbdBrakingCurves(context, targetPosition, targetSpeed, maxSpeedEnvelope)
    return EnumMap(
        ebdBrakingCurves.mapValues {
            keepBrakingCurveUnderOverlay(it.value, maxSpeedEnvelope, beginPos)
        }
    )
}

/**
 * Compute EoA braking curves: compute SBD-based curves for EoA and EBD-based curves for SvL.
 * Compute the minimum between EoA and SvL GUI, PS and IND.
 */
fun computeBrakingCurvesAtEOA(
    endOfAuthority: EndOfAuthority,
    context: EnvelopeSimContext,
    maxSpeedEnvelope: Envelope,
    beginPos: Double,
): BrakingCurves {
    val targetPosition = endOfAuthority.offsetEOA.meters
    assert(targetPosition > 0.0)
    val targetSpeed = 0.0
    val eoaBrakingCurves = computeSbdBrakingCurves(context, targetPosition, maxSpeedEnvelope)
    if (endOfAuthority.usedCurveType == PS) eoaBrakingCurves[IND] = null
    val svlBrakingCurves: BrakingCurves =
        if (endOfAuthority.offsetSVL == null) EnumMap(BrakingType::class.java)
        else
            computeEbdBrakingCurves(
                context,
                endOfAuthority.offsetSVL.meters,
                targetSpeed,
                maxSpeedEnvelope,
            )
    val brakingCurves: BrakingCurves =
        EnumMap<BrakingType, BrakingCurve?>(BrakingType::class.java).apply {
            putAll(svlBrakingCurves.plus(eoaBrakingCurves))
        }
    // If there are SvL braking curves, compute the minimum curves between the common curves PS and
    // IND. GUI should be the EoA GUI's curve, which is already the case here.
    if (svlBrakingCurves.isNotEmpty()) {
        // Compute PS only if EoA PS curve is not null.
        if (brakingCurves[PS] != null)
            brakingCurves[PS] =
                computeMinETCSBrakingCurves(eoaBrakingCurves[PS], svlBrakingCurves[PS])
        // Compute IND only if EoA IND curve is not null.
        if (brakingCurves[IND] != null)
            brakingCurves[IND] =
                computeMinETCSBrakingCurves(eoaBrakingCurves[IND], svlBrakingCurves[IND])
    }
    return EnumMap(
        brakingCurves.mapValues {
            keepBrakingCurveUnderOverlay(it.value, maxSpeedEnvelope, beginPos)
        }
    )
}

/**
 * Compute SBD-based braking curve set. The resulting curves stop at their respective intersections
 * with maxSpeedEnvelope.
 */
private fun computeSbdBrakingCurves(
    context: EnvelopeSimContext,
    targetPosition: Double,
    maxSpeedEnvelope: Envelope,
): BrakingCurves {
    val targetSpeed = 0.0
    val maxSpeed = maxSpeedEnvelope.maxSpeed
    val overhead =
        Envelope.make(
            EnvelopePart.generateTimes(
                listOf(EnvelopeProfile.CONSTANT_SPEED),
                doubleArrayOf(0.0, targetPosition),
                doubleArrayOf(maxSpeed, maxSpeed),
            )
        )
    val sbdCurve = computeBrakingCurve(context, overhead, targetPosition, targetSpeed, SBD)
    assert(sbdCurve.brakingCurve.beginPos >= 0 && sbdCurve.brakingCurve.endPos == targetPosition)
    assert(sbdCurve.brakingCurve.endSpeed == targetSpeed)

    val guiCurve = computeBrakingCurve(context, overhead, targetPosition, targetSpeed, GUI)
    assert(guiCurve.brakingCurve.beginPos >= 0.0 && guiCurve.brakingCurve.endPos == targetPosition)
    assert((guiCurve.brakingCurve.beginSpeed == maxSpeed || guiCurve.brakingCurve.beginPos == 0.0))
    assert(guiCurve.brakingCurve.endSpeed == targetSpeed)

    val sbdBrakingCurves = computeBrakingCurvesFromRefs(context, sbdCurve, guiCurve)
    val fullIndicationCurve = sbdBrakingCurves[IND]!!
    assert(fullIndicationCurve.brakingCurve.endPos == targetPosition)
    assert(fullIndicationCurve.brakingCurve.endSpeed == targetSpeed)
    sbdBrakingCurves[sbdCurve.brakingType] = sbdCurve
    sbdBrakingCurves[guiCurve.brakingType] = guiCurve
    return sbdBrakingCurves
}

/** Compute EBD-based braking curves. */
private fun computeEbdBrakingCurves(
    context: EnvelopeSimContext,
    targetPosition: Double,
    targetSpeed: Double,
    maxSpeedEnvelope: Envelope,
): BrakingCurves {
    val maxSpeed = maxSpeedEnvelope.maxSpeed
    // Add maxBecDeltaSpeed to EBD curve overhead so it reaches a sufficiently high speed to
    // guarantee that, after the speed translation, the corresponding EBI curve does intersect
    // with envelope max speed.
    val maxBecDeltaSpeed = maxBecDeltaSpeed()
    val maxSpeedEbd = maxSpeed + maxBecDeltaSpeed
    val overhead =
        Envelope.make(
            EnvelopePart.generateTimes(
                listOf(EnvelopeProfile.CONSTANT_SPEED),
                doubleArrayOf(0.0, max(context.path.length, targetPosition)),
                doubleArrayOf(maxSpeedEbd, maxSpeedEbd),
            )
        )

    val ebdCurve = computeBrakingCurve(context, overhead, targetPosition, targetSpeed, EBD)
    assert(ebdCurve.brakingCurve.beginPos >= 0.0 && ebdCurve.brakingCurve.endPos >= targetPosition)
    assert(
        (ebdCurve.brakingCurve.beginSpeed == maxSpeedEbd || ebdCurve.brakingCurve.beginPos == 0.0)
    )

    val guiCurve = computeBrakingCurve(context, overhead, targetPosition, targetSpeed, GUI)
    assert(guiCurve.brakingCurve.beginPos >= 0.0 && guiCurve.brakingCurve.endPos == targetPosition)
    assert(
        (guiCurve.brakingCurve.beginSpeed == maxSpeedEbd || guiCurve.brakingCurve.beginPos == 0.0)
    )

    val ebiCurve = computeEbiBrakingCurveFromEbd(context, ebdCurve, targetSpeed)
    assert(ebiCurve.brakingCurve.endSpeed == targetSpeed)

    val ebdBrakingCurves = computeBrakingCurvesFromRefs(context, ebiCurve, guiCurve)
    assert(ebdBrakingCurves[IND]!!.brakingCurve.endSpeed == targetSpeed)
    ebdBrakingCurves[ebdCurve.brakingType] = ebdCurve
    ebdBrakingCurves[guiCurve.brakingType] = guiCurve
    ebdBrakingCurves[ebiCurve.brakingType] = ebiCurve
    // Add release speed for SvL or maintain speed until LoA
    val maintainSpeed = if (targetSpeed == 0.0) NATIONAL_RELEASE_SPEED else targetSpeed
    ebdBrakingCurves[PS] = maintainSpeedUntil(ebdBrakingCurves[PS]!!, maintainSpeed, targetPosition)
    ebdBrakingCurves[IND] =
        maintainSpeedUntil(ebdBrakingCurves[IND]!!, maintainSpeed, targetPosition)
    return ebdBrakingCurves
}

/**
 * Once ETCS braking curve reaches target speed, maintain it until target position.
 * - SvL: maintain release speed for PS and IND curves.
 * - LoA: maintain target speed for PS and IND curves.
 */
private fun maintainSpeedUntil(
    etcsBrakingCurve: BrakingCurve,
    maintainSpeed: Double,
    targetPosition: Double,
): BrakingCurve {
    val brakingCurve = etcsBrakingCurve.brakingCurve
    assert(brakingCurve.beginPos < targetPosition && brakingCurve.endSpeed <= maintainSpeed)
    val brakingCurveWithMaintain = mutableListOf<EnvelopePart>()
    for (currentPart in brakingCurve.stream()) {
        if (currentPart.endSpeed > maintainSpeed) {
            brakingCurveWithMaintain.add(currentPart)
        } else {
            val intersection = currentPart.interpolatePosition(maintainSpeed)
            brakingCurveWithMaintain.add(
                currentPart.sliceWithSpeeds(
                    currentPart.beginPos,
                    currentPart.beginSpeed,
                    intersection,
                    maintainSpeed,
                )!!
            )
            brakingCurveWithMaintain.add(
                EnvelopePart.generateTimes(
                    listOf(EnvelopeProfile.CONSTANT_SPEED),
                    doubleArrayOf(intersection, targetPosition),
                    doubleArrayOf(maintainSpeed, maintainSpeed),
                )
            )
            break
        }
    }
    return BrakingCurve(
        etcsBrakingCurve.brakingType,
        Envelope.make(*brakingCurveWithMaintain.toTypedArray()),
    )
}

/** Compute braking curve: used to compute EBD, SBD or GUI. */
private fun computeBrakingCurve(
    context: EnvelopeSimContext,
    envelope: Envelope,
    targetPosition: Double,
    targetSpeed: Double,
    brakingType: BrakingType,
): BrakingCurve {
    if (!listOf(EBD, SBD, GUI).contains(brakingType))
        throw IllegalArgumentException(
            "Expected EBD, SBD or GUI braking curve type, found: $brakingType"
        )

    // If the stopPosition is after the end of the path, the input is invalid except if it is an
    // SVL, i.e. the target speed is 0 and the curve to compute is not an SBD.
    if ((targetPosition > context.path.length && (targetSpeed != 0.0 || brakingType == SBD)))
        throw RuntimeException(
            String.format(
                "Trying to compute ETCS braking curve from out of bounds ERTMS end/limit of authority: %s",
                targetPosition,
            )
        )
    val partBuilder = EnvelopePartBuilder()
    partBuilder.setAttr(EnvelopeProfile.BRAKING)
    val overlayBuilder =
        ConstrainedEnvelopePartBuilder(
            partBuilder,
            PositionConstraint(0.0, targetPosition),
            SpeedConstraint(targetSpeed, EnvelopePartConstraintType.FLOOR),
            EnvelopeConstraint(envelope, EnvelopePartConstraintType.CEILING),
        )
    if (brakingType == EBD && targetSpeed != 0.0) {
        // When target is an LOA, EBD reaches target position at target speed + dVEbi. See Subset
        // 026: §3.13.8.3.1, figure 40.
        val dvEbi = dvEbi(targetSpeed)
        val speedAtTargetPosition = targetSpeed + dvEbi
        // Compute deceleration to the left, starting with a speed a little above the LoA point.
        EnvelopeDeceleration.decelerate(
            context,
            targetPosition,
            speedAtTargetPosition,
            overlayBuilder,
            -1.0,
            brakingType,
        )
        val leftPart = partBuilder.build()
        // Complete the curve by computing deceleration from the same point, but to the right (reset
        // overlayBuilder to compute intersection with targetSpeed).
        val rightPartBuilder = EnvelopePartBuilder()
        rightPartBuilder.setAttr(EnvelopeProfile.BRAKING)
        val rightOverlayBuilder =
            ConstrainedEnvelopePartBuilder(
                rightPartBuilder,
                PositionConstraint(0.0, Double.POSITIVE_INFINITY),
                SpeedConstraint(targetSpeed, EnvelopePartConstraintType.FLOOR),
            )
        EnvelopeDeceleration.decelerate(
            context,
            targetPosition,
            speedAtTargetPosition,
            rightOverlayBuilder,
            1.0,
            brakingType,
        )
        val rightPart = rightPartBuilder.build()
        return BrakingCurve(brakingType, Envelope.make(leftPart, rightPart))
    } else {
        // For every other case, the braking curve reaches the target position at the target speed.
        EnvelopeDeceleration.decelerate(
            context,
            targetPosition,
            targetSpeed,
            overlayBuilder,
            -1.0,
            brakingType,
        )
        return BrakingCurve(brakingType, Envelope.make(partBuilder.build()))
    }
}

/**
 * Compute EBI curve from EBD curve. Resulting EBI stops at target speed. See Subset 026: figure 45.
 */
private fun computeEbiBrakingCurveFromEbd(
    context: EnvelopeSimContext,
    ebdCurve: BrakingCurve,
    targetSpeed: Double,
): BrakingCurve {
    assert(ebdCurve.brakingType == EBD)
    val ebdPoints = ebdCurve.brakingCurve.iteratePoints().distinct()
    val pointCount = ebdPoints.size
    var newPositions = DoubleArray(pointCount)
    var newSpeeds = DoubleArray(pointCount)
    for (i in 0 until pointCount) {
        val ebdPoint = ebdPoints[i]
        val position = ebdPoint.position
        val speed = ebdPoint.speed
        val becParams = computeBecParams(context, position, speed, targetSpeed)
        val newPos = position - becParams.dBec
        val newSpeed = speed - becParams.deltaBecSpeed
        newPositions[i] = newPos
        // TODO: unneeded for now: interpolate to not approximate position at 0 m/s.
        newSpeeds[i] = max(newSpeed, 0.0)
        if (newSpeed <= 0.0 && i < pointCount - 1) {
            // Clean up the last unneeded points in the arrays before exiting the loop.
            newPositions = newPositions.dropLast(pointCount - 1 - i).toDoubleArray()
            newSpeeds = newSpeeds.dropLast(pointCount - 1 - i).toDoubleArray()
            break
        }
    }

    val fullBrakingCurve =
        EnvelopePart.generateTimes(listOf(EnvelopeProfile.BRAKING), newPositions, newSpeeds)

    // Make EBI stop at target speed.
    val intersection = fullBrakingCurve.interpolatePosition(targetSpeed)
    return BrakingCurve(
        EBI,
        Envelope.make(
            fullBrakingCurve.sliceWithSpeeds(
                fullBrakingCurve.beginPos,
                fullBrakingCurve.beginSpeed,
                intersection,
                targetSpeed,
            )!!
        ),
    )
}

/**
 * Compute braking curves from ref. Braking curves are computed as follows (see Subset 026: figures
 * 45 and 46):
 * - EBI/SBD -> SBI
 * - SBI -> pre-PS
 * - pre-PS + GUI -> PS
 * - PS -> IND
 */
private fun computeBrakingCurvesFromRefs(
    context: EnvelopeSimContext,
    refBrakingCurve: BrakingCurve,
    guiCurve: BrakingCurve,
): BrakingCurves {
    assert(guiCurve.brakingType == GUI)
    val rollingStock = context.rollingStock
    val (sbiBrakingCurveType, tBs) =
        when (refBrakingCurve.brakingType) {
            SBD -> Pair(SBI_1, rollingStock.rjsEtcsBrakeParams.tBs1)
            EBI -> Pair(SBI_2, rollingStock.rjsEtcsBrakeParams.tBs2)
            else ->
                throw IllegalArgumentException(
                    "Expected EBI or SBD reference braking curve type, found: ${refBrakingCurve.brakingType}"
                )
        }

    val refBrakingPoints = refBrakingCurve.brakingCurve.iteratePoints().distinct()
    val pointCount = refBrakingPoints.size
    val sbiPositions = DoubleArray(pointCount)
    val prePsPositions = DoubleArray(pointCount)
    val newSpeeds = DoubleArray(pointCount)
    for (i in 0 until pointCount) {
        val speed = refBrakingPoints[i].speed
        sbiPositions[i] = getSbiPosition(refBrakingPoints[i].position, speed, tBs)
        prePsPositions[i] = getPrePermittedSpeedPosition(sbiPositions[i], speed)
        newSpeeds[i] = speed
    }

    val sbiCurve =
        BrakingCurve(
            sbiBrakingCurveType,
            Envelope.make(
                EnvelopePart.generateTimes(listOf(EnvelopeProfile.BRAKING), sbiPositions, newSpeeds)
            ),
        )

    val prePsCurve =
        BrakingCurve(
            PRE_PS,
            Envelope.make(
                EnvelopePart.generateTimes(
                    listOf(EnvelopeProfile.BRAKING),
                    prePsPositions,
                    newSpeeds,
                )
            ),
        )
    val psCurve = computeMinETCSBrakingCurves(prePsCurve, guiCurve)!!

    val psPoints = psCurve.brakingCurve.iteratePoints().distinct()
    val indPositions =
        psPoints.map { getIndicationPosition(it.position, it.speed, tBs) }.toDoubleArray()
    val indSpeeds = psPoints.map { it.speed }.toDoubleArray()
    val indCurve =
        BrakingCurve(
            IND,
            Envelope.make(
                EnvelopePart.generateTimes(listOf(EnvelopeProfile.BRAKING), indPositions, indSpeeds)
            ),
        )

    val brakingCurves = EnumMap<BrakingType, BrakingCurve?>(BrakingType::class.java)
    brakingCurves[sbiCurve.brakingType] = sbiCurve
    brakingCurves[psCurve.brakingType] = psCurve
    brakingCurves[indCurve.brakingType] = indCurve
    return brakingCurves
}

/**
 * Computes the mininum ETCS braking curve. Both curves must have the same braking curve type.
 * Should be used to:
 * - compare EoA curves to SvL curves, for GUI, PS and IND.
 * - compare pre PS curve to GUI curve.
 */
private fun computeMinETCSBrakingCurves(
    brakingCurve1: BrakingCurve?,
    brakingCurve2: BrakingCurve?,
): BrakingCurve? {
    if (brakingCurve1 == null) return brakingCurve2
    else if (brakingCurve2 == null) return brakingCurve1

    val brakingCurveType1 = brakingCurve1.brakingType
    val brakingCurveType2 = brakingCurve2.brakingType
    val brakingCurveType =
        if (brakingCurveType1 == brakingCurveType2) brakingCurveType1
        else {
            assert(
                (brakingCurveType1 == PRE_PS && brakingCurveType2 == GUI) ||
                    (brakingCurveType1 == GUI && brakingCurveType2 == PRE_PS)
            )
            PS
        }

    val endPos1 = brakingCurve1.brakingCurve.endPos
    val endPos2 = brakingCurve2.brakingCurve.endPos
    val beginPos1 = brakingCurve1.brakingCurve.beginPos
    val beginPos2 = brakingCurve2.brakingCurve.beginPos
    if (brakingCurveType == GUI) return if (endPos2 >= endPos1) brakingCurve1 else brakingCurve2
    else if (beginPos2 >= endPos1) return brakingCurve1
    else if (beginPos1 >= endPos2) return brakingCurve2

    // Compute min curve on intersecting range.
    val intersectingRangeBegin = max(beginPos1, beginPos2)
    val intersectingRangeEnd = min(endPos1, endPos2)
    val curveOnIntersectingRange1 =
        Envelope.make(
            *brakingCurve1.brakingCurve.slice(intersectingRangeBegin, intersectingRangeEnd)
        )
    val curveOnIntersectingRange2 =
        Envelope.make(
            *brakingCurve2.brakingCurve.slice(intersectingRangeBegin, intersectingRangeEnd)
        )
    val minCurveOnIntersectingRange =
        minEnvelopes(curveOnIntersectingRange1, curveOnIntersectingRange2)

    // Add corresponding curve part before intersecting range.
    val minCurve = minCurveOnIntersectingRange.stream().toList().toMutableList()
    val isCurveAtBeginCurve1 =
        brakingCurve1.brakingCurve.interpolateSpeed(intersectingRangeBegin) ==
            minCurveOnIntersectingRange.beginSpeed
    if (isCurveAtBeginCurve1 && beginPos1 < minCurveOnIntersectingRange.beginPos)
        minCurve.addAll(
            0,
            brakingCurve1.brakingCurve.slice(beginPos1, intersectingRangeBegin).toList(),
        )
    else if (!isCurveAtBeginCurve1 && beginPos2 < minCurveOnIntersectingRange.beginPos)
        minCurve.addAll(
            0,
            brakingCurve2.brakingCurve.slice(beginPos2, intersectingRangeBegin).toList(),
        )

    return BrakingCurve(brakingCurveType, Envelope.make(*minCurve.toTypedArray()))
}

/**
 * Keep the part of the full braking curve which is located underneath the overlay and intersects
 * with it or with begin position. If the braking curve has no intersection, return null.
 */
private fun keepBrakingCurveUnderOverlay(
    etcsBrakingCurve: BrakingCurve?,
    overlay: Envelope,
    beginPos: Double,
): BrakingCurve? {
    if (etcsBrakingCurve == null) return null
    var brakingCurve = etcsBrakingCurve.brakingCurve
    if (brakingCurve.beginPos >= overlay.endPos || brakingCurve.endPos <= beginPos) {
        etcsBrakingCurvesLogger.warn(
            "The position-range of the ETCS braking curve starting at (${brakingCurve.beginPos}, ${brakingCurve.beginSpeed}) and ending at (${brakingCurve.endPos}, ${brakingCurve.endSpeed}) does not intersect with the overlay envelope's position-range."
        )
        return null
    }
    if (brakingCurve.endPos > overlay.endPos) {
        // Slice envelope to remove the braking curve part which is after the overlay.
        brakingCurve = Envelope.make(*brakingCurve.slice(brakingCurve.beginPos, overlay.endPos))
    }

    val points = brakingCurve.iteratePoints().distinct()
    val positions = points.map { it.position }
    val speeds = points.map { it.speed }
    val timeDeltas = brakingCurve.flatMap { it.getTimeDeltas() }
    val isAboveOverlay =
        // If the last point is strictly above the overlay, the lowest part of the braking curve is
        // above
        // as well.
        brakingCurve.endSpeed > overlay.interpolateSpeedLeftDir(brakingCurve.endPos, 1.0) ||
            // If the last point is on the overlay, if the second to last is above the overlay, then
            // the lowest part of the braking curve is above as well.
            (brakingCurve.endSpeed == overlay.interpolateSpeedLeftDir(brakingCurve.endPos, 1.0) &&
                speeds[speeds.size - 2] >=
                    overlay.interpolateSpeedLeftDir(positions[positions.size - 2], 1.0))
    if (isAboveOverlay) {
        // The lowest part of the braking curve is above the overlay envelope: dismiss it entirely
        // (currently considering that higher parts of the curve which would end up under the
        // overlay would actually be irrelevant when compared to other slowdown braking curves).
        return null
    }

    val partBuilder = EnvelopePartBuilder()
    partBuilder.setAttr(EnvelopeProfile.BRAKING)
    val overlayBuilder =
        ConstrainedEnvelopePartBuilder(
            partBuilder,
            PositionConstraint(max(beginPos, brakingCurve.beginPos), overlay.endPos),
            EnvelopeConstraint(overlay, EnvelopePartConstraintType.CEILING),
        )
    val lastIndex = positions.lastIndex
    overlayBuilder.initEnvelopePart(positions[lastIndex], speeds[lastIndex], -1.0)
    for (i in lastIndex - 1 downTo 0) {
        if (!overlayBuilder.addStep(positions[i], speeds[i], timeDeltas[i])) break
    }
    return BrakingCurve(etcsBrakingCurve.brakingType, Envelope.make(partBuilder.build()))
}

private data class BecParams(val dBec: Double, val vBec: Double, val speed: Double) {
    val deltaBecSpeed: Double = vBec - speed
}

/**
 * Compute the position and speed offsets between EBD and EBI curves, for a given speed. See Subset
 * 026: 3.13.9.3.2.
 */
private fun computeBecParams(
    context: EnvelopeSimContext,
    position: Double,
    speed: Double,
    targetSpeed: Double,
): BecParams {
    val rollingStock = context.rollingStock

    val vDelta0 = vDelta0(speed)

    val minGrade = TrainPhysicsIntegrator.getMinGrade(rollingStock, context.path, position)
    val weightForce = TrainPhysicsIntegrator.getWeightForce(rollingStock, minGrade)
    // The time during which the traction effort is still present. See Subset: §3.13.9.3.2.3.
    val tTraction =
        max(
            rollingStock.rjsEtcsBrakeParams.tTractionCutOff -
                (T_WARNING + rollingStock.rjsEtcsBrakeParams.tBs2),
            0.0,
        )
    // Estimated acceleration during tTraction, worst case scenario (the train accelerates as much
    // as possible).
    val aEst1 =
        TrainPhysicsIntegrator.computeAcceleration(
            rollingStock,
            rollingStock.getRollingResistance(speed),
            weightForce,
            speed,
            PhysicsRollingStock.getMaxEffort(
                speed,
                // TODO: have a tractive effort curve map which extends until the last SvL instead
                // of the end of the path.
                context.tractiveEffortCurveMap.get(min(position, context.path.length)),
            ),
            1.0,
        )
    // Speed correction due to the traction staying active during tTraction. See Subset:
    // §3.13.9.3.2.10.
    val vDelta1 = aEst1 * tTraction

    // The remaining time during which the traction effort is not present. See Subset:
    // §3.13.9.3.2.6.
    val tBerem = max(rollingStock.rjsEtcsBrakeParams.tBe - tTraction, 0.0)
    // Speed correction due to the braking system not being active yet. See Subset: §3.13.9.3.2.10.
    val vDelta2 = A_EST_2 * tBerem

    // Compute dBec and vBec. See Subset: §3.13.9.3.2.10.
    val maxV = max(speed + vDelta0 + vDelta1, targetSpeed)
    val dBec =
        max(speed + vDelta0 + vDelta1 / 2, targetSpeed) * tTraction + (maxV + vDelta2 / 2) * tBerem
    val vBec = maxV + vDelta2

    return BecParams(dBec, vBec, speed)
}

private fun maxBecDeltaSpeed(): Double {
    // TODO: correctly compute maxBecDeltaSpeed. TBD at a later date.
    return 50.0 / 3.6
}

/** See Subset 026: §3.13.9.3.3.1 and §3.13.9.3.3.2. */
private fun getSbiPosition(ebiOrSbdPosition: Double, speed: Double, tbs: Double): Double {
    return getPreviousPosition(ebiOrSbdPosition, speed, tbs)
}

/** See Subset 026: §3.13.9.3.5.1. */
private fun getPrePermittedSpeedPosition(sbiPosition: Double, speed: Double): Double {
    return getPreviousPosition(sbiPosition, speed, T_DRIVER)
}

/** See Subset 026: §3.13.9.3.6.1 and §3.13.9.3.6.2. */
private fun getIndicationPosition(
    permittedSpeedPosition: Double,
    speed: Double,
    tBs: Double,
): Double {
    val tIndication = max((0.8 * tBs), 5.0) + T_DRIVER
    return getPreviousPosition(permittedSpeedPosition, speed, tIndication)
}

private fun getPreviousPosition(position: Double, speed: Double, elapsedTime: Double): Double {
    return getPreviousPosition(position, speed * elapsedTime)
}

private fun getPreviousPosition(position: Double, elapsedDistance: Double): Double {
    return position - elapsedDistance
}
