package fr.sncf.osrd.envelope_sim.etcs

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.OverlayEnvelopeBuilder
import fr.sncf.osrd.envelope.minEnvelopes
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint
import fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType
import fr.sncf.osrd.envelope.part.constraints.PositionConstraint
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint
import fr.sncf.osrd.envelope_sim.*
import fr.sncf.osrd.envelope_sim.etcs.BrakingCurveType.*
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration
import kotlin.math.max
import kotlin.math.min
import org.slf4j.Logger
import org.slf4j.LoggerFactory

/**
 * Formulas are found in `SUBSET-026-3v400.pdf` from the file at
 * https://www.era.europa.eu/system/files/2023-09/index004_-_SUBSET-026_v400.zip
 */
data class ETCSBrakingCurve(val brakingCurveType: BrakingCurveType, val brakingCurve: Envelope)

enum class BrakingCurveType {
    EBD, // Emergency Brake Deceleration
    EBI, // Emergency Brake Intervention
    SBD, // Service Brake Deceleration
    SBI_1, // Service Brake Intervention 1 - SBI curve computed from SBD
    SBI_2, // Service Brake Intervention 2 - SBI curve computed from EBD
    GUI, // Guidance
    PS, // Permitted Speed
    IND // Indication
}

enum class BrakingType {
    CONSTANT,
    ETCS_EBD,
    ETCS_SBD,
    ETCS_GUI
}

val etcsBrakingCurvesLogger: Logger = LoggerFactory.getLogger("EtcsBrakingCurves")

/**
 * Compute braking curves at every limit of authority, and modify inputted envelope to take them
 * into account.
 */
fun addBrakingCurvesAtLOAs(
    maxSpeedEnvelope: Envelope,
    context: EnvelopeSimContext,
    limitsOfAuthority: Collection<LimitOfAuthority>
): Envelope {
    val sortedLimitsOfAuthority = limitsOfAuthority.sortedBy { it.offset }
    val beginPos = maxSpeedEnvelope.beginPos
    var envelopeWithLoaBrakingCurves = maxSpeedEnvelope
    var builder = OverlayEnvelopeBuilder.forward(envelopeWithLoaBrakingCurves)

    for (limitOfAuthority in sortedLimitsOfAuthority) {
        val ebdBrakingCurves =
            computeBrakingCurvesAtOneLOA(
                limitOfAuthority,
                context,
                envelopeWithLoaBrakingCurves,
                beginPos
            )
        val indicationCurve = ebdBrakingCurves[IND] ?: continue
        indicationCurve.brakingCurve.stream().forEach { builder.addPart(it) }

        // We build the LOAs along the path, and they don't all have the same target speeds. To
        // handle intersections with the next LOA, it is needed to add this LOA braking curve to the
        // overlay builder that will be used to compute the following LOAs.
        envelopeWithLoaBrakingCurves = builder.build()
        builder = OverlayEnvelopeBuilder.forward(envelopeWithLoaBrakingCurves)
    }
    return envelopeWithLoaBrakingCurves
}

/**
 * Compute braking curves at every end of authority, and modify inputted envelope to take them into
 * account.
 */
fun addBrakingCurvesAtEOAs(
    envelope: Envelope,
    context: EnvelopeSimContext,
    endsOfAuthority: Collection<EndOfAuthority>
): Envelope {
    val sortedEndsOfAuthority = endsOfAuthority.sortedBy { it.offsetEOA }
    var beginPos = envelope.beginPos
    val builder = OverlayEnvelopeBuilder.forward(envelope)
    for (endOfAuthority in sortedEndsOfAuthority) {
        val eoaBrakingCurves =
            computeBrakingCurvesAtOneEOA(endOfAuthority, context, envelope, beginPos)
        val indicationCurve = eoaBrakingCurves[IND] ?: continue
        indicationCurve.brakingCurve.stream().forEach { builder.addPart(it) }

        // We build EOAs along the path. We need to handle overlaps with the next EOA. To do so, we
        // shift the left position constraint, beginPos, to this EOA's target position.
        beginPos = endOfAuthority.offsetEOA.distance.meters
    }
    return builder.build()
}

/**
 * Compute braking curves at every limit of authority until their speed intersects with inputted
 * envelope.
 */
fun computeBrakingCurvesAtLOAs(
    envelope: Envelope,
    context: EnvelopeSimContext,
    limitsOfAuthority: Collection<LimitOfAuthority>
): List<Map<BrakingCurveType, ETCSBrakingCurve?>> {
    val sortedLimitsOfAuthority = limitsOfAuthority.sortedBy { it.offset }
    val res = mutableListOf<Map<BrakingCurveType, ETCSBrakingCurve?>>()
    for (limitOfAuthority in sortedLimitsOfAuthority) {
        res.add(computeBrakingCurvesAtOneLOA(limitOfAuthority, context, envelope, 0.0))
    }
    return res
}

/**
 * Compute braking curves at every end of authority until their speed intersects with inputted
 * envelope.
 */
fun computeBrakingCurvesAtEOAs(
    envelope: Envelope,
    context: EnvelopeSimContext,
    endsOfAuthority: Collection<EndOfAuthority>
): List<Map<BrakingCurveType, ETCSBrakingCurve?>> {
    val sortedEndsOfAuthority = endsOfAuthority.sortedBy { it.offsetEOA }
    val res = mutableListOf<Map<BrakingCurveType, ETCSBrakingCurve?>>()
    for (endOfAuthority in sortedEndsOfAuthority) {
        res.add(computeBrakingCurvesAtOneEOA(endOfAuthority, context, envelope, 0.0))
    }
    return res
}

/** Compute LoA braking curves: compute EBD-based curves for LoA. */
private fun computeBrakingCurvesAtOneLOA(
    limitOfAuthority: LimitOfAuthority,
    context: EnvelopeSimContext,
    maxSpeedEnvelope: Envelope,
    beginPos: Double
): Map<BrakingCurveType, ETCSBrakingCurve?> {
    val targetPosition = limitOfAuthority.offset.distance.meters
    assert(targetPosition > 0.0)
    val targetSpeed = limitOfAuthority.speed
    assert(targetSpeed > 0.0)
    val ebdBrakingCurves =
        computeEbdBrakingCurves(context, targetPosition, targetSpeed, maxSpeedEnvelope, beginPos)
    return ebdBrakingCurves
}

/**
 * Compute EoA braking curves: compute SBD-based curves for EoA and EBD-based curves for SvL.
 * Compute the minimum between EoA and SvL GUI, PS and IND.
 */
private fun computeBrakingCurvesAtOneEOA(
    endOfAuthority: EndOfAuthority,
    context: EnvelopeSimContext,
    maxSpeedEnvelope: Envelope,
    beginPos: Double
): Map<BrakingCurveType, ETCSBrakingCurve?> {
    val targetPosition = endOfAuthority.offsetEOA.distance.meters
    assert(targetPosition > 0.0)
    val targetSpeed = 0.0
    val eoaBrakingCurves =
        computeSbdBrakingCurves(context, targetPosition, maxSpeedEnvelope, beginPos)
    val svlBrakingCurves =
        if (endOfAuthority.offsetSVL == null) mutableMapOf()
        else
            computeEbdBrakingCurves(
                context,
                endOfAuthority.offsetSVL.distance.meters,
                targetSpeed,
                maxSpeedEnvelope,
                beginPos
            )
    val brakingCurves = svlBrakingCurves.plus(eoaBrakingCurves).toMutableMap()
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
    return brakingCurves
}

/**
 * Compute SBD-based braking curve set. The resulting curves stop at their respective intersections
 * with maxSpeedEnvelope.
 */
private fun computeSbdBrakingCurves(
    context: EnvelopeSimContext,
    targetPosition: Double,
    maxSpeedEnvelope: Envelope,
    beginPos: Double
): Map<BrakingCurveType, ETCSBrakingCurve?> {
    val targetSpeed = 0.0
    val maxSpeed = maxSpeedEnvelope.maxSpeed
    val overhead =
        Envelope.make(
            EnvelopePart.generateTimes(
                listOf(EnvelopeProfile.CONSTANT_SPEED),
                doubleArrayOf(0.0, targetPosition),
                doubleArrayOf(maxSpeed, maxSpeed)
            )
        )
    val sbdCurve = computeBrakingCurve(context, overhead, targetPosition, targetSpeed, SBD)
    assert(sbdCurve.brakingCurve.beginPos >= 0 && sbdCurve.brakingCurve.endPos == targetPosition)
    assert(sbdCurve.brakingCurve.endSpeed == targetSpeed)

    val guiCurve = computeBrakingCurve(context, overhead, targetPosition, targetSpeed, GUI)
    assert(guiCurve.brakingCurve.beginPos >= 0.0 && guiCurve.brakingCurve.endPos == targetPosition)
    assert((guiCurve.brakingCurve.beginSpeed == maxSpeed || guiCurve.brakingCurve.beginPos == 0.0))
    assert(guiCurve.brakingCurve.endSpeed == targetSpeed)

    val sbdFullBrakingCurves =
        computeBrakingCurvesFromRefs(context, sbdCurve, guiCurve).toMutableMap()
    val fullIndicationCurve = sbdFullBrakingCurves[IND]!!
    assert(fullIndicationCurve.brakingCurve.endPos == targetPosition)
    assert(fullIndicationCurve.brakingCurve.endSpeed == targetSpeed)
    sbdFullBrakingCurves[sbdCurve.brakingCurveType] = sbdCurve
    sbdFullBrakingCurves[guiCurve.brakingCurveType] = guiCurve

    val sbdBrakingCurves =
        sbdFullBrakingCurves.mapValues { (_, etcsBrakingCurve) ->
            keepBrakingCurveUnderOverlay(etcsBrakingCurve, maxSpeedEnvelope, beginPos)
        }
    return sbdBrakingCurves
}

/** Compute EBD-based braking curves. */
private fun computeEbdBrakingCurves(
    context: EnvelopeSimContext,
    targetPosition: Double,
    targetSpeed: Double,
    maxSpeedEnvelope: Envelope,
    beginPos: Double
): Map<BrakingCurveType, ETCSBrakingCurve?> {
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
                doubleArrayOf(maxSpeedEbd, maxSpeedEbd)
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

    val ebdFullBrakingCurves =
        computeBrakingCurvesFromRefs(context, ebiCurve, guiCurve).toMutableMap()
    assert(ebdFullBrakingCurves[IND]!!.brakingCurve.endSpeed == targetSpeed)
    ebdFullBrakingCurves[ebdCurve.brakingCurveType] = ebdCurve
    ebdFullBrakingCurves[guiCurve.brakingCurveType] = guiCurve
    ebdFullBrakingCurves[ebiCurve.brakingCurveType] = ebiCurve
    // Add release speed for SvL or maintain speed until LoA
    val maintainSpeed = if (targetSpeed == 0.0) NATIONAL_RELEASE_SPEED else targetSpeed
    ebdFullBrakingCurves[PS] =
        maintainSpeedUntil(ebdFullBrakingCurves[PS]!!, maintainSpeed, targetPosition)
    ebdFullBrakingCurves[IND] =
        maintainSpeedUntil(ebdFullBrakingCurves[IND]!!, maintainSpeed, targetPosition)

    val ebdBrakingCurves =
        ebdFullBrakingCurves.mapValues { (_, etcsBrakingCurve) ->
            keepBrakingCurveUnderOverlay(etcsBrakingCurve, maxSpeedEnvelope, beginPos)
        }
    return ebdBrakingCurves
}

/**
 * Once ETCS braking curve reaches target speed, maintain it until target position.
 * - SvL: maintain release speed for PS and IND curves.
 * - LoA: maintain target speed for PS and IND curves.
 */
private fun maintainSpeedUntil(
    etcsBrakingCurve: ETCSBrakingCurve,
    maintainSpeed: Double,
    targetPosition: Double
): ETCSBrakingCurve {
    val brakingCurve = etcsBrakingCurve.brakingCurve.first()
    assert(brakingCurve.beginPos < targetPosition && brakingCurve.endSpeed <= maintainSpeed)
    val intersection = brakingCurve.interpolatePosition(maintainSpeed)
    val brakingCurveWithMaintain =
        Envelope.make(
            brakingCurve.sliceWithSpeeds(
                brakingCurve.beginPos,
                brakingCurve.beginSpeed,
                intersection,
                maintainSpeed
            )!!,
            EnvelopePart.generateTimes(
                listOf(EnvelopeProfile.CONSTANT_SPEED),
                doubleArrayOf(intersection, targetPosition),
                doubleArrayOf(maintainSpeed, maintainSpeed)
            )
        )
    return ETCSBrakingCurve(etcsBrakingCurve.brakingCurveType, brakingCurveWithMaintain)
}

/** Compute braking curve: used to compute EBD, SBD or GUI. */
private fun computeBrakingCurve(
    context: EnvelopeSimContext,
    envelope: Envelope,
    targetPosition: Double,
    targetSpeed: Double,
    brakingCurveType: BrakingCurveType
): ETCSBrakingCurve {
    val brakingType =
        when (brakingCurveType) {
            EBD -> BrakingType.ETCS_EBD
            SBD -> BrakingType.ETCS_SBD
            GUI -> BrakingType.ETCS_GUI
            else ->
                throw IllegalArgumentException(
                    "Expected EBD, SBD or GUI braking curve type, found: $brakingCurveType"
                )
        }
    // If the stopPosition is after the end of the path, the input is invalid except if it is an
    // SVL, i.e. the target speed is 0 and the curve to compute is not an SBD.
    if ((targetPosition > context.path.length && (targetSpeed != 0.0 || brakingCurveType == SBD)))
        throw RuntimeException(
            String.format(
                "Trying to compute ETCS braking curve from out of bounds ERTMS end/limit of authority: %s",
                targetPosition
            )
        )
    val partBuilder = EnvelopePartBuilder()
    partBuilder.setAttr(EnvelopeProfile.BRAKING)
    val overlayBuilder =
        ConstrainedEnvelopePartBuilder(
            partBuilder,
            PositionConstraint(0.0, targetPosition),
            SpeedConstraint(targetSpeed, EnvelopePartConstraintType.FLOOR),
            EnvelopeConstraint(envelope, EnvelopePartConstraintType.CEILING)
        )
    if (brakingCurveType == EBD && targetSpeed != 0.0) {
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
            brakingType
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
                SpeedConstraint(targetSpeed, EnvelopePartConstraintType.FLOOR)
            )
        EnvelopeDeceleration.decelerate(
            context,
            targetPosition,
            speedAtTargetPosition,
            rightOverlayBuilder,
            1.0,
            brakingType
        )
        val rightPart = rightPartBuilder.build()
        return ETCSBrakingCurve(brakingCurveType, Envelope.make(leftPart, rightPart))
    } else {
        // For every other case, the braking curve reaches the target position at the target speed.
        EnvelopeDeceleration.decelerate(
            context,
            targetPosition,
            targetSpeed,
            overlayBuilder,
            -1.0,
            brakingType
        )
        return ETCSBrakingCurve(brakingCurveType, Envelope.make(partBuilder.build()))
    }
}

/**
 * Compute EBI curve from EBD curve. Resulting EBI stops at target speed. See Subset 026: figure 45.
 */
private fun computeEbiBrakingCurveFromEbd(
    context: EnvelopeSimContext,
    ebdCurve: ETCSBrakingCurve,
    targetSpeed: Double
): ETCSBrakingCurve {
    assert(ebdCurve.brakingCurveType == EBD)
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
    return ETCSBrakingCurve(
        EBI,
        Envelope.make(
            fullBrakingCurve.sliceWithSpeeds(
                fullBrakingCurve.beginPos,
                fullBrakingCurve.beginSpeed,
                intersection,
                targetSpeed
            )!!
        )
    )
}

/**
 * Compute braking curves from ref. Braking curves are computed as follows (see Subset 026: figures
 * 45 and 46):
 * - EBI/SBD -> SBI
 * - SBI -> PS
 * - PS -> IND
 */
private fun computeBrakingCurvesFromRefs(
    context: EnvelopeSimContext,
    refBrakingCurve: ETCSBrakingCurve,
    guiCurve: ETCSBrakingCurve
): Map<BrakingCurveType, ETCSBrakingCurve> {
    assert(guiCurve.brakingCurveType == GUI)
    val rollingStock = context.rollingStock
    val (sbiBrakingCurveType, tBs) =
        when (refBrakingCurve.brakingCurveType) {
            SBD -> Pair(SBI_1, rollingStock.rjsEtcsBrakeParams.tBs1)
            EBI -> Pair(SBI_2, rollingStock.rjsEtcsBrakeParams.tBs2)
            else ->
                throw IllegalArgumentException(
                    "Expected EBI or SBD reference braking curve type, found: ${refBrakingCurve.brakingCurveType}"
                )
        }

    val refBrakingPoints = refBrakingCurve.brakingCurve.iteratePoints().distinct()
    val pointCount = refBrakingPoints.size
    val sbiPositions = DoubleArray(pointCount)
    val psPositions = DoubleArray(pointCount)
    val indPositions = DoubleArray(pointCount)
    val newSpeeds = DoubleArray(pointCount)
    for (i in 0 until pointCount) {
        val speed = refBrakingPoints[i].speed
        sbiPositions[i] = getSbiPosition(refBrakingPoints[i].position, speed, tBs)
        val prePSPosition = getPermittedSpeedPosition(sbiPositions[i], speed)
        psPositions[i] = getAdjustedPermittedSpeedPosition(prePSPosition, speed, guiCurve)
        indPositions[i] = getIndicationPosition(psPositions[i], speed, tBs)
        newSpeeds[i] = speed
    }

    val sbiCurve =
        ETCSBrakingCurve(
            sbiBrakingCurveType,
            Envelope.make(
                EnvelopePart.generateTimes(listOf(EnvelopeProfile.BRAKING), sbiPositions, newSpeeds)
            )
        )
    val psCurve =
        ETCSBrakingCurve(
            PS,
            Envelope.make(
                EnvelopePart.generateTimes(listOf(EnvelopeProfile.BRAKING), psPositions, newSpeeds)
            )
        )
    val indCurve =
        ETCSBrakingCurve(
            IND,
            Envelope.make(
                EnvelopePart.generateTimes(listOf(EnvelopeProfile.BRAKING), indPositions, newSpeeds)
            )
        )

    return mutableMapOf(
        Pair(sbiCurve.brakingCurveType, sbiCurve),
        Pair(psCurve.brakingCurveType, psCurve),
        Pair(indCurve.brakingCurveType, indCurve)
    )
}

/**
 * Computes the mininum ETCS braking curve. Both curves must have the same braking curve type.
 * Should be used to compare EoA curves to SvL curves, for GUI, PS and IND.
 */
private fun computeMinETCSBrakingCurves(
    etcsBrakingCurve1: ETCSBrakingCurve?,
    etcsBrakingCurve2: ETCSBrakingCurve?
): ETCSBrakingCurve? {
    if (etcsBrakingCurve1 == null) return etcsBrakingCurve2
    else if (etcsBrakingCurve2 == null) return etcsBrakingCurve1

    val brakingCurveType1 = etcsBrakingCurve1.brakingCurveType
    val brakingCurveType2 = etcsBrakingCurve2.brakingCurveType
    assert(brakingCurveType1 == brakingCurveType2)

    val endPos1 = etcsBrakingCurve1.brakingCurve.endPos
    val endPos2 = etcsBrakingCurve2.brakingCurve.endPos
    val beginPos1 = etcsBrakingCurve1.brakingCurve.beginPos
    val beginPos2 = etcsBrakingCurve2.brakingCurve.beginPos
    if (brakingCurveType1 == GUI)
        return if (endPos2 >= endPos1) etcsBrakingCurve1 else etcsBrakingCurve2
    else if (beginPos2 >= endPos1) return etcsBrakingCurve1
    else if (beginPos1 >= endPos2) return etcsBrakingCurve2

    // Compute min curve on intersecting range.
    val intersectingRangeBegin = max(beginPos1, beginPos2)
    val intersectingRangeEnd = min(endPos1, endPos2)
    val curveOnIntersectingRange1 =
        Envelope.make(
            *etcsBrakingCurve1.brakingCurve.slice(intersectingRangeBegin, intersectingRangeEnd)
        )
    val curveOnIntersectingRange2 =
        Envelope.make(
            *etcsBrakingCurve2.brakingCurve.slice(intersectingRangeBegin, intersectingRangeEnd)
        )
    val minCurveOnIntersectingRange =
        minEnvelopes(curveOnIntersectingRange1, curveOnIntersectingRange2)

    // Add corresponding curve part before intersecting range.
    val minCurve = minCurveOnIntersectingRange.stream().toList().toMutableList()
    val isCurveAtBeginCurve1 =
        etcsBrakingCurve1.brakingCurve.interpolateSpeed(intersectingRangeBegin) ==
            minCurveOnIntersectingRange.beginSpeed
    if (isCurveAtBeginCurve1 && beginPos1 < minCurveOnIntersectingRange.beginPos)
        minCurve.addAll(
            0,
            etcsBrakingCurve1.brakingCurve.slice(beginPos1, intersectingRangeBegin).toList()
        )
    else if (!isCurveAtBeginCurve1 && beginPos2 < minCurveOnIntersectingRange.beginPos)
        minCurve.addAll(
            0,
            etcsBrakingCurve2.brakingCurve.slice(beginPos2, intersectingRangeBegin).toList()
        )

    return ETCSBrakingCurve(brakingCurveType1, Envelope.make(*minCurve.toTypedArray()))
}

/**
 * Keep the part of the full braking curve which is located underneath the overlay and intersects
 * with it or with begin position. If the braking curve has no intersection, return null.
 */
private fun keepBrakingCurveUnderOverlay(
    etcsBrakingCurve: ETCSBrakingCurve,
    overlay: Envelope,
    beginPos: Double
): ETCSBrakingCurve? {
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
    if (
        brakingCurve.minSpeed >
            Envelope.make(
                    *overlay.slice(
                        max(brakingCurve.beginPos, beginPos),
                        min(brakingCurve.endPos, overlay.endPos)
                    )
                )
                .maxSpeed
    ) {
        // The full braking curve is above the overlay envelope: nothing to do here.
        return null
    }

    val points = brakingCurve.iteratePoints().distinct()
    val positions = points.map { it.position }
    val speeds = points.map { it.speed }
    val timeDeltas = brakingCurve.flatMap { it.getTimeDeltas() }

    val partBuilder = EnvelopePartBuilder()
    partBuilder.setAttr(EnvelopeProfile.BRAKING)
    val overlayBuilder =
        ConstrainedEnvelopePartBuilder(
            partBuilder,
            PositionConstraint(max(beginPos, brakingCurve.beginPos), overlay.endPos),
            EnvelopeConstraint(overlay, EnvelopePartConstraintType.CEILING)
        )
    val lastIndex = getIndexOfLastPointBeneathOverlay(positions, speeds, overlay)
    // To create a braking curve with overlay builder, we need at least 2 positions.
    if (lastIndex <= 0) return null
    overlayBuilder.initEnvelopePart(positions[lastIndex], speeds[lastIndex], -1.0)
    for (i in lastIndex - 1 downTo 0) {
        if (!overlayBuilder.addStep(positions[i], speeds[i], timeDeltas[i])) break
    }
    return ETCSBrakingCurve(etcsBrakingCurve.brakingCurveType, Envelope.make(partBuilder.build()))
}

/**
 * Find the index of the last point which is located beneath the overlay envelope, -1 if none exist.
 */
private fun getIndexOfLastPointBeneathOverlay(
    positions: List<Double>,
    speeds: List<Double>,
    overlay: Envelope
): Int {
    var lastIndex = positions.size - 1
    while (
        lastIndex >= 0 &&
            speeds[lastIndex] >
                overlay
                    .get(overlay.findRightDir(positions[lastIndex], -1.0))
                    .interpolateSpeed(positions[lastIndex])
    ) {
        lastIndex--
    }
    return lastIndex
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
    targetSpeed: Double
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
            0.0
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
                context.tractiveEffortCurveMap.get(min(position, context.path.length))
            ),
            1.0
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
private fun getPermittedSpeedPosition(sbiPosition: Double, speed: Double): Double {
    return getPreviousPosition(sbiPosition, speed, T_DRIVER)
}

/** See Subset 026: §3.13.9.3.5.4. */
private fun getAdjustedPermittedSpeedPosition(
    permittedSpeedPosition: Double,
    speed: Double,
    guiCurve: ETCSBrakingCurve
): Double {
    assert(guiCurve.brakingCurveType == GUI)
    assert(guiCurve.brakingCurve.stream().count() == 1L)
    val guiPart = guiCurve.brakingCurve.stream().findFirst().get()
    val guiPosition =
        if (speed > guiPart.maxSpeed) guiPart.beginPos else guiPart.interpolatePosition(speed)
    // Interpolating adds a position inaccuracy. If both positions are equal, keep more accurate
    // permitted speed position.
    return if (TrainPhysicsIntegrator.arePositionsEqual(permittedSpeedPosition, guiPosition))
        permittedSpeedPosition
    else min(permittedSpeedPosition, guiPosition)
}

/** See Subset 026: §3.13.9.3.6.1 and §3.13.9.3.6.2. */
private fun getIndicationPosition(
    permittedSpeedPosition: Double,
    speed: Double,
    tBs: Double
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
