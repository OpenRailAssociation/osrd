package fr.sncf.osrd.reporting.warnings;

import java.util.List;

public interface WarningRecorder {

    /** Registers the given warning */
    void register(Warning warning);
}
