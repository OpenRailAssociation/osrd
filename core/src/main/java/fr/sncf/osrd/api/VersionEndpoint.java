package fr.sncf.osrd.api;

import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import com.squareup.moshi.Types;
import org.takes.Request;
import org.takes.Response;
import org.takes.Take;
import org.takes.rs.RsJson;
import org.takes.rs.RsWithBody;
import java.util.HashMap;
import java.util.Map;

public final class VersionEndpoint implements Take {

    private static final JsonAdapter<Map<String, String>> adapter;

    static {
        Moshi moshi = new Moshi.Builder().build();
        var type = Types.newParameterizedType(Map.class, String.class, String.class);
        adapter = moshi.adapter(type);
    }

    @Override
    public Response act(Request req) {
        var response = new HashMap<String, String>();
        var describe = System.getenv().get("OSRD_GIT_DESCRIBE");
        response.put("git_describe", describe);

        return new RsJson(new RsWithBody(adapter.toJson(response)));
    }
}
