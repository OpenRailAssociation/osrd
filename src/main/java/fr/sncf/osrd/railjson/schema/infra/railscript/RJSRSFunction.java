package fr.sncf.osrd.railjson.schema.infra.railscript;

import com.squareup.moshi.*;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.Identified;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSRSFunction implements Identified {
    /** Name of the function */
    public String name;

    /** The list of the names of the argument of the function. Types are deduced from the AST */
    public Argument[] arguments;

    @Json(name = "return_type")
    public RJSRSType returnType;

    /** The expression to evaluate */
    public RJSRSExpr body;

    /** A mathematical function for the signal expression language */
    public RJSRSFunction(String name, Argument[] arguments, RJSRSType returnType, RJSRSExpr body) {
        this.name = name;
        this.arguments = arguments;
        this.returnType = returnType;
        this.body = body;
    }

    @Override
    public String getID() {
        return name;
    }

    public static final class Argument {
        public String name;
        public RJSRSType type;

        public Argument(String name, RJSRSType type) {
            this.name = name;
            this.type = type;
        }
    }
}
