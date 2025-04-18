package fr.sncf.osrd.api;

import fr.sncf.osrd.reporting.warnings.DiagnosticRecorder;

public interface InfraProvider {
    /** Get an infra given an id */
    FullInfra getInfra(String infraId, Integer expectedVersion, DiagnosticRecorder diagnosticRecorder)
            throws InterruptedException;
}
