Provides the following route :

GET /tests

Serves a test suite, one test after another, which will report results to the test server. It is the url that will be accessed from target devices to execute tests on them.

it accepts a number of query string arguments :

tags:
    a list of coma-separated tags that define which test should be included in the test suite. If omitted, all known tests will be performed.

oneShot:
    only execute this test but don't link to the next (if any) in the test suite that matches.

additionnally, some query string arguments are automatically added by a test page when calling the next in the test suite :

testIndex:
    the ordinal index of the test in the test suite.

testRunnerSession:
    a token that binds together tests from the same run.

reporterUrl:
    specifies to which url send the test results

It's also possible to add custom query strings that will be made available to test templates
