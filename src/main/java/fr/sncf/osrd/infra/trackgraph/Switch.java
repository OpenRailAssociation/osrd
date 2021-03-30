package fr.sncf.osrd.infra.trackgraph;

import fr.sncf.osrd.infra.signaling.Signal;

import java.util.ArrayList;

public class Switch extends TrackNode {
    public final int switchIndex;
    public TrackSection leftTrackSection;
    public TrackSection rightTrackSection;
    public ArrayList<Signal> signalSubscribers;

    Switch(
            TrackGraph graph,
            int index,
            String id,
            int switchIndex
    ) {
        super(index, id);
        this.switchIndex = switchIndex;
        this.signalSubscribers = new ArrayList<>();
        graph.registerNode(this);
    }
}
