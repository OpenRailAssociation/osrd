package sncf.osrd.train_sim

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals

internal class CrossLanguageTests {
    // This function is used to get the absolute path of a resource file
    fun getResourcePath(resource: String): String {
        val resourceUrl = javaClass.getResource(resource)!!.path
        return File(resourceUrl).absolutePath
    }

    @Test
    fun testBuildGreetings() {
        val person = personFromJsonFile(getResourcePath("/input.json"))
        val expectedGreetings = greetingsFromJsonFile(getResourcePath("/expected_output.json"))

        val greetings = makeGreeting(person)

        assertEquals(expectedGreetings, greetings)
    }
}
