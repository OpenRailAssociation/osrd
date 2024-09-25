package fr.sncf.osrd.envelope_sim_infra

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.MRSPEnvelopeBuilder
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.sim_infra.api.PathProperties
import fr.sncf.osrd.sim_infra.api.SpeedLimitProperty
import fr.sncf.osrd.sim_infra.api.SpeedLimitSource.UnknownTag
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.SelfTypeHolder
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.rangeMapEntryToSpeedLimitProperty
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Distance.Companion.toMeters
import fr.sncf.osrd.utils.units.Speed
import fr.sncf.osrd.utils.units.Speed.Companion.toMetersPerSecond
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.metersPerSecond
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
    trainTag: String?,
    safetySpeedRanges: DistanceRangeMap<Speed>? = null,
): Envelope {
    return computeMRSP(
        path,
        rollingStock.getMaxSpeed(),
        rollingStock.getLength(),
        addRollingStockLength,
        trainTag,
        safetySpeedRanges,
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
    trainTag: String?,
    safetySpeedRanges: DistanceRangeMap<Speed>? = null,
): Envelope {
    val builder = MRSPEnvelopeBuilder()
    val pathLength = toMeters(path.getLength())

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
        if (attrs.any { it is UnknownTag }) attrs.add(HasMissingSpeedTag)
        if (speed != 0.0) // Add the envelope part corresponding to the restricted speed section
            builder.addPart(
                EnvelopePart.generateTimes(
                    attrs,
                    doubleArrayOf(start, end),
                    doubleArrayOf(speed, speed)
                )
            )
    }

    // Add a limit corresponding to the hardware's maximum operational speed
    val attrs = listOf(EnvelopeProfile.CONSTANT_SPEED, MRSPEnvelopeBuilder.LimitKind.TRAIN_LIMIT)
    addSpeedSection(
        builder,
        0.meters,
        pathLength.meters,
        rsMaxSpeed.metersPerSecond,
        attrs,
        speedLimitProperties
    )

    // Add safety speeds
    if (safetySpeedRanges != null) {
        for (range in safetySpeedRanges) {
            val speed = range.value
            val newAttrs =
                listOf<SelfTypeHolder?>(
                    EnvelopeProfile.CONSTANT_SPEED,
                    MRSPEnvelopeBuilder.LimitKind.SAFETY_APPROACH_SPEED,
                )
            addSpeedSection(
                builder,
                range.lower,
                Distance.min(range.upper + offset.meters, pathLength.meters),
                speed,
                newAttrs,
                speedLimitProperties
            )
        }
    }
    return builder.build()
}

fun addSpeedSection(
    builder: MRSPEnvelopeBuilder,
    lower: Distance,
    upper: Distance,
    speed: Speed,
    attrs: List<SelfTypeHolder?>,
    propertyRangeMap: DistanceRangeMap<SpeedLimitProperty>,
) {
    val propsRanges = makeSpeedLimitAttributes(lower, upper, propertyRangeMap, attrs)
    for (propsRange in propsRanges) {
        builder.addPart(
            EnvelopePart.generateTimes(
                propsRange.value,
                doubleArrayOf(propsRange.lower.meters, propsRange.upper.meters),
                doubleArrayOf(speed.metersPerSecond, speed.metersPerSecond)
            )
        )
    }
}

/**
 * Build a range map of speed limit attributes, from base attribute list and a range map of
 * properties. The goal is to pick important attributes that we want to forward to the envelope
 * attributes no matter what. Specifically, unknown speed tag should always be carried over.
 */
fun makeSpeedLimitAttributes(
    lower: Distance,
    upper: Distance,
    propertyRangeMap: DistanceRangeMap<SpeedLimitProperty>,
    baseAttrs: List<SelfTypeHolder?>,
): DistanceRangeMap<List<SelfTypeHolder?>> {
    val result: DistanceRangeMap<List<SelfTypeHolder?>> =
        distanceRangeMapOf(listOf(DistanceRangeMap.RangeMapEntry(lower, upper, baseAttrs)))

    // Add important attributes from the old speed ranges
    val attrsWithMissingRange = baseAttrs.toMutableList()
    attrsWithMissingRange.add(HasMissingSpeedTag)
    for (oldRange in propertyRangeMap.subMap(lower, upper)) {
        if (oldRange.value.source is UnknownTag) {
            // TODO: ideally, it shouldn't be this method's job to figure out which attributes
            // should be kept. Eventually we may look into reworking this, either with warnings or
            // by making the builder handle this
            result.put(oldRange.lower, oldRange.upper, attrsWithMissingRange)
        }
    }

    return result
}

/**
 * Envelope attribute flag, set if there is a missing speed tag in the range. This flag is carries
 * over when building the MRSP. The "speed limit source" tags only refer to the enforced speed at a
 * section of the MRSP, but this tag is always kept even if the actual enforced speed limit source
 * is different. It shouldn't be interpreted as an attribute of the envelope part, but rather as a
 * warning that affects a section of the MRSP. See
 * https://github.com/OpenRailAssociation/osrd/issues/9281
 */
data object HasMissingSpeedTag : SelfTypeHolder {
    override val selfType: Class<out SelfTypeHolder>
        get() = HasMissingSpeedTag::class.java
}
