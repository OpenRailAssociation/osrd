package fr.sncf.osrd.train;

import com.badlogic.ashley.signals.Listener;
import com.badlogic.ashley.signals.Signal;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.Track;
import fr.sncf.osrd.infra.topological.TopoEdge;
import fr.sncf.osrd.util.StairSequence;

import java.util.HashMap;

public class TrainMetadataTracker {
    private final Infra infra;
    private final TrainPositionTracker positionTracker;

    public TrainMetadataTracker(Infra infra, TrainPositionTracker positionTracker) {
        this.infra = infra;
        this.positionTracker = positionTracker;

        // this variable is captured inside the closures. don't remove it.
        var metadataTracker = this;

        positionTracker.joinedEdgeSignal.add(new Listener<TopoEdge>() {
            @Override
            public void receive(Signal<TopoEdge> signal, TopoEdge edge) {
                metadataTracker.joinedEdgeEventHandler(edge);
            }
        });

        positionTracker.joinedEdgeSignal.add(new Listener<TopoEdge>() {
            @Override
            public void receive(Signal<TopoEdge> signal, TopoEdge edge) {
                metadataTracker.leftEdgeEventHandler(edge);
            }
        });
    }

    private class TrackData {
        /** The number of active edges currently on this track. */
        public int references = 1;
        public final Track track;

        TrackData(Track track) {
            this.track = track;
        }
    }

    /**
     * This field kind of behaves as a multiset with data attached.
     * Each track has a cache structure, which is kept as long as
     * there are active edges from this track.
     */
    HashMap<Track, TrackData> activeTracks = new HashMap<>();

    private void joinedEdgeEventHandler(TopoEdge edge) {
        // get or create the track cache
        TrackData trackData = activeTracks.get(edge.track);
        if (trackData != null)
            trackData.references++;
        else {
            trackData = new TrackData(edge.track);
            activeTracks.put(edge.track, trackData);
        }
    }

    private void leftEdgeEventHandler(TopoEdge edge) {
        // drop a reference to the track cache entry
        TrackData trackData = activeTracks.get(edge.track);
        if (trackData.references == 1) {
            activeTracks.remove(edge.track);
        } else {
            trackData.references -= 1;
        }
    }
}
