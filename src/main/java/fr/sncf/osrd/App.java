package fr.sncf.osrd;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.NoOpNode;
import fr.sncf.osrd.infra.TopoNode;

public class App {
    public static void main(String[] args) {
        var infra = new Infra();
        infra.register(new NoOpNode("ok"));
        infra.topoNodes.get(0)
        Config config = new Config(1.0, infra);
        Simulation simulation = new Simulation(config);
        System.out.println("coucou oui");
    }
}
