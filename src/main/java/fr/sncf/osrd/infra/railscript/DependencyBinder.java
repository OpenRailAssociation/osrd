package fr.sncf.osrd.infra.railscript;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.infra.trackgraph.Switch;
import fr.sncf.osrd.infra_state.RouteState;
import fr.sncf.osrd.infra_state.SignalState;

import java.util.*;

public class DependencyBinder extends RSExprVisitor {
    private Set<Object> lastExprPossibleValues;
    public final Set<Signal> signalDependencies = new HashSet<>();
    public final Set<Route> routeDependencies = new HashSet<>();
    public final Set<Switch> switchDependencies = new HashSet<>();
    private final Stack<ArrayList<Set<Object>>> argsPossibleValues = new Stack<>();
    private final HashMap<String, Set<Object>> matchRefPossibleValues = new HashMap<>();
    private final Infra infra;

    public DependencyBinder(Infra infra) {
        this.infra = infra;
    }

    public static void bind(Signal signal, Infra infra) {
        var visitor = new DependencyBinder(infra);
        var expr = signal.expr.rootExpr;
        try {
            expr.accept(visitor);
        } catch (InvalidInfraException e) {
            assert false; // this visitor cannot throw
        }
        for (var s : visitor.signalDependencies)
            s.signalSubscribers.add(signal);
        for (var route : visitor.routeDependencies)
            route.signalSubscribers.add(signal);
        for (var s : visitor.switchDependencies)
            s.signalSubscribers.add(signal);
    }

    public void visit(RSExpr.Or expr) throws InvalidInfraException {
        var possibleValues = new HashSet<>();
        for (var e : expr.expressions) {
            e.accept(this);
            possibleValues.addAll(lastExprPossibleValues);
        }
        lastExprPossibleValues = possibleValues;
    }

    /** Visit method */
    public void visit(RSExpr.And expr) throws InvalidInfraException {
        var possibleValues = new HashSet<>();
        for (var e : expr.expressions) {
            e.accept(this);
            possibleValues.addAll(lastExprPossibleValues);
        }
        lastExprPossibleValues = possibleValues;
    }

    /** Visit method */
    public void visit(RSExpr.SignalRef expr) throws InvalidInfraException {
        lastExprPossibleValues = new HashSet<>();
        lastExprPossibleValues.add(expr.signal);
    }

    /** Visit method */
    public void visit(RSExpr.RouteRef expr) throws InvalidInfraException {
        lastExprPossibleValues = new HashSet<>();
        lastExprPossibleValues.add(expr.route);
    }

    /** Visit method */
    public void visit(RSExpr.SwitchRef expr) throws InvalidInfraException {
        lastExprPossibleValues = new HashSet<>();
        lastExprPossibleValues.add(expr.switchRef);
    }

    /** Visit method */
    public void visit(RSExpr.If<?> expr) throws InvalidInfraException {
        expr.ifExpr.accept(this);
        expr.thenExpr.accept(this);
        var possibleValues = new HashSet<>(lastExprPossibleValues);
        expr.elseExpr.accept(this);
        possibleValues.addAll(lastExprPossibleValues);
        lastExprPossibleValues = possibleValues;
    }

    /** Visit method */
    public void visit(RSExpr.Call<?> expr) throws InvalidInfraException {
        var argValues = new ArrayList<Set<Object>>();
        for (var arg : expr.arguments) {
            arg.accept(this);
            argValues.add(lastExprPossibleValues);
        }
        this.argsPossibleValues.push(argValues);
        expr.function.body.accept(this);
        this.argsPossibleValues.pop();
    }

    /** Visit method */
    public void visit(RSExpr.ArgumentRef<?> expr) {
        lastExprPossibleValues = argsPossibleValues.peek().get(expr.slotIndex);
    }

    /** Visit method */
    public void visit(RSExpr.EnumMatch<?, ?> expr) throws InvalidInfraException {
        expr.expr.accept(this);
        var possibleValues = new HashSet<>();
        for (var branch : expr.branches) {
            branch.accept(this);
            possibleValues.addAll(lastExprPossibleValues);
        }
        lastExprPossibleValues = possibleValues;
    }

    /** Visit method */
    public void visit(RSExpr.SignalAspectCheck expr) throws InvalidInfraException {
        expr.signalExpr.accept(this);
        for (var possibleValue : lastExprPossibleValues) {
            assert possibleValue instanceof Signal;
            signalDependencies.add((Signal) possibleValue);
        }
    }

    /** Visit method */
    public void visit(RSExpr.RouteStateCheck expr) throws InvalidInfraException {
        expr.routeExpr.accept(this);
        for (var possibleValue : lastExprPossibleValues) {
            assert possibleValue instanceof Route;
            routeDependencies.add((Route) possibleValue);
        }
    }

    /** Visit method */
    public void visit(RSExpr.OptionalMatch<?> expr) throws InvalidInfraException {
        expr.expr.accept(this);
        matchRefPossibleValues.put(expr.name, lastExprPossibleValues);
        expr.caseSome.accept(this);
        var possibleValues = new HashSet<>(lastExprPossibleValues);
        expr.caseNone.accept(this);
        possibleValues.addAll(lastExprPossibleValues);
        lastExprPossibleValues = possibleValues;
    }

    /** Visit method */
    public void visit(RSExpr.OptionalMatchRef<?> expr) {
        lastExprPossibleValues = matchRefPossibleValues.get(expr.name);
    }

    /** Visit method */
    public void visit(RSExpr.ReservedRoute reservedRoute) throws InvalidInfraException {
        var possibleValues = new HashSet<>();
        reservedRoute.signal.accept(this);
        var possibleSignals = lastExprPossibleValues;
        for (var val : possibleSignals) {
            assert val instanceof Signal;
            var signal = (Signal) val;
            signalDependencies.add(signal);
            infra.routeGraph.routeMap.values().stream()
                    .filter(x -> x.signalsWithEntry.contains(signal))
                    .forEach(possibleValues::add);
        }
        lastExprPossibleValues = possibleValues;
    }

    /** Visit method */
    public void visit(RSExpr.NextSignal nextSignal) throws InvalidInfraException {
        var possibleValues = new HashSet<>();
        nextSignal.signal.accept(this);
        var possibleSignals = lastExprPossibleValues;
        nextSignal.route.accept(this);
        var possibleRoutes = lastExprPossibleValues;
        for (var currentRouteState : possibleRoutes) {
            assert currentRouteState instanceof Route;
            var currentRoute = (Route) currentRouteState;

            for (var currentSignalState : possibleSignals) {
                assert currentSignalState instanceof Signal;
                var currentSignal = (Signal) currentSignalState;

                for (int i = 0; i < currentRoute.signalsWithEntry.size() - 1; i++) {
                    if (currentRoute.signalsWithEntry.get(i).equals(currentSignal)) {
                        var resSignal = currentRoute.signalsWithEntry.get(i + 1);
                        possibleValues.add(resSignal);
                        routeDependencies.add(currentRoute);
                    }
                }
            }
        }
        lastExprPossibleValues = possibleValues;
    }
}
