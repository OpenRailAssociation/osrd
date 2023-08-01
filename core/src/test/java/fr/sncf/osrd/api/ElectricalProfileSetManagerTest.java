package fr.sncf.osrd.api;

import static fr.sncf.osrd.external_generated_inputs.ElectricalProfileMappingTest.verifyProfileMap;

import org.junit.jupiter.api.Test;


public class ElectricalProfileSetManagerTest extends ApiTest {
    @Test
    public void testGetProfileMap() {
        var profileMap =
                electricalProfileSetManager.getProfileMap("small_infra/external_generated_inputs.json");

        assert profileMap != null;
        verifyProfileMap(profileMap);
    }

    @Test
    public void testGetProfileMapInvalid() {
        var profileMap =
                electricalProfileSetManager.getProfileMap("small_infra/invalid.json");

        assert profileMap == null;
    }
}
