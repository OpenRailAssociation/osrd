package fr.sncf.osrd.api;

import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

import fr.sncf.osrd.Helpers;
import okhttp3.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.regex.Pattern;

@ExtendWith(MockitoExtension.class)
public class ApiTest {
    public InfraManager infraManager;

    ElectricalProfileSetManager electricalProfileSetManager = null;

    private static OkHttpClient mockHttpClient(String regex) throws IOException {
        final OkHttpClient okHttpClient = mock(OkHttpClient.class);
        final Call remoteCall = mock(Call.class);

        ArgumentCaptor<Request> argument = ArgumentCaptor.forClass(Request.class);
        lenient().when(okHttpClient.newCall(argument.capture())).thenReturn(remoteCall);
        lenient().when(remoteCall.execute()).thenAnswer(
                invocation -> new Response.Builder().protocol(Protocol.HTTP_1_1).request(argument.getValue())
                        .code(200).message("OK")
                        .addHeader("x-infra-version", "1")
                        .body(ResponseBody.create(parseMockRequest(argument.getValue(), regex),
                                MediaType.get("application/json; charset=utf-8"))).build());

        return okHttpClient;
    }

    private static String parseMockRequest(Request request, String regex) throws IOException {
        var url = request.url().toString();
        var matcher = Pattern.compile(regex).matcher(url);
        if (matcher.matches()) {
            try {
                var path = matcher.group(1);
                return Files.readString(Paths.get(Helpers.getResourcePath(path).toUri()));
            } catch (IOException e) {
                throw new IOException("Failed to read mock file", e);
            } catch (AssertionError e) {
                return ""; // If we can't find the file we return an empty string
            }
        }
        throw new RuntimeException("Could not parse the given url");
    }

    /**
     * Setup infra handler mock
     */
    @BeforeEach
    public void setUp() throws IOException {
        infraManager = new InfraManager("http://test.com/", "", mockHttpClient(".*/infra/(.*)/railjson.*"), true);
        electricalProfileSetManager = new ElectricalProfileSetManager("http://test.com/", "",
                mockHttpClient(".*/electrical_profile_set/(.*)/"));

    }
}
