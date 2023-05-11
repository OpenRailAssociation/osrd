package fr.sncf.osrd.external_generated_inputs;

import static fr.sncf.osrd.Helpers.infraFromRJS;
import static fr.sncf.osrd.external_generated_inputs.ExternalGeneratedInputsHelpers.getRjsElectricalProfileSet;
import static fr.sncf.osrd.infra.InfraHelpers.makeSingleTrackRJSInfra;
import static java.util.Arrays.asList;
import static java.util.Collections.singletonList;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static fr.sncf.osrd.Helpers.*;
import static fr.sncf.osrd.api.StandaloneSimulationTest.smallInfraTrainPath;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.railjson.schema.infra.RJSRoutePath;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSDirectionalTrackRange;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPath;
import org.junit.jupiter.api.Test;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;

public class ElectricalProfileMappingTest {

    /**
     * Check that a profile map is coherent
     */
    public static void verifyProfileMap(ElectricalProfileMapping profileMap) {
        assertNotEquals(0, profileMap.mapping.size());
        for (var byTrack : profileMap.mapping.entrySet()) {
            assertNotEquals(0, byTrack.getValue().size());
            for (var byRange : byTrack.getValue().entrySet()) {
                assertNotEquals(0, byRange.getValue().asMapOfRanges().size());
            }
        }
    }

    @Test
    public void testRJSParsing() throws IOException, URISyntaxException {
        var profileSet = Helpers.getExampleElectricalProfiles("small_infra/external_generated_inputs.json");
        assert profileSet.levels.size() > 0;

        var profileMap = new ElectricalProfileMapping();
        profileMap.parseRJS(profileSet);

        verifyProfileMap(profileMap);
        assertEquals(5, profileMap.mapping.size()); // 5 power classes
    }

    @Test
    public void testGetProfileByPathSingleTrackInfra() {
        var rjsElectricalProfiles = getRjsElectricalProfileSet();

        var profileMap = new ElectricalProfileMapping();
        profileMap.parseRJS(rjsElectricalProfiles);

        var rjsInfra = makeSingleTrackRJSInfra();
        var infra = infraFromRJS(rjsInfra);
        var rjsPath = new RJSTrainPath(List.of(new RJSRoutePath("route_forward",
                List.of(new RJSDirectionalTrackRange("track", 20, 80, EdgeDirection.START_TO_STOP)),
                "BAL3")));
        var path = TrainPathBuilder.from(infra, rjsPath);

        var profiles = profileMap.getProfilesOnPath(path);
        assertEquals(profiles.keySet(), new HashSet<>(singletonList("1")));
        var profileRangeMap = profiles.get("1");
        assertEquals("22500", profileRangeMap.get(0.));
        assertEquals("22500", profileRangeMap.get(9.5));
        assertEquals("20000", profileRangeMap.get(10.));
        assertEquals("20000", profileRangeMap.get(30.));
        assertEquals("20000", profileRangeMap.get(49.5));
        assertEquals("22500", profileRangeMap.get(50.));
        assertEquals("22500", profileRangeMap.get(59.5));
    }

    @Test
    public void testGetProfileByPathSmallInfra() throws IOException, URISyntaxException {
        var rjsElectricalProfiles = getExampleElectricalProfiles("small_infra/external_generated_inputs.json");

        var profileMap = new ElectricalProfileMapping();
        profileMap.parseRJS(rjsElectricalProfiles);

        var rjsInfra = getExampleInfra("small_infra/infra.json");
        var infra = infraFromRJS(rjsInfra);

        var rjsPath = smallInfraTrainPath();
        var path = TrainPathBuilder.from(infra, rjsPath);

        var profiles = profileMap.getProfilesOnPath(path);
        assertEquals(profiles.keySet(), new HashSet<>(asList("1", "2", "3", "4", "5")));

        var expectedResults = new ArrayList<HashSet<String>>();
        expectedResults.add(new HashSet<>(asList("25000")));
        expectedResults.add(new HashSet<>(asList("25000", "22500")));
        expectedResults.add(new HashSet<>(asList("25000", "22500")));
        expectedResults.add(new HashSet<>(asList("25000", "22500", "20000")));
        expectedResults.add(new HashSet<>(asList("25000", "22500", "20000", "O")));

        for (int i = 1; i <= 5; i++) {
            var profileRangeMap = profiles.get(String.valueOf(i));
            var values = new HashSet<>();
            for (var range : profileRangeMap.asMapOfRanges().entrySet()) {
                values.add(range.getValue());
            }
            assertEquals(expectedResults.get(i - 1), values);
        }

    }

}
