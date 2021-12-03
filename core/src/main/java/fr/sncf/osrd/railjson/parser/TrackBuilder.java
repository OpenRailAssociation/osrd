package fr.sncf.osrd.railjson.parser;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.utils.PointSequence;

import java.util.stream.Collectors;

public class TrackBuilder {
    private final TrackSection track;
    public final PointSequence.Builder<OperationalPoint> opBuilder;
    public final PointSequence.Builder<Waypoint> waypointsBuilder;
    public final PointSequence.Builder<Signal> signalsBuilder;

    public TrackBuilder(TrackSection track) {
        this.track = track;
        opBuilder = track.operationalPoints.builder();
        waypointsBuilder = track.waypoints.builder();
        signalsBuilder = track.signals.builder();
    }

    public void build() throws InvalidInfraException {
        opBuilder.build();
        signalsBuilder.build();
        waypointsBuilder.buildUnique((duplicates) -> {
            var ids = duplicates.stream().map(e -> e.id).collect(Collectors.joining(", "));
            throw new InvalidInfraException("duplicate waypoints " + ids);
        });

    }
}
