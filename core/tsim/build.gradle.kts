plugins {
    alias(libs.plugins.kotlin.multiplatform)
}

group = "fr.sncf.osrd"
version = "1.0.0"

repositories {
    mavenCentral()
}

kotlin {
    jvm {
        withSourcesJar(true)
    }

    val hostOs = System.getProperty("os.name")
    val isArm64 = System.getProperty("os.arch") == "aarch64"
    val isMingwX64 = hostOs.startsWith("Windows")
    val name = "nativ"
    val nativeTarget = when {
        hostOs == "Mac OS X" && isArm64 -> macosArm64(name)
        hostOs == "Mac OS X" && !isArm64 -> macosX64(name)
        hostOs == "Linux" && isArm64 -> linuxArm64(name)
        hostOs == "Linux" && !isArm64 -> linuxX64(name)
        isMingwX64 -> mingwX64(name)
        else -> throw GradleException("Host OS is not supported in Kotlin/Native.")
    }

    nativeTarget.apply {
        binaries {
            sharedLib {
                baseName = "tsim"
            }
        }
    }
}
