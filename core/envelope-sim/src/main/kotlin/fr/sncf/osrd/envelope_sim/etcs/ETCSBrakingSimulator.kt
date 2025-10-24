package fr.sncf.osrd.envelope_sim.etcs

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.EnvelopeCursor
import fr.sncf.osrd.envelope.OverlayEnvelopeBuilder
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.etcs.BrakingType.IND
import fr.sncf.osrd.envelope_sim.etcs.BrakingType.PS
import fr.sncf.osrd.envelope_sim.pipelines.increase
import fr.sncf.osrd.path.interfaces.TravelledPath
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.utils.arePositionsEqual
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.util.*

/**
 * In charge of computing and adding the ETCS braking curves. Formulas are found in `SUBSET-026-3
 * v400.pdf` from the file at
 * https://www.era.europa.eu/system/files/2023-09/index004_-_SUBSET-026_v400.zip
 */
interface ETCSBrakingSimulator {
    val context: EnvelopeSimContext

    /**
     * Compute the ETCS braking envelope for each LoA and return a new envelope taking said curves
     * into account.
     */
    fun addSlowdownBrakingCurves(
        envelope: Envelope,
        limitsOfAuthority: Collection<LimitOfAuthority>,
    ): Envelope

    /**
     * Compute the ETCS braking envelope for each EoA and return a new envelope taking said curves
     * into account.
     */
    fun addStopBrakingCurves(
        envelope: Envelope,
        endsOfAuthority: Collection<EndOfAuthority>,
    ): Envelope

    /** Compute the ETCS braking curves for each LoA, ordered by LoA offset. */
    fun computeSlowdownBrakingCurves(
        envelope: Envelope,
        limitsOfAuthority: Collection<LimitOfAuthority>,
    ): LOABrakingCurves

    /** Compute the ETCS braking curves for each EoA, ordered by EoA offset. */
    fun computeStopBrakingCurves(
        envelope: Envelope,
        endsOfAuthority: Collection<EndOfAuthority>,
    ): EOABrakingCurves

    /**
     * Compute the ETCS LoAs, only for the slowdowns which are inside an ETCS portion of the path
     * present in the envelope.
     */
    fun computeLoaLocations(mrsp: Envelope): List<LimitOfAuthority>

    /**
     * Compute the ETCS EoAs, only for the stops which are inside an ETCS portion of the path
     * present in the envelope. Used to compute EoAs for:
     * - stops
     * - spacing requirement locations
     * - routing requirement locations.
     *
     * Each stop offset has a corresponding signal which can be restrictive or not:
     * - a restrictive signal corresponds to a CLOSED or route delimiter signal
     * - a non-restrictive signal corresponds to an OPEN or non-route delimiter signal.
     */
    fun computeEoaLocations(
        envelope: Envelope,
        offsets: List<Offset<TravelledPath>>,
        areSignalsOnOffsetsRestrictive: List<Boolean>,
        eoaType: EoaType,
    ): List<EndOfAuthority>
}

typealias BrakingCurves = EnumMap<BrakingType, BrakingCurve?>

typealias LOABrakingCurves = NavigableMap<LimitOfAuthority, BrakingCurves>

typealias EOABrakingCurves = NavigableMap<EndOfAuthority, BrakingCurves>

data class BrakingCurve(val brakingType: BrakingType, val brakingCurve: Envelope)

data class LimitOfAuthority(val offset: Offset<TravelledPath>, val speed: Double) :
    Comparable<LimitOfAuthority> {
    init {
        assert(speed > 0)
    }

    override fun compareTo(other: LimitOfAuthority): Int {
        if (offset != other.offset) return offset.compareTo(other.offset)
        return speed.compareTo(other.speed)
    }
}

data class EndOfAuthority(
    val offsetEOA: Offset<TravelledPath>,
    val offsetSVL: Offset<TravelledPath>?,
    val usedCurveType: BrakingType,
    val eoaType: EoaType = EoaType.STOP,
) : Comparable<EndOfAuthority> {
    init {
        if (offsetSVL != null) assert(offsetSVL >= offsetEOA)
    }

    override fun compareTo(other: EndOfAuthority): Int {
        if (offsetEOA != other.offsetEOA) return offsetEOA.compareTo(other.offsetEOA)
        if (offsetSVL != other.offsetSVL) {
            if (offsetSVL == null) return -1
            if (other.offsetSVL == null) return 1
            return offsetSVL.compareTo(other.offsetSVL)
        }
        if (usedCurveType != other.usedCurveType) {
            return usedCurveType.compareTo(other.usedCurveType)
        }
        if (eoaType != other.eoaType) {
            return eoaType.compareTo(other.eoaType)
        }
        return 0
    }
}

enum class EoaType {
    STOP,
    SPACING,
    ROUTING,
}

class ETCSBrakingSimulatorImpl(override val context: EnvelopeSimContext) : ETCSBrakingSimulator {
    override fun addSlowdownBrakingCurves(
        envelope: Envelope,
        limitsOfAuthority: Collection<LimitOfAuthority>,
    ): Envelope {
        val sortedLimitsOfAuthority = limitsOfAuthority.sorted()
        val beginPos = envelope.beginPos
        var envelopeWithLoaBrakingCurves = envelope
        var builder = OverlayEnvelopeBuilder.forward(envelopeWithLoaBrakingCurves)

        for (limitOfAuthority in sortedLimitsOfAuthority) {
            val ebdBrakingCurves =
                computeBrakingCurvesAtLOA(
                    limitOfAuthority,
                    context,
                    envelopeWithLoaBrakingCurves,
                    beginPos,
                )
            val indicationCurve = ebdBrakingCurves[IND] ?: continue
            indicationCurve.brakingCurve.stream().forEach { builder.addPart(it) }

            // We build the LOAs along the path, and they don't all have the same target speeds. To
            // handle intersections with the next LOA, it is needed to add this LOA braking curve to
            // the
            // overlay builder that will be used to compute the following LOAs.
            envelopeWithLoaBrakingCurves = builder.build()
            builder = OverlayEnvelopeBuilder.forward(envelopeWithLoaBrakingCurves)
        }
        return envelopeWithLoaBrakingCurves
    }

    override fun addStopBrakingCurves(
        envelope: Envelope,
        endsOfAuthority: Collection<EndOfAuthority>,
    ): Envelope {
        val sortedEndsOfAuthority = endsOfAuthority.sorted()
        var beginPos = envelope.beginPos
        val builder = OverlayEnvelopeBuilder.forward(envelope)
        for (endOfAuthority in sortedEndsOfAuthority) {
            val eoaBrakingCurves =
                computeBrakingCurvesAtEOA(endOfAuthority, context, envelope, beginPos)
            // Which braking curve (indication speed, permitted speed, ...) to use depends on the
            // EOA
            val usedBrakingCurve = eoaBrakingCurves[endOfAuthority.usedCurveType] ?: continue
            usedBrakingCurve.brakingCurve.stream().forEach { builder.addPart(it) }

            // We build EOAs along the path. We need to handle overlaps with the next EOA. To do so,
            // we shift the left position constraint, beginPos, to this EOA's target position.
            beginPos = endOfAuthority.offsetEOA.meters
        }
        return builder.build()
    }

    override fun computeSlowdownBrakingCurves(
        envelope: Envelope,
        limitsOfAuthority: Collection<LimitOfAuthority>,
    ): LOABrakingCurves {
        val res: LOABrakingCurves = TreeMap()
        for (limitOfAuthority in limitsOfAuthority) {
            res[limitOfAuthority] =
                computeBrakingCurvesAtLOA(limitOfAuthority, context, envelope, 0.0)
        }
        return res
    }

    override fun computeStopBrakingCurves(
        envelope: Envelope,
        endsOfAuthority: Collection<EndOfAuthority>,
    ): EOABrakingCurves {
        val res: EOABrakingCurves = TreeMap()
        for (endOfAuthority in endsOfAuthority) {
            res[endOfAuthority] = computeBrakingCurvesAtEOA(endOfAuthority, context, envelope, 0.0)
        }
        return res
    }

    override fun computeLoaLocations(mrsp: Envelope): List<LimitOfAuthority> {
        val etcsRanges = context.etcsContext?.applicationRanges ?: return listOf()
        val cursor = EnvelopeCursor.backward(mrsp)
        val limitsOfAuthority = mutableListOf<LimitOfAuthority>()
        while (cursor.findPartTransition(::increase)) {
            val offset = Offset<TravelledPath>(cursor.position.meters)
            if (etcsRanges.contains(offset.distance)) {
                limitsOfAuthority.add(LimitOfAuthority(offset, cursor.speed))
            }
            cursor.nextPart()
        }
        return limitsOfAuthority
    }

    override fun computeEoaLocations(
        envelope: Envelope,
        offsets: List<Offset<TravelledPath>>,
        areSignalsOnOffsetsRestrictive: List<Boolean>,
        eoaType: EoaType,
    ): List<EndOfAuthority> {
        val etcsRanges = context.etcsContext?.applicationRanges ?: return listOf()
        val orderedStops = offsets.zip(areSignalsOnOffsetsRestrictive).sortedBy { it.first }
        val endsOfAuthority = mutableListOf<EndOfAuthority>()
        for (stop in orderedStops) {
            var stopOffset = stop.first
            val isStopSignalRestrictive = stop.second
            val isBeginPos = arePositionsEqual(stopOffset.meters, envelope.beginPos)
            val isEndPos = arePositionsEqual(stopOffset.meters, envelope.endPos)
            val isOutOfBounds =
                stopOffset.meters < envelope.beginPos || stopOffset.meters > envelope.endPos
            if (isBeginPos) {
                // Offset is equal to begin position to within an epsilon.
                continue
            } else if (isEndPos) {
                // Offset is equal to end position to within an epsilon.
                stopOffset = Offset(envelope.endPos.meters)
            } else if (isOutOfBounds) {
                // Stop location is out of bounds of the envelope: throw exception.
                throw OSRDError.envelopeStopOutOfBoundsError(stopOffset.meters, envelope.endPos)
            }
            if (etcsRanges.contains(stopOffset.distance)) {
                val eoa =
                    when (eoaType) {
                        EoaType.STOP -> computeStopEoA(stopOffset, isStopSignalRestrictive)
                        EoaType.SPACING ->
                            computeSpacingConflictEoa(
                                stopOffset,
                                isStopSignalRestrictive,
                                envelope.endPos,
                            )
                        EoaType.ROUTING ->
                            computeRoutingConflictEoa(stopOffset, isStopSignalRestrictive)
                    }
                if (eoa != null) endsOfAuthority.add(eoa)
            }
        }
        return endsOfAuthority
    }

    /** Compute the EoA for a simple stop. */
    private fun computeStopEoA(
        stopOffset: Offset<TravelledPath>,
        isStopOnClosedSignal: Boolean,
    ): EndOfAuthority {
        return if (isStopOnClosedSignal) {
            // On a closed signal, EoA = signal, SvL = next closed signal danger point.
            EndOfAuthority(
                offsetEOA = stopOffset,
                offsetSVL = this.context.etcsContext!!.getMandatoryDangerPoint(stopOffset),
                usedCurveType = IND,
                eoaType = EoaType.STOP,
            )
        } else {
            // On an open signal, EoA = stop, SvL = null and the used curve is the permitted speed.
            EndOfAuthority(
                offsetEOA = stopOffset,
                offsetSVL = null,
                usedCurveType = PS,
                eoaType = EoaType.STOP,
            )
        }
    }

    /** Compute the EoA for a spacing conflict on a signal. */
    private fun computeSpacingConflictEoa(
        signalOffset: Offset<TravelledPath>,
        isRouteDelimiter: Boolean,
        endPos: Double,
    ): EndOfAuthority? {
        val nextDetector = this.context.etcsContext!!.getNextDetector(signalOffset)!!
        return if (isRouteDelimiter) {
            // On a route delimiter signal for spacing requirements, EoA = signal, SvL = next
            // detector.
            EndOfAuthority(
                offsetEOA = signalOffset,
                offsetSVL = nextDetector,
                usedCurveType = IND,
                eoaType = EoaType.SPACING,
            )
        } else if (nextDetector.meters <= endPos) {
            // On a non-route delimiter signal for spacing requirements, EoA = SvL = next detector.
            EndOfAuthority(
                offsetEOA = nextDetector,
                offsetSVL = nextDetector,
                usedCurveType = IND,
                eoaType = EoaType.SPACING,
            )
        } else {
            // On a non-route delimiter  signal, if the next detector is not located before the end
            // position, then the EoA is not on the path: return null.
            null
        }
    }

    /** Compute the EoA for a routing conflict on a signal. */
    private fun computeRoutingConflictEoa(
        signalOffset: Offset<TravelledPath>,
        isRouteDelimiter: Boolean,
    ): EndOfAuthority? {
        return if (isRouteDelimiter) {
            // On a route delimiter signal for routing requirements, EoA = signal, SvL = next
            // mandatory danger point.
            EndOfAuthority(
                offsetEOA = signalOffset,
                offsetSVL = this.context.etcsContext!!.getMandatoryDangerPoint(signalOffset),
                usedCurveType = IND,
                eoaType = EoaType.ROUTING,
            )
        } else {
            // It isn't possible to have a routing requirement on a non-route delimiter signal:
            // return null.
            null
        }
    }
}
