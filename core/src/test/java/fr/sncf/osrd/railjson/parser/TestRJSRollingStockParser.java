package fr.sncf.osrd.railjson.parser;

import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.reporting.exceptions.ErrorType;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import org.junit.jupiter.api.Test;
import java.io.IOException;

public class TestRJSRollingStockParser {
    @Test
    public void testCorrectParse() throws IOException {
        RJSRollingStock rjsRollingStock = Helpers.getExampleRollingStock("fast_rolling_stock.json");
        RJSRollingStockParser.parse(rjsRollingStock);
    }

    @Test
    public void testWrongMajorVersion() throws IOException {
        RJSRollingStock rjsRollingStock = Helpers.getExampleRollingStock("fast_rolling_stock.json");
        rjsRollingStock.version = "0.0.0";
        var thrown = assertThrows(OSRDError.class, () -> RJSRollingStockParser.parse(rjsRollingStock));
        assertEquals(thrown.osrdErrorType, ErrorType.InvalidRollingStockMajorVersionMismatch);
    }

    @Test
    public void testWrongMinorVersion() throws IOException {
        RJSRollingStock rjsRollingStock = Helpers.getExampleRollingStock("fast_rolling_stock.json");
        rjsRollingStock.version = RJSRollingStock.CURRENT_VERSION.split("\\.")[0] + ".a";
        RJSRollingStockParser.parse(rjsRollingStock);
    }
}
