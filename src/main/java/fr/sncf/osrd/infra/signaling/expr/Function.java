package fr.sncf.osrd.infra.signaling.expr;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.signaling.expr.value.IExprValue;
import fr.sncf.osrd.infra.signaling.expr.value.ValueType;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class Function<T extends IExprValue> {
    public final String functionName;

    public final String[] argumentNames;
    public final ValueType[] argumentTypes;

    public final ValueType returnsType;

    public final Expr<T> body;

    private Function(
            String functionName,
            String[] argumentNames,
            ValueType[] argumentTypes,
            ValueType returnsType,
            Expr<T> body
    ) {
        this.functionName = functionName;
        this.argumentNames = argumentNames;
        this.argumentTypes = argumentTypes;
        this.returnsType = returnsType;
        this.body = body;
    }

    /** Creates and type checks a new signal state evaluation function */
    public static <T extends IExprValue> Function<T> from(
            String functionName,
            String[] argumentNames,
            ValueType[] argumentTypes,
            ValueType returnType,
            Expr<T> body
    ) throws InvalidInfraException {
        var function = new Function<>(functionName, argumentNames, argumentTypes, returnType, body);
        if (function.body.getType(argumentTypes) != returnType)
            throw new InvalidInfraException("return type mismatch in function" + functionName);
        return function;
    }
}
