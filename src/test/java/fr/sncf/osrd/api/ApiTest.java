package fr.sncf.osrd.api;

import static org.mockito.Mockito.when;

import fr.sncf.osrd.config.JsonConfig;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;

@ExtendWith(MockitoExtension.class)
public class ApiTest {
    @Mock
    static InfraHandler infraHandlerMock;

    @BeforeEach
    public void setUp() throws InvalidInfraException, IOException {
        var tinyInfra = getInfra("tiny_infra/infra.json");
        when(infraHandlerMock.load("tiny_infra/infra.json")).thenReturn(tinyInfra);
    }

    private Infra getInfra(String infra) throws InvalidInfraException, IOException {
        ClassLoader classLoader = ApiTest.class.getClassLoader();
        var infraPath = classLoader.getResource(infra);
        assert infraPath != null;
        return Infra.parseFromFile(JsonConfig.InfraType.UNKNOWN, infraPath.getFile());
    }


}
