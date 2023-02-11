package fr.sncf.osrd.api;

import static fr.sncf.osrd.external_generated_inputs.ElectricalProfileMappingTest.verifyProfileMap;
import static org.junit.jupiter.api.Assertions.assertThrows;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.reporting.exceptions.ErrorType;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import org.junit.jupiter.api.Test;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;


public class ElectricalProfileSetManagerTest extends ApiTest {
    @Test
    public void testGetProfileMap() {
        var profileMap = electricalProfileSetManagerMock.getProfileMap("small_infra/external_generated_inputs.json");

        assert profileMap != null;
        verifyProfileMap(profileMap);
    }

    @Test
    public void testSoftError() {
        var error = assertThrows(OSRDError.class,
                () -> electricalProfileSetManagerMock.getProfileMap("small_infra/invalid.json"));
        assert error.osrdErrorType == ErrorType.EPSetSoftLoadingError;
    }

    @Test
    public void testHardError() {
        var error = assertThrows(OSRDError.class,
                () -> electricalProfileSetManagerMock.getProfileMap("small_infra/infra.json"));
        assert error.osrdErrorType == ErrorType.EPSetHardLoadingError;
    }

    @Test
    public void failAndRetryTest() throws IOException {
        var path = Helpers.getResourcePath("small_infra/external_generated_inputs.json");
        var newPath = path.resolveSibling("external_generated_inputs.json.tmp");
        var testID = "small_infra/external_generated_inputs.json.tmp";

        var error = assertThrows(OSRDError.class, () -> electricalProfileSetManagerMock.getProfileMap(testID));
        assert error.osrdErrorType == ErrorType.EPSetSoftLoadingError;
        assert electricalProfileSetManagerMock.cache.get(testID).status
                == ElectricalProfileSetManager.CacheStatus.TRANSIENT_ERROR;

        Files.copy(path, newPath, StandardCopyOption.REPLACE_EXISTING).toFile().deleteOnExit();
        var profileMap = electricalProfileSetManagerMock.getProfileMap(testID);
        assert profileMap != null;
    }
}
