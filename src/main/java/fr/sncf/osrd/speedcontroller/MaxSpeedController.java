package fr.sncf.osrd.speedcontroller;

public class MaxSpeedController extends SpeedController {
    public final double speedLimit;

    public MaxSpeedController(double speedLimit, double beginPathOffset, double endPathOffset) {
        super(beginPathOffset, endPathOffset);
        this.speedLimit = speedLimit;
    }

    @Override
    public SpeedDirective getDirective(
            double headPosition
    ) {
        return new SpeedDirective(speedLimit, speedLimit, speedLimit, false);
    }

    @Override
    public String toString() {
        return String.format(
                "MaxSpeedController { targetSpeed=%.3f, begin=%.3f, end=%.3f}",
                speedLimit, beginPosition, endPosition
        );
    }
}
