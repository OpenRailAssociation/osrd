package fr.sncf.osrd.railjson.schema.infra.railscript;

import static fr.sncf.osrd.Helpers.getBaseInfra;
import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import org.junit.jupiter.api.Test;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.stream.Collectors;

public class DependencyResolutionTests {

    @Test
    public void testDependencyResolution() throws InvalidInfraException {
        final var infra = getBaseInfra("tiny_infra/infra_optional.json");

        var expectedMap = new HashMap<String, HashSet<String>>();
        expectedMap.put("il.sig.C1", new HashSet<>());
        expectedMap.put("il.sig.C2", new HashSet<>());
        expectedMap.put("il.sig.C3", new HashSet<>());
        expectedMap.put("il.sig.C6", new HashSet<>(Collections.singletonList("il.sig.W4")));
        expectedMap.put("il.sig.S7", new HashSet<>(Collections.singletonList("il.sig.W5")));
        expectedMap.put("il.sig.W4", new HashSet<>(Collections.singletonList("il.sig.C2")));
        expectedMap.put("il.sig.W5", new HashSet<>(Arrays.asList("il.sig.C3", "il.sig.C1")));
        for (var s : RailJSONParser.parse(infra).signals) {
            var res = s.signalSubscribers.stream().map(x -> x.id).collect(Collectors.toSet());
            assertEquals(expectedMap.get(s.id), res);
        }
    }
}
