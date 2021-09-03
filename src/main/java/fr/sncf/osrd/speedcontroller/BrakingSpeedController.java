package fr.sncf.osrd.speedcontroller;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.utils.SortedDoubleMap;

/**
 + * The speed controller used to slow down the train from the announce of a speed limit up to its enforcement signal.
 + */

public class BrakingSpeedController extends SpeedController {
    public final SortedDoubleMap speeds;

    /**
     * Creates a speed controller meant to slow down the train before a speed limit.
     */

    public BrakingSpeedController(double startPosition, double endPosition, SortedDoubleMap speeds) {
        super(startPosition, endPosition);
        this.speeds = speeds;
    }

    /**
     * Create LimitAnnounceSpeedController from initial speed
     */
    public static BrakingSpeedController create(SortedDoubleMap speeds) {
        var start = speeds.firstKey();
        var end = speeds.lastKey();
        return new BrakingSpeedController(start, end, speeds);
    }

    @Override
    public SpeedDirective getDirective(double pathPosition) {
        return new SpeedDirective(speeds.interpolate(pathPosition));
    }

    @Override
    public SpeedController scaled(double scalingFactor) {
        var newSpeeds = new SortedDoubleMap();
        for (var entry : speeds.entrySet()) {
            newSpeeds.put(entry.getKey(), entry.getValue() * scalingFactor);
        }
        return new BrakingSpeedController(beginPosition, endPosition, newSpeeds);
    }

    @Override
    public String toString() {
        var targetSpeedLimit = speeds.lastEntry().getValue();
        return String.format("LimitAnnounceSpeedController { targetSpeed=%.3f, begin=%.3f, end=%.3f }",
                targetSpeedLimit, beginPosition, endPosition);
    }

    @Override
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST", "FE_FLOATING_POINT_EQUALITY"})
    public boolean deepEquals(SpeedController other) {
        if (!equalRange(other))
            return false;
        if (other.getClass() != BrakingSpeedController.class)
            return false;
        var o = (BrakingSpeedController) other;
        return o.speeds == speeds;
    }
}

