package fr.sncf.osrd.envelope_sim.etcs

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.sim_infra.api.TravelledPath
import fr.sncf.osrd.utils.units.Offset

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
    ): List<Map<BrakingCurveType, ETCSBrakingCurve?>>

    /** Compute the ETCS braking curves for each EoA, ordered by EoA offset. */
    fun computeStopBrakingCurves(
        mrsp: Envelope,
        endsOfAuthority: Collection<EndOfAuthority>
    ): List<Map<BrakingCurveType, ETCSBrakingCurve?>>
}

data class LimitOfAuthority(
    val offset: Offset<TravelledPath>,
    val speed: Double,
) {
    init {
        assert(speed > 0)
    }
}

data class EndOfAuthority(
    val offsetEOA: Offset<TravelledPath>,
    val offsetSVL: Offset<TravelledPath>?,
) {
    init {
        if (offsetSVL != null) assert(offsetSVL >= offsetEOA)
    }
}

class ETCSBrakingSimulatorImpl(override val context: EnvelopeSimContext) : ETCSBrakingSimulator {
    override fun addSlowdownBrakingCurves(
        envelope: Envelope,
        limitsOfAuthority: Collection<LimitOfAuthority>
    ): Envelope {
        return addBrakingCurvesAtLOAs(envelope, context, limitsOfAuthority)
    }

    override fun addStopBrakingCurves(
        envelope: Envelope,
        endsOfAuthority: Collection<EndOfAuthority>
    ): Envelope {
        return addBrakingCurvesAtEOAs(envelope, context, endsOfAuthority)
    }

    override fun computeSlowdownBrakingCurves(
        mrsp: Envelope,
        limitsOfAuthority: Collection<LimitOfAuthority>
    ): List<Map<BrakingCurveType, ETCSBrakingCurve?>> {
        return computeBrakingCurvesAtLOAs(mrsp, context, limitsOfAuthority)
    }

    override fun computeStopBrakingCurves(
        mrsp: Envelope,
        endsOfAuthority: Collection<EndOfAuthority>
    ): List<Map<BrakingCurveType, ETCSBrakingCurve?>> {
        return computeBrakingCurvesAtEOAs(mrsp, context, endsOfAuthority)
    }
}
