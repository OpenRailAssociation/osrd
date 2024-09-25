package fr.sncf.osrd.envelope_sim_infra

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.MRSPEnvelopeBuilder
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.sim_infra.api.PathProperties
import fr.sncf.osrd.utils.SelfTypeHolder
import fr.sncf.osrd.utils.rangeMapEntryToSpeedLimitProperty
import fr.sncf.osrd.utils.units.Distance.Companion.toMeters
import fr.sncf.osrd.utils.units.Speed.Companion.toMetersPerSecond
import kotlin.math.min

/**
 * Computes the MSRP for a rolling stock on a given path. (MRSP = most restrictive speed profile:
 * maximum speed allowed at any given point)
 *
 * @param path corresponding path.
 * @param rollingStock corresponding rolling stock.
 * @param addRollingStockLength whether the rolling stock length should be taken into account in the
 *   computation.
 * @param trainTag corresponding train.
 * @return the corresponding MRSP as an Envelope.
 */
fun computeMRSP(
    path: PathProperties,
    rollingStock: PhysicsRollingStock,
    addRollingStockLength: Boolean,
    trainTag: String?
): Envelope {
    return computeMRSP(
        path,
        rollingStock.getMaxSpeed(),
        rollingStock.getLength(),
        addRollingStockLength,
        trainTag
    )
}

/**
 * Computes the MSRP for a rolling stock on a given path.
 *
 * @param path corresponding path.
 * @param rsMaxSpeed rolling stock max speed (m/s)
 * @param rsLength length of the rolling stock (m)
 * @param addRollingStockLength whether the rolling stock length should be taken into account in the
 *   computation.
 * @param trainTag corresponding train.
 * @return the corresponding MRSP as an Envelope.
 */
fun computeMRSP(
    path: PathProperties,
    rsMaxSpeed: Double,
    rsLength: Double,
    addRollingStockLength: Boolean,
    trainTag: String?
): Envelope {
    val builder = MRSPEnvelopeBuilder()
    val pathLength = toMeters(path.getLength())

    // Add a limit corresponding to the hardware's maximum operational speed
    builder.addPart(
        EnvelopePart.generateTimes(
            listOf(EnvelopeProfile.CONSTANT_SPEED, MRSPEnvelopeBuilder.LimitKind.TRAIN_LIMIT),
            doubleArrayOf(0.0, pathLength),
            doubleArrayOf(rsMaxSpeed, rsMaxSpeed)
        )
    )

    val offset = if (addRollingStockLength) rsLength else 0.0
    val speedLimitProperties = path.getSpeedLimitProperties(trainTag)
    for (speedLimitPropertyRange in speedLimitProperties) {
        // Compute where this limit is active from and to
        val start = toMeters(speedLimitPropertyRange.lower)
        val end = min(pathLength, offset + toMeters(speedLimitPropertyRange.upper))
        val speedLimitProp = rangeMapEntryToSpeedLimitProperty(speedLimitPropertyRange)
        val speed = toMetersPerSecond(speedLimitProp.speed)
        val attrs =
            mutableListOf<SelfTypeHolder?>(
                EnvelopeProfile.CONSTANT_SPEED,
                MRSPEnvelopeBuilder.LimitKind.SPEED_LIMIT
            )
        if (speedLimitProp.source != null) {
            attrs.add(speedLimitProp.source)
        }
        if (speed != 0.0) // Add the envelope part corresponding to the restricted speed section
            builder.addPart(
                EnvelopePart.generateTimes(
                    attrs,
                    doubleArrayOf(start, end),
                    doubleArrayOf(speed, speed)
                )
            )
    }
    return builder.build()
}
