package fr.sncf.osrd.api;

import static fr.sncf.osrd.railjson.parser.RJSParser.parseRailJSONFromFile;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.infra.implementation.signaling.SignalingInfraBuilder;
import fr.sncf.osrd.infra.implementation.signaling.modules.bal3.BAL3;
import fr.sncf.osrd.reporting.warnings.WarningRecorderImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.Set;

@ExtendWith(MockitoExtension.class)
public class ApiTest {
    @Mock
    static InfraManager infraHandlerMock;

    /**
     * Setup infra handler mock
     */
    @BeforeEach
    public void setUp() throws InterruptedException {
        ArgumentCaptor<String> argument = ArgumentCaptor.forClass(String.class);
        var wr = new WarningRecorderImpl(true);
        lenient().when(infraHandlerMock.load(argument.capture(), any(), any())).thenAnswer(
                invocation ->
                        SignalingInfraBuilder.fromRJSInfra(
                                parseRailJSONFromFile(
                                        Helpers.getResourcePath(argument.getValue()).toString()
                                ), Set.of(new BAL3(wr)),
                                wr
                        )
        );
    }
}
