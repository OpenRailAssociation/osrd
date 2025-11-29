package fr.sncf.osrd.api;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.cli.Request;
import fr.sncf.osrd.cli.Response;
import fr.sncf.osrd.cli.RsText;
import fr.sncf.osrd.cli.RsWithBody;
import fr.sncf.osrd.cli.RsWithStatus;
import fr.sncf.osrd.cli.Take;
import org.jetbrains.annotations.NotNull;

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
    public @NotNull Response act(@NotNull Request req) {
        try {
            // Parse request input
            var body = req.body();
            var request = adapterRequest.fromJson(body);
            if (request == null) return new RsWithStatus(new RsText("missing request body"), 400);

            // load infra and timetable
            var infra = infraManager.load(request.infra, request.expectedVersion);
            if (request.timetable != null) timetableManager.load(request.infra, infra.rawInfra(), request.timetable);

            return new RsWithStatus(new RsWithBody(""), 204);
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
