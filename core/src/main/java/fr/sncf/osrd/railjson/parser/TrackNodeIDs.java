package fr.sncf.osrd.railjson.parser;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackEndpoint;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSectionLink;
import fr.sncf.osrd.utils.UnionFind;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class TrackNodeIDs {
    public final int numberOfNodes;

    /** A map from a track section endpoint to a unique endpoint ID */
    private final Map<RJSTrackEndpoint, Integer> endpointIDs;

    /** A map from endpoint IDs to  */
    private final ArrayList<Integer> endpointToNodeID;

    private TrackNodeIDs(int numberOfNodes,
                         Map<RJSTrackEndpoint, Integer> endpointIDs,
                         ArrayList<Integer> endpointToNodeID
    ) {
        this.numberOfNodes = numberOfNodes;
        this.endpointIDs = endpointIDs;
        this.endpointToNodeID = endpointToNodeID;
    }

    /** Assigns node IDs given a list of nodes and relationships. */
    public static TrackNodeIDs from(
            Iterable<RJSTrackSectionLink> links,
            Iterable<RJSTrackSection> trackSections
    ) throws InvalidInfraException {
        var uf = new UnionFind();
        var endpointIDs = new HashMap<RJSTrackEndpoint, Integer>();

        // create an union find group for all known track section endpoints
        for (var trackSection : trackSections) {
            var oldBegin = endpointIDs.put(trackSection.beginEndpoint(), uf.newGroup());
            var oldEnd = endpointIDs.put(trackSection.endEndpoint(), uf.newGroup());
            if (oldBegin != null || oldEnd != null)
                throw new InvalidInfraException(String.format("duplicate track section: %s", trackSection.id));
        }

        // link endpoint IDs together
        for (var link : links) {
            int groupA = endpointIDs.getOrDefault(link.src, -1);
            if (groupA == -1)
                throw new InvalidInfraException(String.format("unknown track section: %s", link.src.track.id.id));

            int groupB = endpointIDs.getOrDefault(link.dst, -1);
            if (groupB == -1)
                throw new InvalidInfraException(String.format("unknown track section: %s", link.dst.track.id.id));

            uf.union(groupA, groupB);
        }

        // get the node ID for all endpoint IDs
        var endpointToNodeID = new ArrayList<Integer>();
        var numberOfNodes = uf.minimize(endpointToNodeID);
        return new TrackNodeIDs(numberOfNodes, endpointIDs, endpointToNodeID);
    }

    /** Get the unique node identifier this endpoint is connected to. */
    public int get(RJSTrackEndpoint endpoint) throws InvalidInfraException {
        Integer index = endpointIDs.get(endpoint);

        if (index == null)
            throw new InvalidInfraException(String.format("unknown endpoint: %s", endpoint.toString()));

        return endpointToNodeID.get(index);
    }
}