package fr.sncf.osrd.infra.railscript;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railscript.value.RSType;
import fr.sncf.osrd.infra.routegraph.RouteStatus;

import java.io.PrintStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.stream.Collectors;

/** This class allow to pretty print signaling functions and expressions */
public class PrettyPrinter extends RSExprVisitor {
    private final int tabstop = 4;
    private int curtab = 0;
    private RSFunction<?> currentFct;
    public final PrintStream out;

    public PrettyPrinter(PrintStream out) {
        this.out = out;
    }

    public void print(Infra infra) {
        // TODO
    }

    /** Pretty print a function */
    public void print(RSFunction<?> fct) throws InvalidInfraException {
        currentFct = fct;
        out.printf("fn %s(", fct.functionName);
        // Arguments
        if (fct.argNames.length > 0) {
            out.println();
            inc();
            inctab();
            for (var i = 0; i < fct.argNames.length; i++) {
                out.printf("%s: ", fct.argNames[i]);
                print(fct.argTypes[i]);
                if (i < fct.argNames.length - 1) {
                    out.println(",");
                    tab();
                }
            }
            out.println();
            dec();
            dectab();
        }
        // Return value
        out.print(") -> ");
        print(fct.returnsType);
        out.print(" {\n");
        // Body
        inctab();
        fct.body.accept(this);
        out.println();
        dectab();
        out.print("}\n");
        currentFct = null;
    }

    private void print(RSType type) {
        switch (type) {
            case BOOLEAN:
                out.print("bool");
                break;
            case ASPECT_SET:
                out.print("AspectSet");
                break;
            case SIGNAL:
                out.print("Signal");
                break;
            case ROUTE:
                out.print("Route");
                break;
            case SWITCH:
                out.print("Switch");
                break;
        }
    }

    /** Display the tab matching the current indentation */
    private void tab() {
        out.print(" ".repeat(curtab));
    }

    /** Increase one level of indentation **/
    private void inc() {
        curtab += tabstop;
    }

    /** Increase one level of indentation and display the current tab **/
    private void inctab() {
        inc();
        tab();
    }

    /** Decrease one level of indentation **/
    private void dec() {
        curtab -= tabstop;
        assert curtab >= 0;
    }

    /** Decrease one level of indentation and display the current tab **/
    private void dectab() {
        dec();
        tab();
    }

    @Override
    public void visit(RSExpr.True expr) {
        out.print("true");
    }

    @Override
    public void visit(RSExpr.False expr) {
        out.print("false");
    }

    @Override
    public void visit(RSExpr.SignalRef expr) {
        out.printf("\"%s\"", expr.signalName);
    }

    @Override
    public void visit(RSExpr.RouteRef expr) {
        out.printf("\"%s\"", expr.routeName);
    }

    @Override
    public void visit(RSExpr.Or expr) throws InvalidInfraException {
        if (expr.expressions.length == 1) {
            expr.expressions[0].accept(this);
            return;
        }
        out.print("(");
        expr.expressions[0].accept(this);
        for (var i = 1; i < expr.expressions.length; i++) {
            out.print(" or ");
            expr.expressions[i].accept(this);
        }
        out.print(")");
    }

    @Override
    public void visit(RSExpr.And expr) throws InvalidInfraException {
        expr.expressions[0].accept(this);
        for (var i = 1; i < expr.expressions.length; i++) {
            out.print(" and ");
            expr.expressions[i].accept(this);
        }
    }

    @Override
    public void visit(RSExpr.Not expr) throws InvalidInfraException {
        out.print("not (");
        expr.expr.accept(this);
        out.print(")");
    }

    @Override
    public void visit(RSExpr.AspectSet expr) throws InvalidInfraException {
        out.print("AspectSet {\n");
        inctab();
        for (var i = 0; i < expr.conditions.length; i++) {
            out.printf("%s", expr.aspects[i].id);
            if (expr.conditions[i] != null) {
                out.print(" if ");
                expr.conditions[i].accept(this);
            }
            if (i < expr.conditions.length - 1) {
                out.print(",");
                out.println();
                tab();
            }
        }
        out.println();
        dectab();
        out.print("}");
    }

    @Override
    public void visit(RSExpr.If<?> expr) throws InvalidInfraException {
        out.print("if ");
        expr.ifExpr.accept(this);
        out.println(" {");
        inctab();
        expr.thenExpr.accept(this);
        out.println();
        dectab();
        out.print("} else {\n");
        inctab();
        expr.elseExpr.accept(this);
        out.println();
        dectab();
        out.print("}");
    }

    @Override
    public void visit(RSExpr.Call<?> expr) throws InvalidInfraException {
        out.printf("%s(", expr.function.functionName);
        for (var i = 0; i < expr.arguments.length - 1; i++) {
            expr.arguments[i].accept(this);
            out.print(", ");
        }
        if (expr.arguments.length > 0)
            expr.arguments[expr.arguments.length - 1].accept(this);
        out.print(")");
    }

    @Override
    public void visit(RSExpr.EnumMatch<?, ?> expr) throws InvalidInfraException {
        var argTypes = currentFct == null ? new RSType[0] : currentFct.argTypes;
        var enumCond = expr.expr.getType(argTypes).enumClass;
        if (enumCond == null)
            throw new InvalidInfraException("EnumMatch: the type of the condition expr isn't matchable");
        var enumValues = enumCond.getEnumConstants();

        out.print("match ");
        expr.expr.accept(this);
        out.print(" {\n");
        inc();
        for (var i = 0; i < expr.branches.length; i++) {
            // TODO print enum value instead of int
            tab();
            out.printf("%s: ", enumValues[i].name());
            expr.branches[i].accept(this);
            if (i < expr.branches.length - 1)
                out.print(",");
            out.println();
        }
        dectab();
        out.print("}");
    }

    @Override
    public void visit(RSExpr.ArgumentRef<?> expr) {
        out.printf("%s", currentFct.argNames[expr.slotIndex]);
    }

    @Override
    public void visit(RSExpr.SignalAspectCheck expr) throws InvalidInfraException {
        out.print("signal_has_aspect(");
        expr.signalExpr.accept(this);
        out.printf(", %s)", expr.aspect);
    }

    @Override
    public void visit(RSExpr.RouteStateCheck expr) throws InvalidInfraException {
        out.print("route_has_state(");
        expr.routeExpr.accept(this);
        out.printf(", %s)", expr.status);
    }

    @Override
    public void visit(RSExpr.AspectSetContains expr) throws InvalidInfraException {
        out.print("aspect_set_contains(");
        expr.expr.accept(this);
        out.printf(", %s)", expr.aspect);
    }
}
