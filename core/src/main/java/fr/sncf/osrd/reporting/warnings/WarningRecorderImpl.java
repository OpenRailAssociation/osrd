package fr.sncf.osrd.reporting.warnings;

import java.io.PrintStream;
import java.util.ArrayList;
import java.util.List;

public class WarningRecorderImpl implements WarningRecorder {

    public final List<Warning> warnings = new ArrayList<>();
    private final boolean strict;

    public WarningRecorderImpl(boolean strict) {
        this.strict = strict;
    }

    @Override
    public void register(Warning warning) {
        warnings.add(warning);
        if (strict)
            throw new StrictWarningError(warning);
    }

    /** Prints the warnings on the given stream */
    public void report(PrintStream stream) {
        for (var warning : warnings)
            stream.printf("WARNING: %s%n", warning.message);
    }

    /** Prints the warnings on stderr */
    public void report() {
        report(System.err);
    }
}
