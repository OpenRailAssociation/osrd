package fr.sncf.osrd.api;

import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.config.JsonConfig;
import fr.sncf.osrd.infra.Infra;
import org.junit.jupiter.api.Test;
import org.takes.rq.RqFake;
import org.takes.rs.RsPrint;

import java.nio.file.Files;
import java.nio.file.Paths;

public class SimulationTest {
    @Test
    public void simple() throws Exception {
        ClassLoader classLoader = getClass().getClassLoader();
        var infraPath = classLoader.getResource("tiny_infra/infra.json");
        assert infraPath != null;
        var infra = Infra.parseFromFile(JsonConfig.InfraType.UNKNOWN, infraPath.getFile());
        var simulationPath = classLoader.getResource("tiny_infra/simulation.json");
        assert simulationPath != null;

        var requestBody = Files.readString(Paths.get(simulationPath.getPath()));
        var result = new RsPrint(
                new SimulationEndpoint(infra).act(new RqFake("POST", "/simulation", requestBody))
        ).printBody();

        assertEquals("ok", result);
    }
}
