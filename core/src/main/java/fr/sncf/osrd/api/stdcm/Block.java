package fr.sncf.osrd.api.stdcm;

import fr.sncf.osrd.infra.api.signaling.SignalingRoute;

public final class Block {
    public final SignalingRoute route;

    public final String entrySig;

    public final String exitSig;

    public final String id;

    public final double length;

    public final double maxSpeed;

    public Block(SignalingRoute route, String entrySig, String exitSig, String id, double length, double maxSpeed) {
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
}
