package fr.sncf.osrd.api;

import fr.sncf.osrd.infra.Infra;

import java.util.HashMap;

public class InfraHandler {
    private HashMap<String, Infra> cache = new HashMap<>();

    public Infra load(String infraId) {
         var cachedInfra = cache.get(infraId);
         if (cachedInfra != null)
             return cachedInfra;
         // TODO Query infra
        throw new RuntimeException("Not implemented yet");
    }
}
