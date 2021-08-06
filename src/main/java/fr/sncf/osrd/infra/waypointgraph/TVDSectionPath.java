package fr.sncf.osrd.infra.waypointgraph;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.utils.graph.BiNEdge;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;

import java.util.ArrayList;
import java.util.Arrays;

public class TVDSectionPath extends BiNEdge<TVDSectionPath> {
    public TVDSection tvdSection = null;
    private final TrackSectionRange[] trackSectionsForward;
    private final TrackSectionRange[] trackSectionsBackward;

    /** Return the direction of the waypoint at the given endpoint relative to the TrackSection */
    public EdgeDirection nodeDirection(EdgeDirection direction, EdgeEndpoint endpoint) {
        var trackSections = getTrackSections(direction);
        if (endpoint == EdgeEndpoint.BEGIN)
            return trackSections[0].direction;
        return trackSections[trackSections.length - 1].direction;
    }

    /** Return the list of TrackSectionRange composing the TvdSectionPath */
    @SuppressFBWarnings({"EI_EXPOSE_REP"})
    public TrackSectionRange[] getTrackSections(EdgeDirection direction) {
        if (direction == EdgeDirection.START_TO_STOP)
            return trackSectionsForward;
        return trackSectionsBackward;
    }

    TVDSectionPath(
            WaypointGraph graph,
            int startNode,
            int endNode,
            double length,
            ArrayList<TrackSectionRange> trackSections
    ) {
        super(graph.nextEdgeIndex(), startNode, endNode, length);
        this.trackSectionsForward = trackSections.toArray(new TrackSectionRange[trackSections.size()]);
        this.trackSectionsBackward
                = reverseTrackSections(trackSections).toArray(new TrackSectionRange[trackSections.size()]);
        graph.registerEdge(this);
    }

    private static ArrayList<TrackSectionRange> reverseTrackSections(ArrayList<TrackSectionRange> trackSections) {
        var reversedTrackSections = new ArrayList<TrackSectionRange>();
        for (var i = trackSections.size() - 1; i >= 0; i--) {
            var trackSection = trackSections.get(i);
            reversedTrackSections.add(trackSection.opposite());
        }
        return reversedTrackSections;
    }

    @Override
    public String toString() {
        return String.format("TVD section path {tvd=%s, sections forward=%s, sections backward=%s}",
                tvdSection, Arrays.toString(trackSectionsForward), Arrays.toString(trackSectionsBackward));
    }
}
