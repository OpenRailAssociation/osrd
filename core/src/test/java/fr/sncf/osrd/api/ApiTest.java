package fr.sncf.osrd.api;

import static fr.sncf.osrd.infra.Infra.parseRailJSONFromFile;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.api.InfraManager.InfraLoadException;
import fr.sncf.osrd.new_infra.implementation.signaling.SignalingInfraBuilder;
import fr.sncf.osrd.new_infra.implementation.signaling.modules.bal3.BAL3;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.Set;

@ExtendWith(MockitoExtension.class)
public class ApiTest {
    @Mock
    static NewInfraManager infraHandlerMock;

    /**
     * Setup infra handler mock
     */
    @BeforeEach
    public void setUp() throws InfraLoadException, InterruptedException {
        ArgumentCaptor<String> argument = ArgumentCaptor.forClass(String.class);
        when(infraHandlerMock.load(argument.capture(), any())).thenAnswer(
                invocation ->
                        SignalingInfraBuilder.fromRJSInfra(
                                parseRailJSONFromFile(
                                        Helpers.getResourcePath(argument.getValue()).toString()
                                ), Set.of(new BAL3())
                        )
        );
    }
}
