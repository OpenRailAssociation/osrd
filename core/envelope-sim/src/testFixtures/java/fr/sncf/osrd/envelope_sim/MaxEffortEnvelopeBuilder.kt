package fr.sncf.osrd.envelope_sim

import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.Range
import com.google.common.collect.RangeMap
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope.from
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope.SimStop
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope.from
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

// TODO: Remove object once all the java tests using these methods are converted to kotlin files.
object MaxEffortEnvelopeBuilder {
    /** Builds max effort envelope with the specified stops, on a flat MRSP */
    @JvmStatic
    fun makeSimpleMaxEffortEnvelope(
        context: EnvelopeSimContext,
        maxSpeed: Double,
        stops: DoubleArray
    ): Envelope {
        return makeMaxEffortEnvelopeFromSpeedRanges(
            context,
            ImmutableRangeMap.of(Range.open(0.0, context.path.length), maxSpeed),
            stops
        )
    }

    /** Builds max effort envelope with one stop in the middle, one at the end, on a flat MRSP */
    @JvmStatic
    fun makeSimpleMaxEffortEnvelope(context: EnvelopeSimContext, speed: Double): Envelope {
        val stops = doubleArrayOf(6000.0, context.path.length)
        return makeSimpleMaxEffortEnvelope(context, speed, stops)
    }

    /** Builds max effort envelope with one stop in the middle, one at the end, on a funky MRSP */
    @JvmStatic
    fun makeComplexMaxEffortEnvelope(context: EnvelopeSimContext, stops: DoubleArray): Envelope {
        val mrsp = TestMRSPBuilder.makeComplexMRSP(context)
        val stopInfos = ArrayList<SimStop>()
        for (stop in stops) {
            stopInfos.add(SimStop(Offset(stop.meters), RJSReceptionSignal.SHORT_SLIP_STOP))
        }
        val maxSpeedEnvelope = from(context, stopInfos, mrsp)
        return from(context, 0.0, maxSpeedEnvelope)
    }

    /** Builds max effort envelope with the specified stops, on a flat MRSP */
    private fun makeMaxEffortEnvelopeFromSpeedRanges(
        context: EnvelopeSimContext,
        speeds: RangeMap<Double, Double>,
        stops: DoubleArray
    ): Envelope {
        val flatMRSP = TestMRSPBuilder.makeSimpleMRSP(context, speeds)
        val stopInfos = ArrayList<SimStop>()
        for (stop in stops) {
            stopInfos.add(SimStop(Offset(stop.meters), RJSReceptionSignal.SHORT_SLIP_STOP))
        }
        val maxSpeedEnvelope = from(context, stopInfos, flatMRSP)
        return from(context, 0.0, maxSpeedEnvelope)
    }
}
