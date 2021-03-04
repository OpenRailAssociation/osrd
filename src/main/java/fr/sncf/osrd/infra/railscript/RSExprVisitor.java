package fr.sncf.osrd.infra.railscript;

import fr.sncf.osrd.infra.InvalidInfraException;

public class RSExprVisitor {

    public void visit(RSExpr.OrExpr expr) throws InvalidInfraException {
        for (var e : expr.expressions)
            e.accept(this);
    }

    public void visit(RSExpr.AndExpr expr) throws InvalidInfraException {
        for (var e : expr.expressions)
            e.accept(this);
    }

    public void visit(RSExpr.NotExpr expr) throws InvalidInfraException {
        expr.expr.accept(this);
    }

    public void visit(RSExpr.TrueExpr expr) {
    }

    public void visit(RSExpr.FalseExpr expr) {
    }

    public void visit(RSExpr.AspectSetExpr expr) throws InvalidInfraException {
        for (var condition : expr.conditions)
            condition.accept(this);
    }

    public void visit(RSExpr.SignalRefExpr expr) throws InvalidInfraException {
    }

    public void visit(RSExpr.RouteRefExpr expr) throws InvalidInfraException {
    }

    /** Visit method */
    public void visit(RSExpr.IfExpr<?> expr) throws InvalidInfraException {
        expr.ifExpr.accept(this);
        expr.thenExpr.accept(this);
        expr.elseExpr.accept(this);
    }

    public void visit(RSExpr.CallExpr<?> expr) throws InvalidInfraException {
        for (var arg : expr.arguments)
            arg.accept(this);
    }

    /** Visit method */
    public void visit(RSExpr.EnumMatchExpr<?, ?> expr) throws InvalidInfraException {
        expr.expr.accept(this);
        for (var branch : expr.branches)
            branch.accept(this);
    }

    public void visit(RSExpr.ArgumentRefExpr<?> expr) {
    }

    public void visit(RSExpr.SignalAspectCheckExpr expr) throws InvalidInfraException {
        expr.signalExpr.accept(this);
    }

    public void visit(RSExpr.RouteStateCheckExpr expr) throws InvalidInfraException {
        expr.routeExpr.accept(this);
    }

    public void visit(RSExpr.AspectSetContainsExpr expr) throws InvalidInfraException {
        expr.expr.accept(this);
    }
}
