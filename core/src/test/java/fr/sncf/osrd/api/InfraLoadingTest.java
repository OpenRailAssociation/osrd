package fr.sncf.osrd.api;

import static fr.sncf.osrd.utils.takes.TakesUtils.readHeadResponse;
import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.takes.rq.RqFake;
import java.io.IOException;


public class InfraLoadingTest extends ApiTest {
    @ParameterizedTest
    @CsvSource({ "true, 400", "false, 204" })
    public void infraLoadEndpoint_act_request_returns_correct_responses(
            boolean isRequestNull, String expectedStatusCode)
            throws IOException {
        var request = isRequestNull ? null
                : new InfraLoadEndpoint.InfraLoadRequest("tiny_infra/infra.json", "1");
        var requestBody = InfraLoadEndpoint.adapterRequest.toJson(request);
        var list = readHeadResponse(new InfraLoadEndpoint(infraManager)
                .act(new RqFake("POST", "/infra_load", requestBody))
        );
        assertTrue(list.get(0).contains(expectedStatusCode));
    }
}

