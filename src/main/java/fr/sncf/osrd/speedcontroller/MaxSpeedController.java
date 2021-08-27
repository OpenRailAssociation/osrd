package fr.sncf.osrd.speedcontroller;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

public class MaxSpeedController extends StopSpeedController {
    public final double speedLimit;

    public MaxSpeedController(double speedLimit, double beginPathOffset, double endPathOffset) {
        super(beginPathOffset, endPathOffset);
        this.speedLimit = speedLimit;
    }

    public MaxSpeedController(double speedLimit, double beginPathOffset, double endPathOffset, int linkedStopIndex) {
        super(beginPathOffset, endPathOffset, linkedStopIndex);
        this.speedLimit = speedLimit;
    }

    @Override
    public SpeedDirective getDirective(
            double pathPosition
    ) {
        return new SpeedDirective(speedLimit);
    }

    @Override
    public SpeedController scaled(double scalingFactor) {
        return new MaxSpeedController(speedLimit * scalingFactor, beginPosition, endPosition);
    }

    @Override
    public String toString() {
        return String.format(
                "MaxSpeedController { targetSpeed=%.3f, begin=%.3f, end=%.3f}",
                speedLimit, beginPosition, endPosition
        );
    }

    @Override
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST", "FE_FLOATING_POINT_EQUALITY"})
    public boolean deepEquals(SpeedController other) {
        if (!equalRange(other))
            return false;
        if (other.getClass() != MaxSpeedController.class)
            return false;
        return ((MaxSpeedController) other).speedLimit == speedLimit;
    }
}
