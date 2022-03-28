package fr.sncf.osrd.standalone_sim.result;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.Envelope;
import java.util.ArrayList;
import java.util.List;

@SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
public record ResultEnvelopePoint(double position, double speed) {
    /** Serializes an envelope as a list of points, regardless of part boundaries. */
    public static List<ResultEnvelopePoint> from(Envelope envelope) {
        var res = new ArrayList<ResultEnvelopePoint>();
        for (var part : envelope) {
            for (int i = 0; i < part.pointCount(); i++)
                res.add(new ResultEnvelopePoint(part.getPointPos(i), part.getPointSpeed(i)));
        }
        return res;
    }
}
