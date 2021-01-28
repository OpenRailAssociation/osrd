package fr.sncf.osrd.util;

import java.nio.file.Path;
import java.nio.file.Paths;

public class PathUtils {
    /**
     * Returns a path relative to a base directory
     * @param baseDir the base directory, or null
     * @param path the relative path
     * @return the combined path
     */
    public static Path relativeTo(Path baseDir, String path) {
        // if there is no base directory, it's just a regular path
        // the caller could have written:
        // var mainConfigPath = Paths.get("main_config.json");
        // var otherConfig = PathUtils.relativeTo(mainConfigPath.getParent(), "subconfig.json");
        if (baseDir == null)
            return Paths.get(path);
        return baseDir.resolve(path);
    }
}
