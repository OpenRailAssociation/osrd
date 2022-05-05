package fr.sncf.osrd.cli;

import com.beust.jcommander.Parameter;
import com.beust.jcommander.Parameters;
import fr.sncf.osrd.infra.implementation.signaling.SignalingInfraBuilder;
import fr.sncf.osrd.infra.implementation.signaling.modules.bal3.BAL3;
import fr.sncf.osrd.railjson.parser.RJSParser;
import fr.sncf.osrd.reporting.warnings.WarningRecorderImpl;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.Set;

@Parameters(commandDescription = "Try to load an infra")
public class ValidateInfra implements CliCommand {

    @Parameter(
            names = {"--path" },
            description = "Path to the railjson file to load"
    )
    private String infraPath;

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public int run() {
        try {
            var rjs = RJSParser.parseRailJSONFromFile(infraPath);
            var warningRecorder = new WarningRecorderImpl(false);
            SignalingInfraBuilder.fromRJSInfra(
                    rjs,
                    Set.of(new BAL3(warningRecorder)),
                    warningRecorder
            );
            warningRecorder.report();
            return 0;
        } catch (Exception e) {
            e.printStackTrace();
            return 1;
        }
    }
}
