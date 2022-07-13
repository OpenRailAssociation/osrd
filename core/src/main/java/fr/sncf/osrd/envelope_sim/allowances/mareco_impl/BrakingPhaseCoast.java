package fr.sncf.osrd.envelope_sim.allowances.mareco_impl;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope_sim.EnvelopeProfile;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.StopMeta;
import java.util.ArrayList;

public class BrakingPhaseCoast implements CoastingOpportunity {
    private final double endPos;

    public BrakingPhaseCoast(double endPos) {
        this.endPos = endPos;
    }

    @Override
    public double getEndPosition() {
        return endPos;
    }

    @Override
    public EnvelopePart compute(Envelope base, EnvelopeSimContext context, double v1, double vf) {
        // coast backwards from the last point of braking phases above vf. forbid going below vf, continue until
        // an intersection with the base is found. if vf was reached of no intersection was found until the starting
        // point, coast forwards from the intersection / starting point.
        return CoastingGenerator.coastFromEnd(base, context, endPos, vf);
    }

    /** Finds all coasting opportunities caused by braking phases */
    public static ArrayList<BrakingPhaseCoast> findAll(Envelope envelope, double v1, double vf) {
        var res = new ArrayList<BrakingPhaseCoast>();
        for (var part : envelope) {
            if (!part.hasAttr(EnvelopeProfile.BRAKING))
                continue;
            double targetSpeed = part.getEndSpeed();
            // if that LimitAnnounceSpeedController is above v1 that means it will not have an impact here
            if (targetSpeed > v1)
                continue;
            // deceleration phases that are entirely above vf
            if (targetSpeed > vf) {
                res.add(new BrakingPhaseCoast(part.getEndPos()));
                continue;
            }
            // deceleration phases that cross vf
            if (part.getMaxSpeed() > vf)
                res.add(new BrakingPhaseCoast(part.interpolatePosition(vf)));
        }
        return res;
    }
}
