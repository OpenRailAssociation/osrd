package fr.sncf.osrd.api;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import com.squareup.moshi.Types;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import org.takes.Request;
import org.takes.Response;
import org.takes.Take;
import org.takes.rq.RqPrint;
import org.takes.rs.RsJson;
import org.takes.rs.RsText;
import org.takes.rs.RsWithBody;
import org.takes.rs.RsWithStatus;

import java.io.IOException;
import java.util.*;

public class ProjectionEndpoint implements Take {
    private final InfraHandler infraHandler;

    public static final JsonAdapter<ProjectionRequest> adapterRequest = new Moshi
            .Builder()
            .add(ObjectRequest.adapter)
            .build()
            .adapter(ProjectionRequest.class);

    public static final JsonAdapter<List<Double>> adapterResult = new Moshi
            .Builder()
            .build()
            .adapter(Types.newParameterizedType(List.class, String.class));

    public ProjectionEndpoint(InfraHandler infraHandler) {
        this.infraHandler = infraHandler;
    }

    @Override
    public Response act(Request req) throws IOException {
        // Parse request input
        var body = new RqPrint(req).printBody();
        var request = adapterRequest.fromJson(body);
        if (request == null)
            return new RsWithStatus(new RsText("missing request body"), 400);

        // load infra
        Infra infra;
        try {
            infra = infraHandler.load(request.infra);
        } catch (InvalidInfraException | IOException e) {
            return new RsWithStatus(new RsText(
                    String.format("Error loading infrastructure '%s'%n%s", request.infra, e.getMessage())), 400);
        }

        var projectionResult = new ArrayList<Double>();
        return new RsJson(new RsWithBody(adapterResult.toJson(projectionResult)));
    }

    public static final class ProjectionRequest {
        /** Infra id */
        public final String infra;

        /** A list of trains plannings */
        public List<TrackSectionRangeRequest> line;

        public List<ObjectRequest> objects;

        /** Create SimulationRequest */
        public ProjectionRequest(
                String infra,
                ArrayList<TrackSectionRangeRequest> line,
                ArrayList<ObjectRequest> objects
        ) {
            this.infra = infra;
            this.line = line;
            this.objects = objects;
        }
    }

    public abstract static class ObjectRequest {
        // TODO
        public static final PolymorphicJsonAdapterFactory<ObjectRequest> adapter = (
                PolymorphicJsonAdapterFactory.of(ObjectRequest.class, "type")
                        // boolean operators
                        .withSubtype(ObjectRequest.Signal.class, "signal")
                        .withSubtype(TrackPosition.class, "track_position")
        );

        private static final class Signal extends ObjectRequest {
            private final String id;

            public Signal(String id) {
                this.id = id;
            }
        }

        private static final class TrackPosition extends ObjectRequest {
            @Json(name = "track_section")
            private final String trackSection;
            private final double offset;

            public TrackPosition(String trackSection, double offset) {
                this.trackSection = trackSection;
                this.offset = offset;
            }
        }

    }

    @SuppressFBWarnings({"URF_UNREAD_FIELD"})
    protected static class TrackSectionRangeRequest {
        @Json(name = "track_section")
        private final String trackSection;
        @Json(name = "begin_position")
        private final double beginPosition;
        @Json(name = "end_position")
        private final double endPosition;

        protected TrackSectionRangeRequest(String trackSection, double beginPosition, double endPosition) {
            this.trackSection = trackSection;
            this.beginPosition = beginPosition;
            this.endPosition = endPosition;
        }

        public TrackSectionRange parse(Infra infra) {
            var track = infra.trackGraph.trackSectionMap.get(trackSection);
            if (track == null)
                return null;
            var dir = beginPosition > endPosition ? EdgeDirection.STOP_TO_START : EdgeDirection.START_TO_STOP;
            return new TrackSectionRange(track, dir, beginPosition, endPosition);
        }
    }
}
