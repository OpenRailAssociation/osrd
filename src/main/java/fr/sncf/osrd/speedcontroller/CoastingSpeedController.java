package fr.sncf.osrd.speedcontroller;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

public class CoastingSpeedController extends SpeedController {
    /** Creates a speed controller meant to slow down the train before a speed limit. */
    public CoastingSpeedController(
            double startPosition,
            double endPosition
    ) {
        super(startPosition, endPosition);
    }

    @Override
    public SpeedDirective getDirective(double pathPosition) {
        return SpeedDirective.getCoastingController();
    }

    @Override
    public SpeedController scaled(double scalingFactor) {
        return this;
    }

    @Override
    public String toString() {
        return String.format(
                "CoastingSpeedController { begin=%.3f, end=%.3f }",
                beginPosition, endPosition
        );
    }

    @Override
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST", "FE_FLOATING_POINT_EQUALITY"})
    public boolean deepEquals(SpeedController other) {
        if (!equalRange(other))
            return false;
        return other.getClass() == LimitAnnounceSpeedController.class;
    }
}
