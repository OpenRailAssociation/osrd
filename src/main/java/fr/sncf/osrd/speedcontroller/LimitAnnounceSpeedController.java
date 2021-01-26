package fr.sncf.osrd.speedcontroller;

/**
 * The speed controller used to slow down the train from the announce of a speed limit up to its enforcement signal.
 */
public final class LimitAnnounceSpeedController extends SpeedController {
    public final double targetSpeedLimit;
    public final double gamma;

    /**
     * Creates a speed controller meant to slow down the train before a speed limit.
     */
    public LimitAnnounceSpeedController(
            double targetSpeedLimit,
            double startPosition,
            double endPosition,
            double gamma
    ) {
        super(startPosition, endPosition);
        this.targetSpeedLimit = targetSpeedLimit;
        this.gamma = gamma;
    }

    @Override
    public SpeedDirective getDirective(
            double headPosition
    ) {
        var distance = endPosition - headPosition;
        assert distance >= 0;
        var currentLimit = Math.sqrt(targetSpeedLimit * targetSpeedLimit + 2 * distance * gamma);
        return SpeedDirective.allowedOnly(currentLimit);
    }

    @Override
    public String toString() {
        return String.format(
                "LimitAnnounceSpeedController { targetSpeed=%.3f, begin=%.3f, end=%.3f, gamma=%.3f }",
                targetSpeedLimit, beginPosition, endPosition, gamma
        );
    }
}
