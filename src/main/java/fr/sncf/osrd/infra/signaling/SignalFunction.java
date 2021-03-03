package fr.sncf.osrd.infra.signaling;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.simulation.Entity;
import fr.sncf.osrd.simulation.EntityType;
import fr.sncf.osrd.utils.SortedArraySet;

import java.util.*;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class SignalFunction {
    public final String functionName;

    public final String[] argumentNames;
    public final SignalExprType[] argumentTypes;

    public final SignalExprType returnsType;

    public final SignalExpr body;

    private SignalFunction(
            String functionName,
            String[] argumentNames,
            SignalExprType[] argumentTypes,
            SignalExprType returnsType,
            SignalExpr body
    ) {
        this.functionName = functionName;
        this.argumentNames = argumentNames;
        this.argumentTypes = argumentTypes;
        this.returnsType = returnsType;
        this.body = body;
    }

    /** Creates and type checks a new signal state evaluation function */
    public static SignalFunction from(
            String functionName,
            String[] argumentNames,
            SignalExprType[] argumentTypes,
            SignalExprType returnsType,
            SignalExpr body
    ) throws InvalidInfraException {
        var function = new SignalFunction(functionName, argumentNames, argumentTypes, returnsType, body);
        function.body.typeCheck(function);
        return function;
    }
}
