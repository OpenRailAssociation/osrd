package fr.sncf.osrd.api;

import java.util.HashMap;
import java.util.Map;
import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import com.squareup.moshi.Types;
import org.takes.Request;
import org.takes.Response;
import org.takes.Take;
import org.takes.rs.RsJson;
import org.takes.rs.RsWithBody;
import fr.sncf.osrd.api.NewInfraManager.InfraCacheEntry;
import fr.sncf.osrd.api.NewInfraManager.InfraStatus;

public final class InfraCacheStatusEndpoint implements Take {
    private final NewInfraManager infraManager;
     

    private static final JsonAdapter<Map<String, SerializedInfraCache>> adapter;

    static {
        Moshi moshi = new Moshi.Builder().build();
        var type = Types.newParameterizedType(Map.class, String.class, SerializedInfraCache.class);
        adapter = moshi.adapter(type);
    }

    public InfraCacheStatusEndpoint(NewInfraManager infraManager) {
        this.infraManager = infraManager;
    }

    @Override
    public Response act(Request req) {
        Map<String, SerializedInfraCache> res = new HashMap<>();
        infraManager.forEach((infraId, infraCacheEntry) -> {
            res.put(infraId, SerializedInfraCache.from(infraCacheEntry));
        });
        return new RsJson(new RsWithBody(adapter.toJson(res)));
    }

    private static final class SerializedInfraCache {
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
}