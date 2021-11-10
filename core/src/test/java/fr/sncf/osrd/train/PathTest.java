package fr.sncf.osrd.train;

import static fr.sncf.osrd.Helpers.*;
import static fr.sncf.osrd.infra.Infra.parseFromFile;
import static org.junit.jupiter.api.Assertions.assertThrows;

import fr.sncf.osrd.config.JsonConfig;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.parser.RJSSimulationParser;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.RJSSimulation;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.RJSRoute;
import fr.sncf.osrd.utils.PathUtils;
import fr.sncf.osrd.utils.moshi.MoshiUtils;
import org.junit.jupiter.api.Test;
import java.io.IOException;

public class PathTest {

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    public void testInvalidPathDoubleFirstRoute() throws IOException, InvalidInfraException, InvalidRollingStock {
        var path = getResourcePath("tiny_infra/config_railjson.json");
        var baseDirPath = path.getParent();
        var jsonConfig = MoshiUtils.deserialize(JsonConfig.adapter, path);
        final var infraPath = PathUtils.relativeTo(baseDirPath, jsonConfig.infraPath);
        final var rjsInfra = parseFromFile(jsonConfig.infraType, infraPath.toString());
        var schedulePath = PathUtils.relativeTo(baseDirPath, jsonConfig.simulationPath);
        var schedule = MoshiUtils.deserialize(RJSSimulation.adapter, schedulePath);

        schedule.trainSchedules.forEach(s -> {
            s.routes = (ID<RJSRoute>[]) new ID[]{
                    new ID<RJSRoute>("rt.C3-S7"),
                    new ID<RJSRoute>("rt.C3-S7"),
                    new ID<RJSRoute>("rt.S7-buffer_stop_c"),
            };
            s.initialHeadLocation.trackSection = new ID<>("ne.micro.foo_to_bar");
            s.initialHeadLocation.offset = 100;
        });

        assertThrows(InvalidSchedule.class, () -> RJSSimulationParser.parse(rjsInfra, schedule));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    public void testInvalidPathDoubleLastRoute() throws IOException, InvalidInfraException, InvalidRollingStock {
        var path = getResourcePath("tiny_infra/config_railjson.json");
        var baseDirPath = path.getParent();
        var jsonConfig = MoshiUtils.deserialize(JsonConfig.adapter, path);
        final var infraPath = PathUtils.relativeTo(baseDirPath, jsonConfig.infraPath);
        final var rjsInfra = parseFromFile(jsonConfig.infraType, infraPath.toString());
        var schedulePath = PathUtils.relativeTo(baseDirPath, jsonConfig.simulationPath);
        var schedule = MoshiUtils.deserialize(RJSSimulation.adapter, schedulePath);

        schedule.trainSchedules.forEach(s -> {
            s.routes = (ID<RJSRoute>[]) new ID[]{
                    new ID<RJSRoute>("rt.C3-S7"),
                    new ID<RJSRoute>("rt.S7-buffer_stop_c"),
                    new ID<RJSRoute>("rt.S7-buffer_stop_c"),
            };
            s.initialHeadLocation.trackSection = new ID<>("ne.micro.foo_to_bar");
            s.initialHeadLocation.offset = 100;
        });

        assertThrows(InvalidSchedule.class, () -> RJSSimulationParser.parse(rjsInfra, schedule));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    public void testInvalidPathDuplicateMiddleRoute() throws IOException, InvalidInfraException, InvalidRollingStock {
        var path = getResourcePath("tiny_infra/config_railjson.json");
        var baseDirPath = path.getParent();
        var jsonConfig = MoshiUtils.deserialize(JsonConfig.adapter, path);
        final var infraPath = PathUtils.relativeTo(baseDirPath, jsonConfig.infraPath);
        final var rjsInfra = parseFromFile(jsonConfig.infraType, infraPath.toString());
        var schedulePath = PathUtils.relativeTo(baseDirPath, jsonConfig.simulationPath);
        var schedule = MoshiUtils.deserialize(RJSSimulation.adapter, schedulePath);

        schedule.trainSchedules.forEach(s -> s.routes = (ID<RJSRoute>[]) new ID[]{
                new ID<RJSRoute>("rt.buffer_stop_b-C3"),
                new ID<RJSRoute>("rt.C3-S7"),
                new ID<RJSRoute>("rt.C3-S7"),
                new ID<RJSRoute>("rt.S7-buffer_stop_c"),
        });

        assertThrows(InvalidSchedule.class, () -> RJSSimulationParser.parse(rjsInfra, schedule));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    public void testInvalidPathBeginNotOnPath() throws IOException, InvalidInfraException, InvalidRollingStock {
        var path = getResourcePath("tiny_infra/config_railjson.json");
        var baseDirPath = path.getParent();
        var jsonConfig = MoshiUtils.deserialize(JsonConfig.adapter, path);
        final var infraPath = PathUtils.relativeTo(baseDirPath, jsonConfig.infraPath);
        final var rjsInfra = parseFromFile(jsonConfig.infraType, infraPath.toString());
        var schedulePath = PathUtils.relativeTo(baseDirPath, jsonConfig.simulationPath);
        var schedule = MoshiUtils.deserialize(RJSSimulation.adapter, schedulePath);

        schedule.trainSchedules.forEach(s -> {
            s.routes = (ID<RJSRoute>[]) new ID[]{
                    new ID<RJSRoute>("rt.C3-S7"),
            };
            s.initialHeadLocation.trackSection = new ID<>("ne.micro.foo_to_bar");
            s.initialHeadLocation.offset = 100;
        });

        assertThrows(InvalidSchedule.class, () -> RJSSimulationParser.parse(rjsInfra, schedule));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    public void testInvalidPathInvertedRoutes() throws IOException, InvalidInfraException, InvalidRollingStock {
        var path = getResourcePath("tiny_infra/config_railjson.json");
        var baseDirPath = path.getParent();
        var jsonConfig = MoshiUtils.deserialize(JsonConfig.adapter, path);
        final var infraPath = PathUtils.relativeTo(baseDirPath, jsonConfig.infraPath);
        final var rjsInfra = parseFromFile(jsonConfig.infraType, infraPath.toString());
        var schedulePath = PathUtils.relativeTo(baseDirPath, jsonConfig.simulationPath);
        var schedule = MoshiUtils.deserialize(RJSSimulation.adapter, schedulePath);

        schedule.trainSchedules.forEach(s -> {
            s.routes = (ID<RJSRoute>[]) new ID[]{
                    new ID<RJSRoute>("rt.S7-buffer_stop_c"),
                    new ID<RJSRoute>("rt.C3-S7"),
            };
            s.initialHeadLocation.trackSection = new ID<>("ne.micro.foo_to_bar");
            s.initialHeadLocation.offset = 100;
        });

        assertThrows(InvalidSchedule.class, () -> RJSSimulationParser.parse(rjsInfra, schedule));
    }
}
