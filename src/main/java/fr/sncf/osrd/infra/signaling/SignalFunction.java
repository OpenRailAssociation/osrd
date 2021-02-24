package fr.sncf.osrd.infra.signaling;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.simulation.Entity;
import fr.sncf.osrd.simulation.EntityType;

import java.util.*;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class SignalFunction {
    public final String functionName;

    /** The aspect shown when no rule triggers */
    public final List<Aspect> defaultAspects;

    /** A collection of aspects, along with the condition that must be verified for the aspect to be shown */
    public final Map<Aspect, SignalExpr> rules;

    public final EntityType[] argumentTypes;

    /** Creates a new signal state evaluation function */
    public SignalFunction(
            String functionName,
            ArrayList<Aspect> defaultAspects,
            Map<Aspect, SignalExpr> rules,
            EntityType[] argumentTypes
    ) {
        this.functionName = functionName;
        this.argumentTypes = argumentTypes;
        Collections.sort(defaultAspects);
        this.defaultAspects = defaultAspects;
        this.rules = rules;
    }

    /** Evaluates the current aspect of the signal */
    public List<Aspect> evaluate(Entity[] arguments) {
        var res = new ArrayList<Aspect>();
        for (var aspectRule : rules.entrySet())
            if (aspectRule.getValue().evaluate(arguments))
                res.add(aspectRule.getKey());

        if (res.isEmpty())
            return defaultAspects;

        Collections.sort(res);
        return res;
    }
}
