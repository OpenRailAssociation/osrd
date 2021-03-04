package fr.sncf.osrd.infra.railscript;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railscript.value.RSValue;
import fr.sncf.osrd.infra.railscript.value.RSType;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RSFunction<T extends RSValue> {
    public final String functionName;

    public final String[] argumentNames;
    public final RSType[] argumentTypes;

    public final RSType returnsType;

    public final RSExpr<T> body;

    private RSFunction(
            String functionName,
            String[] argumentNames,
            RSType[] argumentTypes,
            RSType returnsType,
            RSExpr<T> body
    ) {
        this.functionName = functionName;
        this.argumentNames = argumentNames;
        this.argumentTypes = argumentTypes;
        this.returnsType = returnsType;
        this.body = body;
    }

    /** Creates and type checks a new signal state evaluation function */
    public static <T extends RSValue> RSFunction<T> from(
            String functionName,
            String[] argumentNames,
            RSType[] argumentTypes,
            RSType returnType,
            RSExpr<T> body
    ) throws InvalidInfraException {
        var function = new RSFunction<>(functionName, argumentNames, argumentTypes, returnType, body);
        if (function.body.getType(argumentTypes) != returnType)
            throw new InvalidInfraException("return type mismatch in function" + functionName);
        return function;
    }
}
