package fr.sncf.osrd.infra.railjson.schema.signaling;

import com.squareup.moshi.*;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.railjson.schema.Identified;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSSignalFunction implements Identified {
    /** Name of the function */
    public final String name;

    /** The list of the names of the argument of the function. Types are deduced from the AST */
    public final Argument[] arguments;

    @Json(name = "returns_type")
    public final RJSSignalExprType returnsType;

    /** The expression to evaluate */
    public final RJSSignalExpr body;

    /** A mathematical function for the signal expression language */
    public RJSSignalFunction(String name, Argument[] arguments, RJSSignalExprType returnsType, RJSSignalExpr body) {
        this.name = name;
        this.arguments = arguments;
        this.returnsType = returnsType;
        this.body = body;
    }

    @Override
    public String getID() {
        return name;
    }

    public static final class Argument {
        public final String name;
        public final RJSSignalExprType type;

        public Argument(String name, RJSSignalExprType type) {
            this.name = name;
            this.type = type;
        }
    }
}
