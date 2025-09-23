package fr.sncf.osrd.api;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import org.takes.Request;
import org.takes.Response;
import org.takes.Take;
import org.takes.rq.RqPrint;
import org.takes.rs.*;

public class WorkerLoadEndpoint implements Take {
    private final InfraManager infraManager;
    private final TimetableCacheManager timetableManager;

    public static final JsonAdapter<WorkerLoadRequest> adapterRequest =
            new Moshi.Builder().build().adapter(WorkerLoadRequest.class);

    public WorkerLoadEndpoint(InfraManager infraManager, TimetableCacheManager timetableManager) {
        this.infraManager = infraManager;
        this.timetableManager = timetableManager;
    }

    @Override
    public Response act(Request req) {
        try {
            // Parse request input
            var body = new RqPrint(req).printBody();
            var request = adapterRequest.fromJson(body);
            if (request == null) return new RsWithStatus(new RsText("missing request body"), 400);

            // load infra and timetable
            var infra = infraManager.load(request.infra, request.expectedVersion);
            if (request.timetable != null) timetableManager.load(request.infra, infra.rawInfra(), request.timetable);

            return new RsWithStatus(204);
        } catch (Throwable ex) {
            // TODO: include warnings in the response
            return ExceptionHandler.handle(ex);
        }
    }

    public static final class WorkerLoadRequest {
        /** Infra id */
        public String infra;

        /** Infra version */
        @Json(name = "expected_version")
        public int expectedVersion;

        /** Timetable ID */
        public Integer timetable;

        /** Create InfraLoadRequest */
        public WorkerLoadRequest(String infra, int expectedVersion, Integer timetable) {
            this.infra = infra;
            this.expectedVersion = expectedVersion;
            this.timetable = timetable;
        }
    }
}
