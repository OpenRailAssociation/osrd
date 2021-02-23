package fr.sncf.osrd.simulation;

public abstract class SimChange<ResultT> extends Change {
    public SimChange(Simulation sim) {
        super(sim);
    }

    public abstract ResultT apply(Simulation sim);

    @Override
    public void replay(Simulation sim) {
        this.apply(sim);
    }
}
