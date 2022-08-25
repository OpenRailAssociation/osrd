package fr.sncf.osrd.api.stdcm;

import com.google.common.base.MoreObjects;
import fr.sncf.osrd.infra.api.signaling.Signal;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;

public final class Block {
    public final SignalingRoute route;

    public final Signal<?> entrySig;

    public final Signal<?> exitSig;

    public final String id;

    public final double length;

    public final double maxSpeed;

    /** Creates a fixed-size signaling block */
    public Block(
            SignalingRoute route,
            Signal<?> entrySig,
            Signal<?> exitSig,
            String id,
            double length,
            double maxSpeed
    ) {
        this.route = route;
        this.entrySig = entrySig;
        this.exitSig = exitSig;
        this.id = id;
        this.length = length;
        this.maxSpeed = maxSpeed;
    }

    public double getLength() {
        return route.getInfraRoute().getLength();
    }

    public double getMaxSpeed() {
        return maxSpeed;
    }

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("route", route.getInfraRoute().getID())
                .add("id", id)
                .add("length", length)
                .add("maxSpeed", maxSpeed)
                .toString();
    }
}
