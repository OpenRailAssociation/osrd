package fr.sncf.osrd.api;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import java.io.IOException;

public class InfraHandlerTest {
    @Test
    public void invalidInfra() {
        var handler = new InfraHandler("http://localhost:8000/", "");
        Assertions.assertThrows(IOException.class, () -> {
            handler.load("invalid");
        });
    }
}
