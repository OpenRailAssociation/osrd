package fr.sncf.osrd.api;

import fr.sncf.osrd.infra.Infra;

import java.io.IOException;
import java.util.HashMap;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import okhttp3.OkHttpClient;
import okhttp3.Request;

public class InfraHandler {
    private final HashMap<String, Infra> cache = new HashMap<>();
    private final OkHttpClient client = new OkHttpClient();
    private final String baseUrl;
    private final String authorizationToken;

    public InfraHandler(String baseUrl, String authorizationToken) {
        this.baseUrl = baseUrl;
        this.authorizationToken = authorizationToken;
    }

    private Infra queryInfra(String infraId) throws IOException, InvalidInfraException {
        // create a request
        var builder = new Request.Builder();
        if (authorizationToken != null)
                builder = builder.header("Authorization", authorizationToken);
        var request = builder.url(String.format("%sinfra/%s/railjson/", baseUrl, infraId)).build();

        // use the client to send the request
        var response = client.newCall(request).execute();
        if (!response.isSuccessful()) throw new IOException("Unexpected code " + response);

        // Parse the response
        var body = response.body();
        assert body != null;
        var rjsInfra = RJSInfra.adapter.fromJson(body.source());
        if (rjsInfra == null)
            throw new IOException("RJSInfra is null");
        return RailJSONParser.parse(rjsInfra);
    }

    /** Load an infra given an id. Cache infra for optimized future call */
    public Infra load(String infraId) throws IOException, InvalidInfraException {
        var cachedInfra = cache.get(infraId);
        if (cachedInfra != null)
            return cachedInfra;

        // Query infra
        var infra = queryInfra(infraId);

        // Cache the infra
        cache.put(infraId, infra);
        return infra;
    }
}
