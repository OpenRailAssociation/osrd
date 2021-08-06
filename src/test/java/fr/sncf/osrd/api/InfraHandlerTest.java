package fr.sncf.osrd.api;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import fr.sncf.osrd.api.InfraManager.InfraLoadException;

import java.io.IOException;

public class InfraHandlerTest {
    @Test
    public void invalidInfra() {
        var handler = new InfraManager("http://localhost:8000/", "");
        Assertions.assertThrows(InfraLoadException.class, () -> {
            handler.load("invalid");
        });
    }
}
