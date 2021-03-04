package fr.sncf.osrd.infra.railscript;

import fr.sncf.osrd.infra.InvalidInfraException;

public class RSExprVisitor {
    public void visit(RSExpr<?> expr) {
    }

    public void visit(RSExpr.OrExpr expr) {
        visit((RSExpr<?>) expr);
    }

    public void visit(RSExpr.AndExpr expr) {
        visit((RSExpr<?>) expr);
    }

    public void visit(RSExpr.NotExpr expr) {
        visit((RSExpr<?>) expr);
    }

    public void visit(RSExpr.TrueExpr expr) {
        visit((RSExpr<?>) expr);
    }

    public void visit(RSExpr.FalseExpr expr) {
        visit((RSExpr<?>) expr);
    }

    public void visit(RSExpr.AspectSetExpr expr) {
        visit((RSExpr<?>) expr);
    }

    public void visit(RSExpr.SignalRefExpr expr) throws InvalidInfraException {
        visit((RSExpr<?>) expr);
    }

    public void visit(RSExpr.RouteRefExpr expr) throws InvalidInfraException {
        visit((RSExpr<?>) expr);
    }

    // TODO
    // public void visit(Expr.SwitchExpr expr) {
    //     visit((Expr<?>) expr);
    // }

    public void visit(RSExpr.IfExpr<?> expr) {
        visit((RSExpr<?>) expr);
    }

    public void visit(RSExpr.CallExpr<?> expr) {
        visit((RSExpr<?>) expr);
    }

    public void visit(RSExpr.EnumMatchExpr<?, ?> expr) {
        visit((RSExpr<?>) expr);
    }

    public void visit(RSExpr.ArgumentRefExpr<?> expr) {
        visit((RSExpr<?>) expr);
    }

    public void visit(RSExpr.SignalAspectCheckExpr expr) {
        visit((RSExpr<?>) expr);
    }

    public void visit(RSExpr.RouteStateCheckExpr expr) {
        visit((RSExpr<?>) expr);
    }

    public void visit(RSExpr.AspectSetContainsExpr expr) {
        visit((RSExpr<?>) expr);
    }
}
