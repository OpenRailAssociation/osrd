package fr.sncf.osrd.simulation.changelog;

import fr.sncf.osrd.simulation.Change;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.HashMap;

public class ChangeLogSummarizer {
    static final Logger logger = LoggerFactory.getLogger(ChangeLogSummarizer.class);

    private static final class Counter {
        int count = 1;
    }

    /** Log a handy summary of the content of some changelog */
    public static void summarize(ChangeLog changelog) {
        if (!logger.isInfoEnabled())
            return;

        logger.info("{} changes were produced", changelog.size());
        var changeTypes = new HashMap<Class<? extends Change>, Counter>();

        for (var change : changelog) {
            var changeType = change.getClass();
            var changeTypeCounter = changeTypes.get(changeType);
            if (changeTypeCounter == null)
                changeTypes.put(changeType, new Counter());
            else
                changeTypeCounter.count += 1;
        }

        for (var changeTypeEntry : changeTypes.entrySet()) {
            var clazz = changeTypeEntry.getKey();
            var count = changeTypeEntry.getValue().count;
            logger.info("{}\t{}", count, clazz.getSimpleName());
        }
    }

}
