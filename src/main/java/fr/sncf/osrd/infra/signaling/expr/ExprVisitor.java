package fr.sncf.osrd.infra.signaling.expr;

import fr.sncf.osrd.infra.InvalidInfraException;

public class ExprVisitor {
    public void visit(Expr<?> expr) {
    }

    public void visit(Expr.OrExpr expr) {
        visit((Expr<?>) expr);
    }

    public void visit(Expr.AndExpr expr) {
        visit((Expr<?>) expr);
    }

    public void visit(Expr.NotExpr expr) {
        visit((Expr<?>) expr);
    }

    public void visit(Expr.TrueExpr expr) {
        visit((Expr<?>) expr);
    }

    public void visit(Expr.FalseExpr expr) {
        visit((Expr<?>) expr);
    }

    public void visit(Expr.AspectSetExpr expr) {
        visit((Expr<?>) expr);
    }

    public void visit(Expr.SignalRefExpr expr) throws InvalidInfraException {
        visit((Expr<?>) expr);
    }

    public void visit(Expr.RouteRefExpr expr) throws InvalidInfraException {
        visit((Expr<?>) expr);
    }

    // TODO
    // public void visit(Expr.SwitchExpr expr) {
    //     visit((Expr<?>) expr);
    // }

    public void visit(Expr.IfExpr<?> expr) {
        visit((Expr<?>) expr);
    }

    public void visit(Expr.CallExpr<?> expr) {
        visit((Expr<?>) expr);
    }

    public void visit(Expr.EnumMatchExpr<?, ?> expr) {
        visit((Expr<?>) expr);
    }

    public void visit(Expr.ArgumentRefExpr<?> expr) {
        visit((Expr<?>) expr);
    }

    public void visit(Expr.SignalAspectCheckExpr expr) {
        visit((Expr<?>) expr);
    }

    public void visit(Expr.RouteStateCheckExpr expr) {
        visit((Expr<?>) expr);
    }

    public void visit(Expr.AspectSetContainsExpr expr) {
        visit((Expr<?>) expr);
    }
}
