package fr.sncf.osrd.cli;

public interface CliCommand {
    /** Runs the command, and return a status code */
    int run();
}
