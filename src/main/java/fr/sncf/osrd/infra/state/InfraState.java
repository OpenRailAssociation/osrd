package fr.sncf.osrd.infra.state;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;

import java.util.HashMap;

public class InfraState {
    public final Infra infra;

    final HashMap<StatefulInfraObject<?>, Object> stateMap = new HashMap<>();

    public InfraState(Infra infra) {
        this.infra = infra;
    }

    public boolean contains(StatefulInfraObject<?> object) {
        return stateMap.containsKey(object);
    }

    public void initialize(StatefulInfraObject<?> object) throws InvalidInfraException {
        if (stateMap.put(object, object.newState()) != null)
            throw new InvalidInfraException("an object was inserted twice in the infrastructure state");
    }
}
