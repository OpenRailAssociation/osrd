package fr.sncf.osrd.api;

import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public abstract class APIClient {

    final OkHttpClient httpClient;
    final HttpUrl baseUrl;
    final String authenticationHeader;

    APIClient(String baseUrl, String authenticationHeader, OkHttpClient httpClient) {
        this.baseUrl = HttpUrl.parse(baseUrl);
        this.authenticationHeader = authenticationHeader;
        this.httpClient = httpClient;
    }

    Request buildRequest(String endpointPath, String queryParameters) {
        var url = baseUrl.newBuilder()
                .addPathSegments(endpointPath)
                .encodedQuery(queryParameters)
                .build();
        var builder = new Request.Builder().url(url);
        if (authenticationHeader != null) builder = builder.header(authenticationHeader, "");
        return builder.build();
    }

    Request buildRequest(String endpointPath) {
        return buildRequest(endpointPath, null);
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
