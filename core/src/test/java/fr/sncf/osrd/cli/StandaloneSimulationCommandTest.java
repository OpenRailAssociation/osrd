package fr.sncf.osrd.cli;

import static fr.sncf.osrd.Helpers.getResourcePath;

import okio.FileSystem;
import okio.Okio;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import java.io.IOException;
import java.util.stream.Stream;

public class StandaloneSimulationCommandTest {
    static void runOneSim(String infraFilePath, String simFilePath, String destPath) {
        var command = new StandaloneSimulationCommand(infraFilePath, simFilePath, destPath);
        command.run();
    }


    @ParameterizedTest
    @MethodSource("provideInfraParameters")
    public void testRunAllSims(String infraFolder) throws IOException {
        var path = getResourcePath(infraFolder);
        var destPath = path.resolve("result.json").toString();
        runOneSim(
                path.resolve("infra.json").toString(),
                path.resolve("simulation.json").toString(),
                destPath
        );

        try (var source = Okio.buffer(FileSystem.SYSTEM.source(okio.Path.get(destPath)))) {
            var res = StandaloneSimulationCommand.simulationResultAdapter.fromJson(source);
            assert res != null;
        }
    }

    static Stream<Arguments> provideInfraParameters() {
        return Stream.of("tiny_infra", "one_line", "three_trains").map(Arguments::of);
    }


}
