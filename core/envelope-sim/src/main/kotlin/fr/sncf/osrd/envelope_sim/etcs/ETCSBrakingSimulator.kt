package fr.sncf.osrd.envelope_sim.etcs

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.OverlayEnvelopeBuilder
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.etcs.BrakingType.IND
import fr.sncf.osrd.sim_infra.api.TravelledPath
import fr.sncf.osrd.utils.units.Offset
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
        limitsOfAuthority: Collection<LimitOfAuthority>
    ): Envelope

    /**
     * Compute the ETCS braking envelope for each EoA and return a new envelope taking said curves
     * into account.
     */
    fun addStopBrakingCurves(
        envelope: Envelope,
        endsOfAuthority: Collection<EndOfAuthority>
    ): Envelope

    /** Compute the ETCS braking curves for each LoA, ordered by LoA offset. */
    fun computeSlowdownBrakingCurves(
        mrsp: Envelope,
        limitsOfAuthority: Collection<LimitOfAuthority>
    ): LOABrakingCurves

    /** Compute the ETCS braking curves for each EoA, ordered by EoA offset. */
    fun computeStopBrakingCurves(
        mrsp: Envelope,
        endsOfAuthority: Collection<EndOfAuthority>
    ): EOABrakingCurves
}

typealias BrakingCurves = EnumMap<BrakingType, BrakingCurve?>

typealias LOABrakingCurves = NavigableMap<LimitOfAuthority, BrakingCurves>

typealias EOABrakingCurves = NavigableMap<EndOfAuthority, BrakingCurves>

data class BrakingCurve(val brakingType: BrakingType, val brakingCurve: Envelope)

data class LimitOfAuthority(
    val offset: Offset<TravelledPath>,
    val speed: Double,
) : Comparable<LimitOfAuthority> {
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
) : Comparable<EndOfAuthority> {
    init {
        if (offsetSVL != null) assert(offsetSVL >= offsetEOA)
    }

    override fun compareTo(other: EndOfAuthority): Int {
        if (offsetEOA != other.offsetEOA) return offsetEOA.compareTo(other.offsetEOA)
        if (offsetSVL == null && other.offsetSVL == null) return 0
        if (offsetSVL == null) return -1
        if (other.offsetSVL == null) return 1
        return offsetSVL.compareTo(other.offsetSVL)
    }
}

class ETCSBrakingSimulatorImpl(override val context: EnvelopeSimContext) : ETCSBrakingSimulator {
    override fun addSlowdownBrakingCurves(
        envelope: Envelope,
        limitsOfAuthority: Collection<LimitOfAuthority>
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
                    beginPos
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
        endsOfAuthority: Collection<EndOfAuthority>
    ): Envelope {
        val sortedEndsOfAuthority = endsOfAuthority.sorted()
        var beginPos = envelope.beginPos
        val builder = OverlayEnvelopeBuilder.forward(envelope)
        for (endOfAuthority in sortedEndsOfAuthority) {
            val eoaBrakingCurves =
                computeBrakingCurvesAtEOA(endOfAuthority, context, envelope, beginPos)
            val indicationCurve = eoaBrakingCurves[IND] ?: continue
            indicationCurve.brakingCurve.stream().forEach { builder.addPart(it) }

            // We build EOAs along the path. We need to handle overlaps with the next EOA. To do so,
            // we
            // shift the left position constraint, beginPos, to this EOA's target position.
            beginPos = endOfAuthority.offsetEOA.distance.meters
        }
        return builder.build()
    }

    override fun computeSlowdownBrakingCurves(
        mrsp: Envelope,
        limitsOfAuthority: Collection<LimitOfAuthority>
    ): LOABrakingCurves {
        val res: LOABrakingCurves = TreeMap()
        for (limitOfAuthority in limitsOfAuthority) {
            res[limitOfAuthority] = computeBrakingCurvesAtLOA(limitOfAuthority, context, mrsp, 0.0)
        }
        return res
    }

    override fun computeStopBrakingCurves(
        mrsp: Envelope,
        endsOfAuthority: Collection<EndOfAuthority>
    ): EOABrakingCurves {
        val res: EOABrakingCurves = TreeMap()
        for (endOfAuthority in endsOfAuthority) {
            res[endOfAuthority] = computeBrakingCurvesAtEOA(endOfAuthority, context, mrsp, 0.0)
        }
        return res
    }
}
