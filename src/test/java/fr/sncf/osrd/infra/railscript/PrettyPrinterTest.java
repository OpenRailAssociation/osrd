package fr.sncf.osrd.infra.railscript;

import static org.junit.jupiter.api.Assertions.assertEquals;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railscript.value.RSBool;
import fr.sncf.osrd.infra.railscript.value.RSType;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.signaling.Aspect;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;

@SuppressFBWarnings({"DM_DEFAULT_ENCODING"})
class PrettyPrinterTest {

    private RSFunction<RSBool> simpleBoolFunction() {
        @SuppressWarnings({"unchecked"})
        var body = new RSExpr.Or((RSExpr<RSBool>[]) new RSExpr<?>[]{
                RSExpr.True.INSTANCE,
                new RSExpr.And((RSExpr<RSBool>[]) new RSExpr<?>[]{
                        RSExpr.True.INSTANCE,
                        new RSExpr.Not(RSExpr.False.INSTANCE)
                })
        });
        return new RSFunction<>("function_test", new String[0], new RSType[0], RSType.BOOLEAN, body, 0);
    }

    private RSFunction<RSBool> simpleIfFunction() {
        var body = new RSExpr.If<>(
                new RSExpr.ArgumentRef<>(0),
                RSExpr.True.INSTANCE,
                new RSExpr.ArgumentRef<>(1)
        );
        return new RSFunction<>(
                "function_test",
                new String[]{"arg_1", "arg_2"},
                new RSType[]{RSType.BOOLEAN, RSType.BOOLEAN},
                RSType.BOOLEAN,
                body,
                2);
    }

    @Test
    public void booleanTest() throws InvalidInfraException {
        var content = new ByteArrayOutputStream();
        var printer = new PrettyPrinter(new PrintStream(content));

        printer.print(simpleBoolFunction());

        var expected = String.join("\n",
                "fn function_test() -> bool {",
                "    (true or true and not (false))",
                "}\n"
                );
        assertEquals(expected, content.toString());
    }

    @Test
    public void ifTest() throws InvalidInfraException {
        var content = new ByteArrayOutputStream();
        var printer = new PrettyPrinter(new PrintStream(content));

        printer.print(simpleIfFunction());

        var expected = String.join("\n",
                "fn function_test(",
                "        arg_1: bool,",
                "        arg_2: bool",
                ") -> bool {",
                "    if arg_1 {",
                "        true",
                "    } else {",
                "        arg_2",
                "    }",
                "}\n"
        );
        assertEquals(expected, content.toString());
    }

    @Test
    public void aspectSetTest() throws InvalidInfraException {
        var content = new ByteArrayOutputStream();
        var printer = new PrettyPrinter(new PrintStream(content));

        @SuppressWarnings({"unchecked"})
        var aspectSet = new RSExpr.AspectSet(
                new Aspect[] {
                        new Aspect(0, "GREEN"),
                        new Aspect(0, "YELLOW"),
                        new Aspect(0, "RED")
                },
                (RSExpr<RSBool>[]) new RSExpr<?>[]{
                        RSExpr.True.INSTANCE,
                        null,
                        RSExpr.False.INSTANCE
                }
        );

        printer.visit(aspectSet);

        var expected = String.join("\n",
                "AspectSet {",
                "    GREEN if true,",
                "    YELLOW,",
                "    RED if false",
                "}"
        );
        assertEquals(expected, content.toString());
    }

    @Test
    public void callTest() throws InvalidInfraException {
        var content = new ByteArrayOutputStream();
        var printer = new PrettyPrinter(new PrintStream(content));

        var fct = simpleIfFunction();
        printer.print(fct);

        content.reset();

        var call = new RSExpr.Call<RSBool>(fct, new RSExpr<?>[]{
                RSExpr.True.INSTANCE,
                RSExpr.False.INSTANCE
        }, 0);
        printer.visit(call);

        var expected = String.join("\n", "function_test(true, false)");
        assertEquals(expected, content.toString());
    }

    @Test
    public void matchTest() throws InvalidInfraException {
        var content = new ByteArrayOutputStream();
        var printer = new PrettyPrinter(new PrintStream(content));

        @SuppressWarnings({"unchecked"})
        var match = new RSExpr.EnumMatch<RSBool, Route.State>(new RSExpr.RouteRef("route"),
                (RSExpr<RSBool>[]) new RSExpr<?>[] {
                        RSExpr.True.INSTANCE,
                        RSExpr.False.INSTANCE,
                        RSExpr.False.INSTANCE
                }
        );
        printer.visit(match);

        var expected = String.join("\n",
                "match \"route\" {",
                "    0: true,",
                "    1: false,",
                "    2: false",
                "}"
        );
        assertEquals(expected, content.toString());
    }
}