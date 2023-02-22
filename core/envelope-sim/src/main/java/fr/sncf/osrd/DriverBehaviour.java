package fr.sncf.osrd;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.MRSPEnvelopeBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope_sim.EnvelopeProfile;

import java.util.List;

public class DriverBehaviour {
    public final double acceleratingPostponementOffset;
    public final double brakingAnticipationOffset;

    public DriverBehaviour() {
        this.acceleratingPostponementOffset = 50;
        this.brakingAnticipationOffset = 100;
    }
    public DriverBehaviour(double acceleratingPostponementOffset, double brakingAnticipationOffset) {
        this.acceleratingPostponementOffset = acceleratingPostponementOffset;
        this.brakingAnticipationOffset = brakingAnticipationOffset;
    }

    public Envelope applyToMRSP(Envelope mrsp) {
        var builder = new MRSPEnvelopeBuilder();
        var totalLength = mrsp.getTotalDistance();
        for(EnvelopePart part: mrsp.getParts()) {
            var begin = part.getBeginPos();
            var end = part.getEndPos();
            // compute driver behaviour offsets
            begin -= this.brakingAnticipationOffset;
            end += this.acceleratingPostponementOffset;
            begin = Math.max(0, begin);
            end = Math.min(totalLength, end);
            var speed = part.getMaxSpeed();

            builder.addPart(EnvelopePart.generateTimes(
                    List.of(EnvelopeProfile.CONSTANT_SPEED, MRSPEnvelopeBuilder.LimitKind.SPEED_LIMIT),
                    new double[]{begin, end},
                    new double[]{speed, speed}
            ));
        }
        return builder.build();
    }
}
