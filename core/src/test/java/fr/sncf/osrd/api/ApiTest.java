package fr.sncf.osrd.api;

import static org.mockito.Mockito.when;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.api.InfraManager.InfraLoadException;
import fr.sncf.osrd.config.JsonConfig;
import fr.sncf.osrd.infra.Infra;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
public class ApiTest {
    @Mock
    static InfraManager infraHandlerMock;

    /**
     * Setup infra handler mock
     */
    @BeforeEach
    public void setUp() throws InfraLoadException, InterruptedException {
        ArgumentCaptor<String> argument = ArgumentCaptor.forClass(String.class);
        when(infraHandlerMock.load(argument.capture())).thenAnswer(
                invocation ->
                        Infra.parseFromFile(
                                JsonConfig.InfraType.UNKNOWN,
                                Helpers.getResourcePath(argument.getValue()).toString()
                        )
        );
    }
}
