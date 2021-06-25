package fr.sncf.osrd.api;

import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.api.SimulationEndpoint.SimulationResultChange.ResponsePhaseEndUpdate;
import fr.sncf.osrd.railjson.schema.RJSSimulation;
import fr.sncf.osrd.utils.moshi.MoshiUtils;
import org.junit.jupiter.api.Test;
import org.takes.rq.RqFake;
import org.takes.rs.RsPrint;

import java.nio.file.Paths;
import java.util.Arrays;
import java.util.stream.Collectors;

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
        assert simResultChanges != null;
        for (int i = 1; i < simResultChanges.length; i++)
            assert simResultChanges[i - 1].time <= simResultChanges[i].time;
    }

    @Test
    public void oneSingleEndPhase() throws Exception {
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
        assert simResultChanges != null;

        var nPhaseEnd = Arrays.stream(simResultChanges)
                .filter(change -> change instanceof ResponsePhaseEndUpdate)
                .count();
        assertEquals(1, nPhaseEnd);
    }
}
