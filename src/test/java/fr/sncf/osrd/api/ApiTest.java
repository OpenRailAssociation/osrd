package fr.sncf.osrd.api;

import static org.mockito.Mockito.when;

import fr.sncf.osrd.Helpers;
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

    /** Setup infra handler mock */
    @BeforeEach
    public void setUp() throws InvalidInfraException, IOException {
        var infra = "tiny_infra/infra.json";
        var tinyInfra = Infra.parseFromFile(JsonConfig.InfraType.UNKNOWN, Helpers.getResourcePath(infra).toString());
        when(infraHandlerMock.load(infra)).thenReturn(tinyInfra);
    }
}
