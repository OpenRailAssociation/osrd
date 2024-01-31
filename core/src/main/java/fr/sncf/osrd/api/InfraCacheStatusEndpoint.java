package fr.sncf.osrd.api;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import com.squareup.moshi.Types;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.api.InfraManager.InfraCacheEntry;
import fr.sncf.osrd.api.InfraManager.InfraStatus;
import org.takes.Request;
import org.takes.Response;
import org.takes.Take;
import org.takes.rq.RqPrint;
import org.takes.rs.RsJson;
import org.takes.rs.RsWithBody;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

public final class InfraCacheStatusEndpoint implements Take {
    private final InfraManager infraManager;

    public static final JsonAdapter<InfraCacheRequest> adapterRequest = new Moshi
            .Builder()
            .build()
            .adapter(InfraCacheRequest.class);


    public static final JsonAdapter<Map<String, SerializedInfraCache>> adapter;

    static {
        Moshi moshi = new Moshi.Builder().build();
        var type = Types.newParameterizedType(Map.class, String.class, SerializedInfraCache.class);
        adapter = moshi.adapter(type);
    }

    public InfraCacheStatusEndpoint(InfraManager infraManager) {
        this.infraManager = infraManager;
    }

    @Override
    public Response act(Request req) throws IOException {

        Map<String, SerializedInfraCache> res = new HashMap<>();
        // Parse request input
        try {
            var body = new RqPrint(req).printBody();
            String infra = null;
            if (!body.equals("")) {
                infra = adapterRequest.fromJson(body).infra;
            }
            if (infra != null) {
                var request = adapterRequest.fromJson(body);
                var infraCacheEntry = infraManager.getInfraCache(request.infra);
                if (infraCacheEntry != null)
                    res.put(request.infra, SerializedInfraCache.from(infraCacheEntry));
            } else {
                infraManager.forEach((infraId, infraCacheEntry) -> {
                    res.put(infraId, SerializedInfraCache.from(infraCacheEntry));
                });
            }
            return new RsJson(new RsWithBody(adapter.toJson(res)));
        } catch (Throwable ex) {
            // TODO: include warnings in the response
            return ExceptionHandler.handle(ex);
        }
    }

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public static final class SerializedInfraCache {
        public InfraStatus status;

        @Json(name = "last_status")
        public InfraStatus lastStatus;

        public SerializedInfraCache(InfraStatus status, InfraStatus lastStatus) {
            this.status = status;
            this.lastStatus = lastStatus;
        }

        static SerializedInfraCache from(InfraCacheEntry entry) {
            return new SerializedInfraCache(
                    entry.status,
                    entry.lastStatus);
        }
    }

    public static final class InfraCacheRequest {
        /**
         * Infra id
         */
        public String infra;

        public InfraCacheRequest(
                String infra
        ) {
            this.infra = infra;
        }
    }
}
