package fr.sncf.osrd.api;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
import org.takes.Request;
import org.takes.Response;
import org.takes.Take;
import org.takes.rq.RqPrint;
import org.takes.rs.*;


public class InfraLoadEndpoint implements Take {
    private final InfraManager infraManager;

    public static final JsonAdapter<InfraLoadRequest> adapterRequest = new Moshi
            .Builder()
            .build()
            .adapter(InfraLoadRequest.class);

    public InfraLoadEndpoint(InfraManager infraManager) {
        this.infraManager = infraManager;
    }

    @Override
    public Response act(Request req) {
        var recorder = new DiagnosticRecorderImpl(false);
        try {
            // Parse request input
            var body = new RqPrint(req).printBody();
            var request = adapterRequest.fromJson(body);
            if (request == null)
                return new RsWithStatus(new RsText("missing request body"), 400);

            // load infra
            infraManager.load(request.infra, request.expectedVersion, recorder);

            return new RsWithStatus(new RsWithType(
                    new RsWithBody("Infra loaded"),
                    "text/html"), 200);
        } catch (Throwable ex) {
            // TODO: include warnings in the response
            return ExceptionHandler.handle(ex);
        }
    }

    public static final class InfraLoadRequest {
        /**
         * Infra id
         */
        public String infra;

        /**
         * Infra version
         */
        @Json(name = "expected_version")
        public String expectedVersion;
        
        /**
         * Create InfraLoadRequest
         */
        public InfraLoadRequest(
                String infra,
                String expectedVersion
        ) {
            this.infra = infra;
            this.expectedVersion = expectedVersion;
        }
    }
}

