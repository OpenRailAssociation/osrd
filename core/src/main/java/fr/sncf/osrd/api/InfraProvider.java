package fr.sncf.osrd.api;

public interface InfraProvider {
    /** Get an infra given an id */
    FullInfra getInfra(String infraId, Integer expectedVersion) throws InterruptedException;
}
