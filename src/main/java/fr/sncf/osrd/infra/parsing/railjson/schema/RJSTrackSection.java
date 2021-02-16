package fr.sncf.osrd.infra.parsing.railjson.schema;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.graph.EdgeEndpoint;
import fr.sncf.osrd.infra.parsing.railjson.schema.trackobjects.RJSBufferStop;
import fr.sncf.osrd.infra.parsing.railjson.schema.trackranges.RJSOperationalPointPart;
import fr.sncf.osrd.infra.parsing.railjson.schema.trackobjects.RJSTrainDetector;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSTrackSection implements Identified {
    public final String id;
    public final double length;

    /** Track objects */
    public final List<RJSTrainDetector> trainDetectors;
    public final List<RJSBufferStop> bufferStops;

    /** Track ranges */
    public final List<RJSOperationalPointPart> operationalPoints;

    /** Creates a new track section */
    public RJSTrackSection(
            String id,
            double length,
            List<RJSTrainDetector> trainDetectors,
            List<RJSBufferStop> bufferStops,
            List<RJSOperationalPointPart> operationalPoints
    ) {
        this.id = id;
        this.length = length;
        this.trainDetectors = trainDetectors;
        this.bufferStops = bufferStops;
        this.operationalPoints = operationalPoints;
    }

    public RJSTrackSection(
            String id,
            double length
    ) {
        this(id, length, new ArrayList<>(), new ArrayList<>(), new ArrayList<>());
    }

    @Override
    public String getID() {
        return id;
    }

    public EndpointID beginEndpoint() {
        return new EndpointID(ID.from(this), EdgeEndpoint.BEGIN);
    }

    public EndpointID endEndpoint() {
        return new EndpointID(ID.from(this), EdgeEndpoint.END);
    }

    /** An identifier for a side of a specific track section */
    public static final class EndpointID {
        public final ID<RJSTrackSection> section;
        public final EdgeEndpoint endpoint;

        public EndpointID(ID<RJSTrackSection> section, EdgeEndpoint endpoint) {
            this.section = section;
            this.endpoint = endpoint;
        }

        @Override
        public int hashCode() {
            return Objects.hash(section, endpoint);
        }

        @Override
        public boolean equals(Object obj) {
            if (obj == null)
                return false;
            if (obj.getClass() != EndpointID.class)
                return false;
            var o = (EndpointID) obj;
            return section.equals(o.section) && endpoint.equals(o.endpoint);
        }

        @Override
        public String toString() {
            return String.format(
                    "RJSTrackSection.EndpointID { section=%s, endpoint=%s }",
                    section.id, endpoint.toString()
            );
        }
    }
}
