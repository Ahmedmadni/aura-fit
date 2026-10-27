// Evaluate the actual app/build.gradle validation block without Android SDK.
// This is a policy test, not APK assembly or Android plugin verification.
class GradleException extends RuntimeException {
    GradleException(String message) { super(message) }
}
class TestProvider {
    String value
    TestProvider orElse(TestProvider other) { value != null ? this : other }
    String getOrNull() { value }
}
class TestProviders {
    Map values
    TestProvider gradleProperty(String name) { new TestProvider(value: values[name]) }
    TestProvider environmentVariable(String name) { new TestProvider(value: null) }
}
def source = new File('android/app/build.gradle').text
int start = source.indexOf('def siteValue =')
int end = source.indexOf('def assetStatements =')
assert start >= 0 && end > start
def policy = source.substring(start, end)
def cases = [
    ['https://adaptive-wellspring-36.lovable.app', false, ['assembleDebug'], true],
    ['https://fit.example-fitness.com/', false, ['bundleRelease'], true],
    ['https://example.org', true, ['assembleDebug'], true],
    ['https://example.org', true, [':app:assembleDebug'], true],
    ['https://example.org', true, ['assembleRelease'], false],
    ['https://example.org', true, ['assembleDebug', 'bundleRelease'], false],
    ['https://example.org', true, [], false],
    ['https://example.org/', true, ['assembleDebug'], false],
    ['https://fit.example-fitness.com', true, ['assembleDebug'], false],
]
for (target in ['https://example.org', 'https://169.254.169.254', 'https://100.64.0.1',
               'https://8.8.8.8', 'https://[::1]', 'https://localhost', 'https://fit.local',
               'https://id-preview--fitness.lovable.app', 'https://lovable.dev',
               'https://github.com', 'https://fitness.com:443', 'https://fitness.com/profile',
               'https://fitness.com?', 'https://fitness.com#', 'https://user:pass@fitness.com',
               'http://fitness.com', 'https://fitness.com:8443', null]) {
    cases.add([target, false, ['assembleDebug'], false])
}
for (row in cases) {
    def binding = new Binding([
        providers: new TestProviders(values: [auraSiteUrl: row[0], auraBuildCheck: row[1].toString()]),
        gradle: [startParameter: [taskNames: row[2]]],
    ])
    boolean accepted = true
    try {
        new GroovyShell(this.class.classLoader, binding).evaluate(policy)
    } catch (GradleException | URISyntaxException error) {
        accepted = false
    }
    assert accepted == row[3] : "Unexpected Gradle policy decision: ${row[0]}, tasks ${row[2]}"
}
println "Android Gradle policy PASS: ${cases.size()} actual guard/task cases; SDK and APK not tested."