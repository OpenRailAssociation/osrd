package fr.sncf.osrd.infra.signaling;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.simulation.Entity;
import fr.sncf.osrd.simulation.EntityType;
import fr.sncf.osrd.utils.SortedArraySet;

import java.util.*;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class SignalFunction {
    public final String functionName;

    /** A collection of expressions that must be evaluated */
    public final SignalExpr[] rules;

    public final String[] argumentNames;
    public final EntityType[] argumentTypes;

    /** Creates a new signal state evaluation function */
    public SignalFunction(
            String functionName,
            SignalExpr[] rules,
            String[] argumentNames,
            EntityType[] argumentTypes
    ) {
        this.functionName = functionName;
        this.argumentNames = argumentNames;
        this.argumentTypes = argumentTypes;
        this.rules = rules;
    }

    /** Evaluates the current aspect of the signal */
    public void evaluate(Entity[] arguments, SortedArraySet<Aspect> aspects) {
        for (var rule : rules)
            rule.evaluate(arguments, aspects);
    }
}
