package fr.sncf.osrd.api;

import fr.sncf.osrd.railjson.schema.RJSSimulation;
import fr.sncf.osrd.utils.moshi.MoshiUtils;
import org.junit.jupiter.api.Test;
import org.takes.rq.RqFake;
import org.takes.rs.RsPrint;

import java.nio.file.Paths;

public class SimulationTest extends ApiTest {
    @Test
    public void simple() throws Exception {
        ClassLoader classLoader = getClass().getClassLoader();
        var simulationPath = classLoader.getResource("tiny_infra/simulation.json");
        assert simulationPath != null;

        var rjsSimulation = MoshiUtils.deserialize(RJSSimulation.adapter, Paths.get(simulationPath.toURI()));
        var requestBody = SimulationEndpoint.adapterRequest.toJson(new SimulationEndpoint.SimulationRequest(
                        "tiny_infra/infra.json",
                        rjsSimulation.rollingStocks,
                        rjsSimulation.trainSchedules
                ));
        var result = new RsPrint(
                new SimulationEndpoint(infraHandlerMock).act(new RqFake("POST", "/simulation", requestBody))
        ).printBody();

        var simResultChanges =  SimulationEndpoint.adapterResult.fromJson(result);
        for (int i = 1; i < simResultChanges.length; i++)
            assert simResultChanges[i - 1].time <= simResultChanges[i].time;
    }
}
