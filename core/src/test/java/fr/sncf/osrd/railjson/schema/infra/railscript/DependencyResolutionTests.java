package fr.sncf.osrd.railjson.schema.infra.railscript;

import static fr.sncf.osrd.Helpers.getBaseInfra;
import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import org.junit.jupiter.api.Test;

import java.util.*;
import java.util.stream.Collectors;

public class DependencyResolutionTests {

    @Test
    public void testDependencyResolution() throws InvalidInfraException {
        final var infra = getBaseInfra();

        var expectedMap = new HashMap<String, Set<String>>();
        expectedMap.put("il.sig.C1", Set.of());
        expectedMap.put("il.sig.C2", Set.of());
        expectedMap.put("il.sig.C3", Set.of());
        expectedMap.put("il.sig.C6", Set.of("il.sig.C2"));
        expectedMap.put("il.sig.S7", Set.of("il.sig.C1", "il.sig.C3"));
        var parsedInfra = RailJSONParser.parse(infra);
        for (var s : parsedInfra.signals) {
            var res = s.signalSubscribers.stream().map(x -> x.id).collect(Collectors.toSet());
            assertEquals(expectedMap.get(s.id), res);
        }
    }
}
