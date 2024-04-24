package fr.sncf.osrd.api;

import static fr.sncf.osrd.api.pathfinding.PathPropUtilsKt.makeChunkPath;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceValue;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPath;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
import fr.sncf.osrd.reporting.warnings.Warning;
import fr.sncf.osrd.standalone_sim.SignalProjectionKt;
import fr.sncf.osrd.standalone_sim.result.ResultTrain;
import fr.sncf.osrd.standalone_sim.result.SignalUpdate;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import java.util.ArrayList;
import java.util.List;
import org.jetbrains.annotations.NotNull;
import org.takes.Request;
import org.takes.Response;
import org.takes.Take;
import org.takes.rq.RqPrint;
import org.takes.rs.RsJson;
import org.takes.rs.RsText;
import org.takes.rs.RsWithBody;
import org.takes.rs.RsWithStatus;

public class SignalProjectionEndpoint implements Take {

    private final InfraManager infraManager;

    public SignalProjectionEndpoint(InfraManager infraManager) {
        this.infraManager = infraManager;
    }

    public static final JsonAdapter<SignalProjectionEndpoint.SignalProjectionRequest> adapterRequest =
            new Moshi.Builder()
                    .add(ID.Adapter.FACTORY)
                    .add(RJSRollingResistance.adapter)
                    .add(RJSAllowance.adapter)
                    .add(RJSAllowanceValue.adapter)
                    .build()
                    .adapter(SignalProjectionEndpoint.SignalProjectionRequest.class);

    @Override
    @WithSpan
    public Response act(Request req) throws Exception {
        var recorder = new DiagnosticRecorderImpl(false);
        try {
            // Parse request input
            var body = new RqPrint(req).printBody();
            var request = adapterRequest.fromJson(body);
            if (request == null) return new RsWithStatus(new RsText("missing request body"), 400);

            // get infra
            var infra = infraManager.getInfra(request.infra, request.expectedVersion, recorder);

            // Parse trainPath
            var chunkPath = makeChunkPath(infra.rawInfra(), request.trainPath);
            var routePath = makeRoutePath(infra, request.trainPath);

            var result = SignalProjectionKt.project(
                    infra, chunkPath, routePath, request.signalSightings, request.zoneUpdates);

            result.warnings = recorder.warnings;

            return new RsJson(new RsWithBody(SignalProjectionResult.adapter.toJson(result)));
        } catch (Throwable ex) {
            // TODO: include warnings in the response
            return ExceptionHandler.handle(ex);
        }
    }

    @WithSpan
    private static @NotNull List<Integer> makeRoutePath(FullInfra infra, RJSTrainPath trainPath) {
        return trainPath.routePath.stream()
                .map(rjsRoutePath -> infra.rawInfra().getRouteFromName(rjsRoutePath.route))
                .toList();
    }

    @SuppressFBWarnings("UWF_UNWRITTEN_PUBLIC_OR_PROTECTED_FIELD")
    public static class SignalProjectionRequest {
        /** Infra id */
        public String infra;

        /** Infra version */
        @Json(name = "expected_version")
        public String expectedVersion;

        /** The path used by trains */
        @Json(name = "train_path")
        public RJSTrainPath trainPath;

        @Json(name = "signal_sightings")
        public List<ResultTrain.SignalSighting> signalSightings;

        @Json(name = "zone_updates")
        public List<ResultTrain.ZoneUpdate> zoneUpdates;
    }

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public static class SignalProjectionResult {
        public static final JsonAdapter<SignalProjectionResult> adapter =
                new Moshi.Builder().build().adapter(SignalProjectionResult.class);

        @Json(name = "signal_updates")
        public final List<SignalUpdate> signalUpdates;

        public List<Warning> warnings = new ArrayList<>();

        public SignalProjectionResult(List<SignalUpdate> signalUpdates) {
            this.signalUpdates = signalUpdates;
        }
    }
}
