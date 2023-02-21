package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope_sim.TestMRSPBuilder.makeComplexMRSP;
import static fr.sncf.osrd.envelope_sim.TestMRSPBuilder.makeSimpleMRSP;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;

public class MaxEffortEnvelopeBuilder {
    /** Builds max effort envelope with the specified stops, on a flat MRSP */
    public static Envelope makeSimpleMaxEffortEnvelope(
            EnvelopeSimContext context,
            double speed,
            double[] stops
    ) {
        var flatMRSP = makeSimpleMRSP(context, speed);
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, flatMRSP);
        return MaxEffortEnvelope.from(context, 0, maxSpeedEnvelope);
    }

    /** Builds max effort envelope with one stop in the middle, one at the end, on a flat MRSP */
    static Envelope makeSimpleMaxEffortEnvelope(EnvelopeSimContext context, double speed) {
        var stops = new double[] {6000, context.path.getLength()};
        return makeSimpleMaxEffortEnvelope(context, speed, stops);
    }

    /** Builds max effort envelope with one stop in the middle, one at the end, on a funky MRSP */
    static Envelope makeComplexMaxEffortEnvelope(
            EnvelopeSimContext context,
            double[] stops
    ) {
        var mrsp = makeComplexMRSP(context);
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, mrsp);
        return MaxEffortEnvelope.from(context, 0, maxSpeedEnvelope);
    }
}
