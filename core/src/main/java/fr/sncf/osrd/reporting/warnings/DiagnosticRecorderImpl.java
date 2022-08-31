package fr.sncf.osrd.reporting.warnings;

import fr.sncf.osrd.reporting.exceptions.OSRDError;
import java.io.PrintStream;
import java.util.ArrayList;
import java.util.List;

public class DiagnosticRecorderImpl implements DiagnosticRecorder {

    public final List<Warning> warnings = new ArrayList<>();
    public final List<OSRDError> errors = new ArrayList<>();
    private final boolean strict;

    public DiagnosticRecorderImpl(boolean strict) {
        this.strict = strict;
    }

    @Override
    public void register(Warning warning) {
        warnings.add(warning);
        if (strict)
            throw new StrictWarningError(warning);
    }

    @Override
    public void register(OSRDError error) {
        errors.add(error);
        if (strict)
            throw error;
    }

    @Override
    public List<Warning> getWarnings() {
        return warnings;
    }

    @Override
    public List<OSRDError> getErrors() {
        return errors;
    }

    /** Verify that the diagnostic doesn't contain error. If so an error is thrown with the whole diagnostic message */
    @Override
    public void verify() {
        if (errors.isEmpty())
            return;
        throw new DiagnosticError(this);
    }

    /** Prints the warnings on the given stream */
    public void report(PrintStream stream) {
        for (var warning : warnings)
            stream.printf("WARNING: %s%n", warning.message);
        for (var error : errors)
            stream.printf("ERROR: %s%n", error.getMessage());
    }

    /** Prints the warnings on stderr */
    public void report() {
        report(System.err);
    }
}
