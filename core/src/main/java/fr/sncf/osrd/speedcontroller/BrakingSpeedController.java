package fr.sncf.osrd.speedcontroller;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.utils.SortedDoubleMap;

/**
 + * The speed controller used to slow down the train from the announce of a speed limit up to its enforcement signal.
 + */

public class BrakingSpeedController extends MapSpeedController {
    public BrakingSpeedController(SortedDoubleMap values, double begin, double end) {
        super(values, begin, end);
    }

    public BrakingSpeedController(SortedDoubleMap values) {
        super(values);
    }

    @Override
    public String toString() {
        var targetSpeedLimit = values.lastEntry().getValue();
        return String.format("LimitAnnounceSpeedController { targetSpeed=%.3f, begin=%.3f, end=%.3f }",
                targetSpeedLimit, beginPosition, endPosition);
    }

    @Override
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    public boolean deepEquals(SpeedController other) {
        if (!equalRange(other))
            return false;
        if (other.getClass() != BrakingSpeedController.class)
            return false;
        var o = (BrakingSpeedController) other;
        return o.values.equals(values);
    }
}

