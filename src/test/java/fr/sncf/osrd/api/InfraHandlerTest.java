package fr.sncf.osrd.api;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import fr.sncf.osrd.api.InfraManager.InfraLoadException;

import java.io.IOException;

public class InfraHandlerTest {
    @Test
    public void invalidInfra() {
        var manager = new InfraManager("http://localhost:8000/", "");
        Assertions.assertThrows(InfraLoadException.class, () -> {
            manager.load("invalid");
        });
    }
}
