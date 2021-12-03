package fr.sncf.osrd.infra.railscript;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.infra.trackgraph.Switch;
import java.util.*;

/** This visitor evaluates all the possible return values of the (non-boolean) expressions
 * For now it is used for dependency resolution that works with primitives like NextSignal,
 * but it can also be used for better delay management.*/
public class DependencyBinder extends RSExprVisitor {

    /** This attributes emulates a return value, which can't be done normally in a visitor.
    * It contains the possible return values of the expression we visited last. */
    private Set<Object> lastExprPossibleValues;

    /** The set of all signal used to evaluate the visited expression. */
    public final Set<Signal> signalDependencies = new HashSet<>();

    /** The set of all routes used to evaluate the visited expression. */
    public final Set<Route> routeDependencies = new HashSet<>();

    /** The set of all switches used to evaluate the visited expression. */
    public final Set<Switch> switchDependencies = new HashSet<>();

    /** Contains the possible values of arguments of each function calls before visiting its body */
    private final Stack<ArrayList<Set<Object>>> argsPossibleValues = new Stack<>();

    /** Contains the possible values of match expressions (excluding empty) */
    private final HashMap<String, Set<Object>> matchRefPossibleValues = new HashMap<>();

    /** Reference to the infra, used to evaluate primitives */
    private final Infra infra;

    public DependencyBinder(Infra infra) {
        this.infra = infra;
    }

    /** Adds the given signal as dependency to all the relevant signals, routes and switches. */
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

    /** Visit method */
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

    /** Visit method
     * We store the possible values of each argument in a stack, then eval the body.
     * A pair of functions calling each other would cause infinite recursion, but we don't support this. */
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
        for (var possibleValue : lastExprPossibleValues) {
            if (possibleValue instanceof Switch) {
                switchDependencies.add((Switch) possibleValue);
            } else if (possibleValue instanceof Route) {
                routeDependencies.add((Route) possibleValue);
            }
        }
        var possibleValues = new HashSet<>();
        for (var branch : expr.branches) {
            branch.accept(this);
            possibleValues.addAll(lastExprPossibleValues);
        }
        lastExprPossibleValues = possibleValues;
    }

    /** Visit method
     * All signals that may be an input are added to the dependencies. */
    public void visit(RSExpr.SignalAspectCheck expr) throws InvalidInfraException {
        expr.signalExpr.accept(this);
        for (var possibleValue : lastExprPossibleValues) {
            assert possibleValue instanceof Signal;
            signalDependencies.add((Signal) possibleValue);
        }
    }

    /** Visit method
     * All routes that may be an input are added to the dependencies. */
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

    /** Visit method
     * We do *not* add the input signal(s) because what matters is its position, not its state. */
    public void visit(RSExpr.ReservedRoute reservedRoute) throws InvalidInfraException {
        var possibleValues = new HashSet<>();
        reservedRoute.signal.accept(this);
        var possibleSignals = lastExprPossibleValues;
        for (var val : possibleSignals) {
            assert val instanceof Signal;
            var signal = (Signal) val;
            for (Route route : infra.routeGraph.routeMap.values()) {
                if (route.entrySignal == signal) {
                    possibleValues.add(route);
                    reservedRoute.routeCandidates.add(route);
                }
            }
        }
        lastExprPossibleValues = possibleValues;
    }

    /** Visit method
     * We add the routes to the dependencies and "return" the possible signals.
     * The double loop implies an explosion of results, but we expect a lot of overlap and a small
     * resulting set. Most routes share their next signals. */
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

    /** Visit method
     * We add all the routes that precede the signal
     */
    public void visit(RSExpr.PreviousReservedRoute previousReservedRoute) throws InvalidInfraException {
        var possibleValues = new HashSet<>();
        previousReservedRoute.signal.accept(this);
        var possibleSignals = lastExprPossibleValues;
        for (var val : possibleSignals) {
            assert val instanceof Signal;
            var signal = (Signal) val;
            possibleValues.addAll(signal.linkedDetector.getIncomingRouteNeighbors(
                    signal.direction
            ));
        }
        lastExprPossibleValues = possibleValues;
    }
}
