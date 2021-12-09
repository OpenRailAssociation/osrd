package fr.sncf.osrd;

import static fr.sncf.osrd.Helpers.getResourcePath;
import static fr.sncf.osrd.Helpers.runSimulation;
import static fr.sncf.osrd.config.Config.parseExtraRollingStocks;
import static fr.sncf.osrd.infra.Infra.parseRailJSONFromFile;
import static org.junit.jupiter.api.Assertions.fail;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.config.Config;
import fr.sncf.osrd.config.JsonConfig;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.parser.RJSSimulationParser;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSuccession;
import fr.sncf.osrd.railjson.schema.RJSSimulation;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSpeedSection;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.simulation.changelog.ChangeConsumer;
import fr.sncf.osrd.train.*;
import fr.sncf.osrd.utils.PathUtils;
import fr.sncf.osrd.utils.graph.ApplicableDirection;
import fr.sncf.osrd.utils.moshi.MoshiUtils;
import java.lang.reflect.Field;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.stream.Collectors;


public class TestConfig {
    public RJSInfra rjsInfra;
    public RJSSimulation rjsSimulation;
    public ChangeConsumer changeConsumer = null;
    public HashMap<String, RollingStock> extraRollingStocks;

    private TestConfig(
            RJSInfra rjsInfra,
            RJSSimulation rjsSimulation,
            HashMap<String, RollingStock> extraRollingStocks
    ) {
        this.rjsInfra = rjsInfra;
        this.rjsSimulation = rjsSimulation;
        this.extraRollingStocks = extraRollingStocks;
    }

    public TestConfig withChangeConsumer(ChangeConsumer consumer) {
        this.changeConsumer = consumer;
        return this;
    }

    /** Read the configuration and associated files at the given resource path */
    public static TestConfig readResource(String resourceConfigPath) {
        return read(getResourcePath(resourceConfigPath));
    }

    /** Read the infra and simulation associated files */
    public static TestConfig readResource(String infraPath, String simulationPath) {
        return readResource(infraPath, simulationPath, new ArrayList<>());
    }

    /** Read the infra and simulation associated files */
    public static TestConfig readResource(String infraPath,
                                          String simulationPath,
                                          List<String> rollingStockDirs) {
        var rollingStockDirPaths = rollingStockDirs.stream()
                .map(Helpers::getResourcePath)
                .collect(Collectors.toList());
        return makeConfig(getResourcePath(infraPath),
                getResourcePath(simulationPath),
                rollingStockDirPaths);
    }

    /** Read the configuration at the given path, as well as the associated resources */
    public static TestConfig read(Path configPath) {
        try {
            var jsonConfig = MoshiUtils.deserialize(JsonConfig.adapter, configPath);
            var baseDirPath = configPath.getParent();
            var infraPath = PathUtils.relativeTo(baseDirPath, jsonConfig.infraPath);
            var simulationPath = PathUtils.relativeTo(baseDirPath, jsonConfig.simulationPath);

            var extraRollingStockDirs = new ArrayList<Path>();
            if (jsonConfig.extraRollingStockDirs != null) {
                for (var extraRollingStockDir : jsonConfig.extraRollingStockDirs)
                    extraRollingStockDirs.add(PathUtils.relativeTo(baseDirPath, extraRollingStockDir));
            }
            return makeConfig(infraPath, simulationPath, extraRollingStockDirs);
        } catch (RuntimeException e) {
            fail(e);
            return null;  // appease the compiler
        } catch (Exception e) {
            fail(e);
            return null;  // appease the compiler
        }
    }

    private static TestConfig makeConfig(Path infraPath, Path simulationPath, List<Path> extraRollingStockDirs) {
        try {
            var infra = parseRailJSONFromFile(JsonConfig.InfraType.UNKNOWN, infraPath.toString());
            var simulation = MoshiUtils.deserialize(RJSSimulation.adapter, simulationPath);
            var extraRollingStocks = new HashMap<String, RollingStock>();
            if (extraRollingStockDirs != null) {
                for (var extraRollingStockDir : extraRollingStockDirs)
                    parseExtraRollingStocks(extraRollingStocks, extraRollingStockDir);
            }
            return new TestConfig(infra, simulation, extraRollingStocks);
        } catch (RuntimeException e) {
            fail(e);
            return null;  // appease the compiler
        } catch (Exception e) {
            fail(e);
            return null;  // appease the compiler
        }
    }

    /** Remove all allowances from the given configuration */
    public TestConfig clearAllowances() {
        for (var schedule : rjsSimulation.trainSchedules)
            schedule.allowances = new RJSAllowance[][] {};
        return this;
    }

    /** Remove all slopes from the given configuration */
    public TestConfig clearSlopes() {
        for (var track : rjsInfra.trackSections)
            track.slopes = Collections.emptyList();
        return this;
    }

    /** Remove all signalization constraints from the given configuration */
    public TestConfig clearSignalizationConstraints() {
        for (var aspect : rjsInfra.aspects)
            aspect.constraints = Collections.emptyList();
        return this;
    }

    /** Remove all trains except the first */
    public TestConfig singleTrain() {
        rjsSimulation.trainSchedules = Collections.singletonList(rjsSimulation.trainSchedules.get(0));
        rjsSimulation.trainSuccessionTables = Collections.emptyList();
        return this;
    }

    /** Remove all schedules */
    public TestConfig clearSchedules() {
        rjsSimulation.trainSchedules = new ArrayList<>();
        return this;
    }

    public TestConfig setAllAllowances(RJSAllowance allowance) {
        return setAllAllowances(new RJSAllowance[][] { { allowance } });
    }

    /** Set the allowances of all trains to the given specification */
    public TestConfig setAllAllowances(RJSAllowance[][] allowances) {
        for (var trainSchedule : rjsSimulation.trainSchedules)
            trainSchedule.allowances = allowances;
        return this;
    }

    /** Set a global speed limit on all the train path */
    public TestConfig setGlobalSpeedLimit(double speed) {
        for (var trackSection : rjsInfra.trackSections) {
            trackSection.speedSections =
                    Collections.singletonList(
                            new RJSSpeedSection(ApplicableDirection.BOTH, 0, trackSection.length, speed)
                    );
        }
        return this;
    }

    public static final class TestSimulationState {
        @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
        public final Infra infra;
        public final List<TrainSchedule> schedules;
        public final Config config;
        public final Simulation sim;
        public ArrayList<TimelineEvent> events = null;

        TestSimulationState(
                Infra infra,
                List<TrainSchedule> schedules,
                Config config,
                Simulation sim
        ) {
            this.infra = infra;
            this.schedules = schedules;
            this.config = config;
            this.sim = sim;
        }

        public ArrayList<TimelineEvent> runWithExceptions() throws SimulationError {
            return Helpers.runWithExceptions(sim, config);
        }

        public ArrayList<TimelineEvent> run() {
            events = runSimulation(sim, config);
            return events;
        }

        public List<Train> getTrains() {
            return new ArrayList<>(sim.trains.values());
        }
    }

    /** Resets the tracker cache, avoids tests interfering with each other */
    private static void resetPositionCache() {
        try {
            Field field = TrainPositionTracker.class.getDeclaredField("cachedPositionTrackers");
            field.setAccessible(true);
            field.set(null, new HashMap<List<TrackSectionRange>, TrainPositionTracker>());
        } catch (NoSuchFieldException | IllegalAccessException e) {
            fail(e);
        }
    }

    /** Parse the configuration, and return a package that is ready for execution */
    public TestSimulationState prepare() {
        try {
            resetPositionCache();
            var infra = RailJSONParser.parse(rjsInfra);

            var trainSchedules = RJSSimulationParser.parse(infra, rjsSimulation, extraRollingStocks);
            var config = new Config(
                    infra,
                    trainSchedules,
                    null,
                    0,
                    false,
                    false,
                    true
            );
            var succession = RJSSimulationParser.parseTrainSuccessionTables(rjsSimulation);
            var sim = Simulation.createFromInfraAndSuccessions(infra, succession, 0, changeConsumer);
            return new TestSimulationState(infra, trainSchedules, config, sim);
        } catch (InvalidInfraException | InvalidSuccession | InvalidSchedule | InvalidRollingStock e) {
            fail(e);
            return null;  // appeasing the compiler: this line will never be executed.
        }
    }

    public ArrayList<TimelineEvent> run() {
        return prepare().run();
    }
}
