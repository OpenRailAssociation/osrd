package fr.sncf.osrd.envelope_sim.etcs

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.OverlayEnvelopeBuilder
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint
import fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType
import fr.sncf.osrd.envelope.part.constraints.PositionConstraint
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint
import fr.sncf.osrd.envelope_sim.*
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration
import kotlin.math.max
import kotlin.math.min
import org.slf4j.Logger
import org.slf4j.LoggerFactory

/**
 * Formulas are found in `SUBSET-026-3v400.pdf` from the file at
 * https://www.era.europa.eu/system/files/2023-09/index004_-_SUBSET-026_v400.zip
 */
enum class BrakingCurveType {
    EBD, // Emergency Brake Deceleration
    EBI, // Emergency Brake Intervention
    SBD, // Service Brake Deceleration
    SBI, // Service Brake Intervention
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

/** Compute braking curves at every end of authority. */
fun addBrakingCurvesAtEOAs(
    envelope: Envelope,
    context: EnvelopeSimContext,
    endsOfAuthority: Collection<EndOfAuthority>
): Envelope {
    val sortedEndsOfAuthority = endsOfAuthority.sortedBy { it.offsetEOA }
    var beginPos = envelope.beginPos
    val maxSpeedEnvelope = envelope.maxSpeed
    val builder = OverlayEnvelopeBuilder.forward(envelope)
    for (endOfAuthority in sortedEndsOfAuthority) {
        val targetPosition = endOfAuthority.offsetEOA.distance.meters
        assert(targetPosition > 0.0)
        val targetSpeed = 0.0
        val fullIndicationCurveEoa =
            computeSbdFullIndicationCurve(context, targetPosition, maxSpeedEnvelope)
        var fullIndicationCurveStop = Envelope.make(fullIndicationCurveEoa)

        if (endOfAuthority.offsetSVL != null) {
            val targetPositionSvl = endOfAuthority.offsetSVL.distance.meters
            val fullIndicationCurveSvl =
                computeEbdFullIndicationCurve(
                    context,
                    targetPositionSvl,
                    targetSpeed,
                    maxSpeedEnvelope
                )
            fullIndicationCurveStop =
                computeMinSvlEoaIndCurve(
                    fullIndicationCurveEoa,
                    fullIndicationCurveSvl,
                    targetPosition
                )
        }

        val indicationCurve =
            keepBrakingCurveUnderOverlay(fullIndicationCurveStop, envelope, beginPos) ?: continue
        assert(indicationCurve.beginPos >= beginPos && indicationCurve.endPos == targetPosition)
        assert(
            indicationCurve.beginSpeed <= maxSpeedEnvelope &&
                indicationCurve.endSpeed == targetSpeed
        )
        builder.addPart(indicationCurve)

        // We build EOAs along the path. We need to handle overlaps with the next EOA. To do so, we
        // shift the left position constraint, beginPos, to this EOA's target position.
        beginPos = targetPosition
    }
    return builder.build()
}

private fun computeMinSvlEoaIndCurve(
    fullIndicationCurveEoa: EnvelopePart,
    fullIndicationCurveSvl: EnvelopePart,
    targetPosition: Double
): Envelope {
    // SvL indication curve should have positions before target position, and speeds above the
    // release speed. Otherwise, follow EoA indication curve.
    if (
        fullIndicationCurveSvl.beginPos >= targetPosition ||
            fullIndicationCurveSvl.maxSpeed <= NATIONAL_RELEASE_SPEED
    ) {
        return Envelope.make(fullIndicationCurveEoa)
    }

    // Real indication curve maintains release speed until the end.
    val releaseSpeedPositionSvl = fullIndicationCurveSvl.interpolatePosition(NATIONAL_RELEASE_SPEED)
    val indCurveSvl =
        Envelope.make(
            fullIndicationCurveSvl.sliceWithSpeeds(
                fullIndicationCurveSvl.beginPos,
                fullIndicationCurveSvl.beginSpeed,
                releaseSpeedPositionSvl,
                NATIONAL_RELEASE_SPEED
            )!!,
            EnvelopePart.generateTimes(
                listOf(EnvelopeProfile.CONSTANT_SPEED),
                doubleArrayOf(releaseSpeedPositionSvl, releaseSpeedPositionEoa),
                doubleArrayOf(NATIONAL_RELEASE_SPEED, NATIONAL_RELEASE_SPEED)
            )
        return Envelope.make(firstIndicationPart, maintainReleaseSpeedPart, lastIndicationPart)
    } else {
        return Envelope.make(firstIndicationPart, lastIndicationPart)
    }
}

/** Compute braking curves at every limit of authority. */
fun addBrakingCurvesAtLOAs(
    envelope: Envelope,
    context: EnvelopeSimContext,
    limitsOfAuthority: Collection<LimitOfAuthority>
): Envelope {
    val sortedLimitsOfAuthority = limitsOfAuthority.sortedBy { it.offset }
    val beginPos = envelope.beginPos
    val maxSpeedEnvelope = envelope.maxSpeed
    var envelopeWithLoaBrakingCurves = envelope
    var builder = OverlayEnvelopeBuilder.forward(envelopeWithLoaBrakingCurves)

    for (limitOfAuthority in sortedLimitsOfAuthority) {
        val targetPosition = limitOfAuthority.offset.distance.meters
        assert(targetPosition > 0.0)
        val targetSpeed = limitOfAuthority.speed
        assert(targetSpeed > 0.0)
        val fullIndicationCurve =
            computeEbdFullIndicationCurve(context, targetPosition, targetSpeed, maxSpeedEnvelope)
        val endOfIndicationCurve = fullIndicationCurve.endPos
        assert(endOfIndicationCurve <= targetPosition)

        val fullIndCurveWithMaintain: Envelope
        if (endOfIndicationCurve < targetPosition) {
            // Maintain target speed until target position, i.e. LOA.
            val maintainTargetSpeedCurve =
                EnvelopePart.generateTimes(
                    listOf(EnvelopeProfile.CONSTANT_SPEED),
                    doubleArrayOf(endOfIndicationCurve, targetPosition),
                    doubleArrayOf(targetSpeed, targetSpeed)
                )
            fullIndCurveWithMaintain = Envelope.make(fullIndicationCurve, maintainTargetSpeedCurve)
        } else {
            fullIndCurveWithMaintain = Envelope.make(fullIndicationCurve)
        }

        val indicationCurve =
            keepBrakingCurveUnderOverlay(
                fullIndCurveWithMaintain,
                envelopeWithLoaBrakingCurves,
                beginPos
            ) ?: continue
        assert(indicationCurve.beginPos >= beginPos && indicationCurve.endPos == targetPosition)
        assert(
            indicationCurve.beginSpeed <= maxSpeedEnvelope &&
                indicationCurve.endSpeed == targetSpeed
        )
        builder.addPart(indicationCurve)

        // We build the LOAs along the path, and they don't all have the same target speeds. To
        // handle intersections with the next LOA, it is needed to add this LOA braking curve to the
        // overlay builder that will be used to compute the following LOAs.
        envelopeWithLoaBrakingCurves = builder.build()
        builder = OverlayEnvelopeBuilder.forward(envelopeWithLoaBrakingCurves)
    }
    return envelopeWithLoaBrakingCurves
}

/** Compute SBD-based full indication curve. */
private fun computeSbdFullIndicationCurve(
    context: EnvelopeSimContext,
    targetPosition: Double,
    maxSpeedEnvelope: Double
): EnvelopePart {
    val targetSpeed = 0.0
    val overhead =
        Envelope.make(
            EnvelopePart.generateTimes(
                listOf(EnvelopeProfile.CONSTANT_SPEED),
                doubleArrayOf(0.0, targetPosition),
                doubleArrayOf(maxSpeedEnvelope, maxSpeedEnvelope)
            )
        )
    val sbdCurve =
        computeBrakingCurve(context, overhead, targetPosition, targetSpeed, BrakingType.ETCS_SBD)
    assert(sbdCurve.beginPos >= 0 && sbdCurve.endPos == targetPosition)
    assert(sbdCurve.endSpeed == targetSpeed)

    val guiCurve =
        computeBrakingCurve(context, overhead, targetPosition, targetSpeed, BrakingType.ETCS_GUI)
    assert(guiCurve.beginPos >= 0.0 && guiCurve.endPos == targetPosition)
    assert((guiCurve.beginSpeed == maxSpeedEnvelope || guiCurve.beginPos == 0.0))
    assert(guiCurve.endSpeed == targetSpeed)

    val fullIndicationCurve =
        computeIndicationBrakingCurveFromRef(context, sbdCurve, BrakingCurveType.SBD, guiCurve)
    assert(fullIndicationCurve.endPos == targetPosition)
    assert(fullIndicationCurve.endSpeed == targetSpeed)
    return fullIndicationCurve
}

/** Compute EBD-based full indication curve. */
private fun computeEbdFullIndicationCurve(
    context: EnvelopeSimContext,
    targetPosition: Double,
    targetSpeed: Double,
    maxSpeedEnvelope: Double
): EnvelopePart {
    // Add maxBecDeltaSpeed to EBD curve overhead so it reaches a sufficiently high speed to
    // guarantee that, after the speed translation, the corresponding EBI curve does intersect
    // with envelope max speed.
    val maxBecDeltaSpeed = maxBecDeltaSpeed()
    val maxSpeedEbd = maxSpeedEnvelope + maxBecDeltaSpeed
    val overhead =
        Envelope.make(
            EnvelopePart.generateTimes(
                listOf(EnvelopeProfile.CONSTANT_SPEED),
                doubleArrayOf(0.0, max(context.path.length, targetPosition)),
                doubleArrayOf(maxSpeedEbd, maxSpeedEbd)
            )
        )

    val ebdCurve =
        computeBrakingCurve(context, overhead, targetPosition, targetSpeed, BrakingType.ETCS_EBD)
    assert(ebdCurve.beginPos >= 0.0 && ebdCurve.endPos >= targetPosition)
    // TODO: uncomment once ebd is not shifted anymore for an LoA
    // assert((ebdCurve.beginSpeed == maxSpeedEbd || ebdCurve.beginPos == 0.0))

    val guiCurve =
        computeBrakingCurve(context, overhead, targetPosition, targetSpeed, BrakingType.ETCS_GUI)
    assert(guiCurve.beginPos >= 0.0 && guiCurve.endPos == targetPosition)
    assert((guiCurve.beginSpeed == maxSpeedEbd || guiCurve.beginPos == 0.0))

    val ebiCurve = computeEbiBrakingCurveFromEbd(context, ebdCurve, targetSpeed)
    assert(ebiCurve.endSpeed == targetSpeed)

    val fullIndicationCurve =
        computeIndicationBrakingCurveFromRef(context, ebiCurve, BrakingCurveType.EBI, guiCurve)
    assert(fullIndicationCurve.endSpeed == targetSpeed)
    return fullIndicationCurve
}

/** Compute braking curve: used to compute EBD, SBD or GUI. */
private fun computeBrakingCurve(
    context: EnvelopeSimContext,
    envelope: Envelope,
    targetPosition: Double,
    targetSpeed: Double,
    brakingType: BrakingType
): EnvelopePart {
    assert(
        brakingType == BrakingType.ETCS_EBD ||
            brakingType == BrakingType.ETCS_SBD ||
            brakingType == BrakingType.ETCS_GUI
    )
    // If the stopPosition is after the end of the path, the input is invalid except if it is an
    // SVL, i.e. the target speed is 0 and the curve to compute is not an SBD.
    if (
        (targetPosition > context.path.length &&
            (targetSpeed != 0.0 || brakingType == BrakingType.ETCS_SBD))
    )
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
    EnvelopeDeceleration.decelerate(
        context,
        targetPosition,
        targetSpeed,
        overlayBuilder,
        -1.0,
        brakingType
    )
    var brakingCurve = partBuilder.build()

    if (brakingType == BrakingType.ETCS_EBD && targetSpeed != 0.0) {
        // TODO: by doing this, there is an approximation on the gradient used. TBD at a later date.
        // When target is an LOA, EBD reaches target position at target speed + dVEbi: shift
        // envelope to make it so. See Subset 026: §3.13.8.3.1, figure 40.
        val dvEbi = dvEbi(targetSpeed)
        val speedAtTargetPosition = targetSpeed + dvEbi
        // Simplification: if EBD does not reach this limit, do not shift it. Impacts few very
        // specific cases (LOA/SVL close to 0.0, with an acceleration curve which would hit them
        // differently if shifted). Manage later on if needed.
        if (
            speedAtTargetPosition <= brakingCurve.beginSpeed &&
                speedAtTargetPosition >= brakingCurve.endSpeed
        ) {
            val intersection = brakingCurve.interpolatePosition(targetSpeed + dvEbi)
            brakingCurve =
                brakingCurve.copyAndShift(
                    targetPosition - intersection,
                    0.0,
                    Double.POSITIVE_INFINITY
                )
        }
    }

    return brakingCurve
}

/**
 * Compute EBI curve from EBD curve. Resulting EBI stops at target speed. See Subset 026: figure 45.
 */
private fun computeEbiBrakingCurveFromEbd(
    context: EnvelopeSimContext,
    ebdCurve: EnvelopePart,
    targetSpeed: Double
): EnvelopePart {
    val pointCount = ebdCurve.pointCount()
    var newPositions = DoubleArray(pointCount)
    var newSpeeds = DoubleArray(pointCount)
    for (i in 0 until pointCount) {
        val speed = ebdCurve.getPointSpeed(i)
        val becParams = computeBecParams(context, ebdCurve, speed, targetSpeed)
        val newPos = ebdCurve.getPointPos(i) - becParams.dBec
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
    return fullBrakingCurve.sliceWithSpeeds(
        fullBrakingCurve.beginPos,
        fullBrakingCurve.beginSpeed,
        intersection,
        targetSpeed
    )!!
}

/** Compute Indication curve: EBI/SBD -> SBI -> PS -> IND. See Subset 026: figures 45 and 46. */
private fun computeIndicationBrakingCurveFromRef(
    context: EnvelopeSimContext,
    refBrakingCurve: EnvelopePart,
    refBrakingCurveType: BrakingCurveType,
    guiCurve: EnvelopePart
): EnvelopePart {
    val rollingStock = context.rollingStock
    val tBs =
        when (refBrakingCurveType) {
            BrakingCurveType.EBI -> rollingStock.rjsEtcsBrakeParams.tBs2
            BrakingCurveType.SBD -> rollingStock.rjsEtcsBrakeParams.tBs1
            else ->
                throw IllegalArgumentException(
                    "Expected EBI or SBD reference braking curve type, found: $refBrakingCurveType"
                )
        }

    val pointCount = refBrakingCurve.pointCount()
    val newPositions = DoubleArray(pointCount)
    val newSpeeds = DoubleArray(pointCount)
    for (i in 0 until refBrakingCurve.pointCount()) {
        val speed = refBrakingCurve.getPointSpeed(i)
        val sbiPosition = getSbiPosition(refBrakingCurve.getPointPos(i), speed, tBs)
        val permittedSpeedPosition = getPermittedSpeedPosition(sbiPosition, speed)
        val adjustedPermittedSpeedPosition =
            getAdjustedPermittedSpeedPosition(permittedSpeedPosition, speed, guiCurve)
        val indicationPosition = getIndicationPosition(adjustedPermittedSpeedPosition, speed, tBs)
        newPositions[i] = indicationPosition
        newSpeeds[i] = speed
    }

    val brakingCurve =
        EnvelopePart.generateTimes(listOf(EnvelopeProfile.BRAKING), newPositions, newSpeeds)

    return brakingCurve
}

/**
 * Keep the part of the full braking curve which is located underneath the overlay and intersects
 * with it or with begin position. If the part has no intersection, return null.
 */
private fun keepBrakingCurveUnderOverlay(
    fullBrakingCurve: Envelope,
    overlay: Envelope,
    beginPos: Double
): EnvelopePart? {
    if (fullBrakingCurve.beginPos >= overlay.endPos || fullBrakingCurve.endPos <= beginPos) {
        etcsBrakingCurvesLogger.warn(
            "The position-range of the ETCS braking curve starting at (${fullBrakingCurve.beginPos}, ${fullBrakingCurve.beginSpeed}) and ending at (${fullBrakingCurve.endPos}, ${fullBrakingCurve.endSpeed}) does not intersect with the overlay envelope's position-range."
        )
        return null
    }
    if (
        fullBrakingCurve.minSpeed >
            Envelope.make(
                    *overlay.slice(
                        max(fullBrakingCurve.beginPos, beginPos),
                        min(fullBrakingCurve.endPos, overlay.endPos)
                    )
                )
                .maxSpeed
    ) {
        // The full braking curve is above the overlay envelope: nothing to do here.
        return null
    }

    // Remove duplicate point part transitions: the last point of the previous array is the first
    // point of the next array. Otherwise, we would be adding two following identical points with
    // addStep, and this would throw an exception.
    val positions =
        fullBrakingCurve
            .map { it.clonePositions() }
            .reduce { mergedArray, currentArray ->
                mergedArray + currentArray.drop(1).toDoubleArray()
            }
    val speeds =
        fullBrakingCurve
            .map { it.cloneSpeeds() }
            .reduce { mergedArray, currentArray ->
                mergedArray + currentArray.drop(1).toDoubleArray()
            }
    val timeDeltas = fullBrakingCurve.flatMap { it.cloneTimes().asList() }

    val partBuilder = EnvelopePartBuilder()
    partBuilder.setAttr(EnvelopeProfile.BRAKING)
    val overlayBuilder =
        ConstrainedEnvelopePartBuilder(
            partBuilder,
            PositionConstraint(max(beginPos, fullBrakingCurve.beginPos), overlay.endPos),
            EnvelopeConstraint(overlay, EnvelopePartConstraintType.CEILING)
        )
    val lastIndex = getIndexOfLastPointBeneathOverlay(positions, speeds, overlay)
    // To create a braking curve with overlay builder, we need at least 2 positions.
    if (lastIndex <= 0) return null
    overlayBuilder.initEnvelopePart(positions[lastIndex], speeds[lastIndex], -1.0)
    for (i in lastIndex - 1 downTo 0) {
        if (!overlayBuilder.addStep(positions[i], speeds[i], timeDeltas[i])) break
    }
    return partBuilder.build()
}

/**
 * Find the index of the last point which is located beneath the overlay envelope, -1 if none exist.
 */
private fun getIndexOfLastPointBeneathOverlay(
    positions: DoubleArray,
    speeds: DoubleArray,
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
    ebd: EnvelopePart,
    speed: Double,
    targetSpeed: Double
): BecParams {
    val position = ebd.interpolatePosition(speed)
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
    guiCurve: EnvelopePart
): Double {
    val guiPosition =
        if (speed > guiCurve.maxSpeed) guiCurve.beginPos else guiCurve.interpolatePosition(speed)
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
