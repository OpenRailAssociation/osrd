package fr.sncf.osrd;

import com.beust.jcommander.JCommander;
import com.beust.jcommander.ParameterException;
import fr.sncf.osrd.cli.*;
import java.util.HashMap;

public class App {
    /**
     * The main entry point for OSRD.
     * @param args the command line arguments
     */
    public static void main(String[] args) {
        var commands = new HashMap<String, CliCommand>();
        commands.put("simulate", new SimulateCommand());
        commands.put("pretty-print-signals", new PrettyPrintCommand());
        commands.put("api", new ApiServerCommand());
        commands.put("interactive", new InteractiveCommand());

        // prepare the command line parser
        var argsParserBuilder = JCommander.newBuilder();
        for (var command : commands.entrySet())
            argsParserBuilder.addCommand(command.getKey(), command.getValue());
        var argsParser = argsParserBuilder.build();

        // parse the command line arguments
        try {
            argsParser.parse(args);
        } catch (ParameterException e) {
            e.usage();
            System.exit(1);
        }

        // get the name of the user command (help, simulate, convert, ...)
        var commandName = argsParser.getParsedCommand();
        if (commandName == null) {
            argsParser.usage();
            System.exit(1);
        }

        // run the user command
        var statusCode = commands.get(commandName).run();
        System.exit(statusCode);
    }
}
