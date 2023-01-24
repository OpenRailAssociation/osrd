package fr.sncf.osrd.api;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public abstract class APIClient {

    final OkHttpClient httpClient;
    final String baseUrl;
    final String authorizationToken;

    APIClient(String baseUrl, String authorizationToken, OkHttpClient httpClient) {
        this.baseUrl = baseUrl;
        this.authorizationToken = authorizationToken;
        this.httpClient = httpClient;
    }

    Request buildRequest(String endpointPath) {
        var builder = new Request.Builder().url(baseUrl + endpointPath);
        if (authorizationToken != null)
            builder = builder.header("Authorization", authorizationToken);
        return builder.build();
    }

    public static final class UnexpectedHttpResponse extends Exception {
        private static final long serialVersionUID = 1052450937805248669L;

        public final transient Response response;

        UnexpectedHttpResponse(Response response) {
            super(String.format("unexpected http response %d", response.code()));
            this.response = response;
        }

        @Override
        public String toString() {
            return super.toString() + ": " + response.toString();
        }
    }
}
