package fr.sncf.osrd.api;

import static fr.sncf.osrd.utils.takes.TakesUtils.readBodyResponse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
import org.junit.jupiter.api.Test;
import org.takes.rq.RqFake;
import java.io.IOException;
import java.util.Map;



public class InfraCacheStatusTest extends ApiTest {

    /**  */
    public Map<String, InfraCacheStatusEndpoint.SerializedInfraCache>
            runInfraCacheStatus(InfraCacheStatusEndpoint.InfraCacheRequest request)
            throws IOException {
        // serialize the request
        var requestBody = InfraCacheStatusEndpoint.adapterRequest.toJson(request);

        // process it
        var rawResponse = readBodyResponse(new InfraCacheStatusEndpoint(infraManager)
                        .act(new RqFake("POST", "/cache_status", requestBody))
                );

        // parse the response
        var response = InfraCacheStatusEndpoint.adapter.fromJson(rawResponse);
        assertNotNull(response);
        return response;
    }

    @Test
    public void simple() throws Exception {
        var recorder = new DiagnosticRecorderImpl(false);
        var query = new InfraCacheStatusEndpoint.InfraCacheRequest(
                "tiny_infra/infra.json"
        );
        infraManager.load("tiny_infra/infra.json",
                "1", recorder);
        var res = runInfraCacheStatus(query);
        var response = res.get("tiny_infra/infra.json");
        assertEquals(InfraManager.InfraStatus.CACHED, response.status);
    }
}