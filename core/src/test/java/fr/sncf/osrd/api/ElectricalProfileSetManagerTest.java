package fr.sncf.osrd.api;

import static fr.sncf.osrd.external_generated_inputs.ElectricalProfileMappingTest.verifyProfileMap;

import org.junit.jupiter.api.Test;
import java.io.IOException;


public class ElectricalProfileSetManagerTest extends ApiTest {
    @Test
    public void testGetProfileMap() {
        var profileMap =
                electricalProfileSetManagerMock.getProfileMap("small_infra/external_generated_inputs.json");

        assert profileMap.isPresent();
        verifyProfileMap(profileMap.get());
    }

    @Test
    public void testGetProfileMapInvalid() {
        var profileMap =
                electricalProfileSetManagerMock.getProfileMap("small_infra/invalid.json");

        assert profileMap.isEmpty();
    }
}
