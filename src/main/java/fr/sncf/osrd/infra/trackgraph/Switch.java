package fr.sncf.osrd.infra.trackgraph;

import fr.sncf.osrd.infra.signaling.Signal;

import java.util.ArrayList;

public class Switch extends TrackNode {
    public final int switchIndex;
    public final double positionChangeDelay;
    public TrackSection leftTrackSection;
    public TrackSection rightTrackSection;
    public ArrayList<Signal> signalSubscribers;

    Switch(
            TrackGraph graph,
            int index,
            String id,
            int switchIndex,
            double positionChangeDelay) {
        super(index, id);
        this.switchIndex = switchIndex;
        this.positionChangeDelay = positionChangeDelay;
        this.signalSubscribers = new ArrayList<>();
        graph.registerNode(this);
    }
}
