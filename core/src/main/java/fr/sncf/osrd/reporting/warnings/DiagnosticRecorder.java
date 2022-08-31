package fr.sncf.osrd.reporting.warnings;

import fr.sncf.osrd.reporting.exceptions.OSRDError;
import java.util.List;

public interface DiagnosticRecorder {

    /** Registers the given warning */
    void register(Warning warning);

    /** Registers the given error */
    void register(OSRDError error);

    /** Retrieve the warnings */
    List<Warning> getWarnings();

    /** Retrieve the errors */
    List<OSRDError> getErrors();

    /** Verify if the diagnostic contains an error */
    void verify();
}
