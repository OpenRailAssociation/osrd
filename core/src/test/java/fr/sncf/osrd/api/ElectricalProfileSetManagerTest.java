package fr.sncf.osrd.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.AssertionsForClassTypes.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import fr.sncf.osrd.path.legacy_objects.ElectricalProfileMapping;
import fr.sncf.osrd.reporting.exceptions.ErrorType;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import fr.sncf.osrd.utils.Helpers;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import org.junit.jupiter.api.Test;

public class ElectricalProfileSetManagerTest extends ApiTest {
    @Test
    public void testGetProfileMap() {
        var profileMap = electricalProfileSetManager.getProfileMap("small_infra/external_generated_inputs.json");

        verifyProfileMap(profileMap);
    }

    @Test
    public void testSoftError() {
        assertThatThrownBy(() -> electricalProfileSetManager.getProfileMap("small_infra/invalid.json"))
                .isExactlyInstanceOf(OSRDError.class)
                .satisfies(exception ->
                        assertThat(((OSRDError) exception).osrdErrorType).isEqualTo(ErrorType.EPSetSoftLoadingError));
    }

    @Test
    public void testHardError() {
        assertThatThrownBy(() -> electricalProfileSetManager.getProfileMap("small_infra/infra.json"))
                .isExactlyInstanceOf(OSRDError.class)
                .satisfies(exception ->
                        assertThat(((OSRDError) exception).osrdErrorType).isEqualTo(ErrorType.EPSetHardLoadingError));
    }

    @Test
    public void failAndRetryTest() throws IOException {
        var path = Helpers.getResourcePath("infras/small_infra/external_generated_inputs.json");
        var newPath = path.resolveSibling("external_generated_inputs.json.tmp");
        var testID = "small_infra/external_generated_inputs.json.tmp";

        assertThatThrownBy(() -> electricalProfileSetManager.getProfileMap(testID))
                .isExactlyInstanceOf(OSRDError.class)
                .satisfies(exception ->
                        assertThat(((OSRDError) exception).osrdErrorType).isEqualTo(ErrorType.EPSetSoftLoadingError));
        assert electricalProfileSetManager.cache.get(testID).status
                == ElectricalProfileSetManager.CacheStatus.TRANSIENT_ERROR;

        Files.copy(path, newPath, StandardCopyOption.REPLACE_EXISTING).toFile().deleteOnExit();
        var profileMap = electricalProfileSetManager.getProfileMap(testID);
        verifyProfileMap(profileMap);
    }

    /** Check that a profile map is coherent */
    public static void verifyProfileMap(ElectricalProfileMapping profileMap) {
        assert profileMap != null;
        assertNotEquals(0, profileMap.getMapping().size());
        for (var byTrack : profileMap.getMapping().entrySet()) {
            assertNotEquals(0, byTrack.getValue().size());
            for (var byRange : byTrack.getValue().entrySet()) {
                assertNotEquals(0, byRange.getValue().asList().size());
            }
        }
    }
}
