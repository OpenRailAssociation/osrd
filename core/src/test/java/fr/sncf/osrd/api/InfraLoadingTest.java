package fr.sncf.osrd.api;

import static fr.sncf.osrd.utils.takes.TakesUtils.readBodyResponse;
import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.takes.rq.RqFake;
import java.io.IOException;


public class InfraLoadingTest extends ApiTest {

    /**  */
    public String runInfraLoad(InfraLoadEndpoint.InfraLoadRequest request) throws IOException {
        // serialize the request
        var requestBody = InfraLoadEndpoint.adapterRequest.toJson(request);

        // process it
        return readBodyResponse(new InfraLoadEndpoint(infraHandlerMock)
                        .act(new RqFake("POST", "/infra_load", requestBody))
                );

    }

    @Test
    public void simple() throws Exception {
        var query = new InfraLoadEndpoint.InfraLoadRequest(
                "tiny_infra/infra.json",
                "1"
        );
        assertEquals("Infra loaded", runInfraLoad(query));
    }
}